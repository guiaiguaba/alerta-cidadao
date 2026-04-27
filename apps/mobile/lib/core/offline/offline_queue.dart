// lib/core/offline/offline_queue.dart
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../api/api_client.dart';
import 'connectivity_service.dart';
import '../../models/models.dart';

const _kSyncQueueBox     = 'sync_queue';
const _kOccurrencesBox   = 'occurrences_local';
const _kCategoriesBox    = 'categories';
const _kMaxRetries       = 3;

/// Gerencia operações offline e sincronização automática
/// Estratégia: Last-write-wins por timestamp, fotos sempre aceitas
class OfflineQueueService {
  final ApiClient _api;
  final ConnectivityService _connectivity;
  final _uuid = const Uuid();

  Box<SyncQueueItem>? _syncQueue;
  Box<dynamic>?       _occurrencesBox;
  StreamSubscription? _connectivitySub;
  bool _syncInProgress = false;

  OfflineQueueService({
    required ApiClient api,
    required ConnectivityService connectivity,
  })  : _api = api,
        _connectivity = connectivity;

  Future<void> init() async {
    _syncQueue     = await Hive.openBox<SyncQueueItem>(_kSyncQueueBox);
    _occurrencesBox = await Hive.openBox(_kOccurrencesBox);

    // Escutar reconexões — sincronizar automaticamente
    _connectivitySub = _connectivity.onConnectivityChanged.listen((isOnline) {
      if (isOnline && hasPendingItems) {
        debugPrint('[Offline] Conexão restaurada — iniciando sync');
        syncPending();
      }
    });
  }

  bool get hasPendingItems => (_syncQueue?.isNotEmpty ?? false);
  int  get pendingCount    => _syncQueue?.length ?? 0;

  // ==========================================
  // ENQUEUE OPERATIONS
  // ==========================================

  /// Enfileira criação de ocorrência offline
  Future<String> enqueueCreateOccurrence(Map<String, dynamic> data) async {
    final clientId = _uuid.v4();
    final item = SyncQueueItem(
      id:        _uuid.v4(),
      type:      'create_occurrence',
      payload:   {...data, 'clientId': clientId},
      createdAt: DateTime.now().toIso8601String(),
    );

    await _syncQueue!.put(item.id, item);
    debugPrint('[Offline] Enfileirado: create_occurrence (clientId: $clientId)');
    return clientId;
  }

  /// Enfileira atualização de status offline
  Future<void> enqueueStatusUpdate(
    String occurrenceId,
    String status, {
    String? note,
  }) async {
    final item = SyncQueueItem(
      id:        _uuid.v4(),
      type:      'update_status',
      payload:   {
        'occurrenceId': occurrenceId,
        'status':       status,
        if (note != null) 'note': note,
        'timestamp':    DateTime.now().toIso8601String(),
      },
      createdAt: DateTime.now().toIso8601String(),
    );

    await _syncQueue!.put(item.id, item);
    debugPrint('[Offline] Enfileirado: update_status ($occurrenceId → $status)');
  }

  // ==========================================
  // SYNC
  // ==========================================

  Future<SyncResult> syncPending() async {
    if (_syncInProgress || !hasPendingItems) {
      return const SyncResult(synced: 0, conflicts: 0, errors: 0);
    }

    final isOnline = await _connectivity.checkConnectivity();
    if (!isOnline) {
      return const SyncResult(synced: 0, conflicts: 0, errors: 0);
    }

    _syncInProgress = true;
    int synced = 0, conflicts = 0, errors = 0;

    try {
      // Processar todos os itens em ordem de criação
      final items = _syncQueue!.values.toList()
        ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

      // Separar por tipo para batch
      final createItems = items
          .where((i) => i.type == 'create_occurrence')
          .toList();
      final updateItems = items
          .where((i) => i.type == 'update_status')
          .toList();

      // Batch create (sync endpoint)
      if (createItems.isNotEmpty) {
        final payloads = createItems.map((i) => i.payload).toList();
        final res = await _api.syncBatch(payloads.cast<Map<String, dynamic>>());

        final synced_ = (res['synced'] as List?) ?? [];
        final conflicts_ = (res['conflicts'] as List?) ?? [];
        final errors_ = (res['errors'] as List?) ?? [];

        synced    += synced_.length;
        conflicts += conflicts_.length;
        errors    += errors_.length;

        // Remover itens sincronizados com sucesso
        for (final item in createItems) {
          await _syncQueue!.delete(item.id);
        }
      }

      // Processar status updates individualmente
      for (final item in updateItems) {
        try {
          await _api.updateOccurrenceStatus(
            item.payload['occurrenceId'] as String,
            item.payload['status'] as String,
            note: item.payload['note'] as String?,
          );
          await _syncQueue!.delete(item.id);
          synced++;
        } catch (e) {
          item.retryCount++;
          item.lastError = e.toString();

          if (item.retryCount >= _kMaxRetries) {
            debugPrint('[Offline] Item descartado após $_kMaxRetries tentativas: ${item.id}');
            await _syncQueue!.delete(item.id);
            errors++;
          } else {
            await _syncQueue!.put(item.id, item);
            errors++;
          }
        }
      }

      debugPrint('[Offline] Sync concluído: $synced OK, $conflicts conflitos, $errors erros');
    } catch (e) {
      debugPrint('[Offline] Falha geral no sync: $e');
    } finally {
      _syncInProgress = false;
    }

    return SyncResult(synced: synced, conflicts: conflicts, errors: errors);
  }

  // ==========================================
  // LOCAL CACHE DE CATEGORIAS
  // ==========================================

  Future<List<Map<String, dynamic>>> getCachedCategories() async {
    final box = await Hive.openBox<Map>(_kCategoriesBox);
    return box.values.map((v) => Map<String, dynamic>.from(v)).toList();
  }

  Future<void> cacheCategories(List<Map<String, dynamic>> categories) async {
    final box = await Hive.openBox<Map>(_kCategoriesBox);
    await box.clear();
    for (final cat in categories) {
      await box.put(cat['id'].toString(), cat);
    }
  }

  Future<void> dispose() async {
    await _connectivitySub?.cancel();
  }
}

class SyncResult {
  final int synced;
  final int conflicts;
  final int errors;

  const SyncResult({
    required this.synced,
    required this.conflicts,
    required this.errors,
  });

  bool get hasErrors    => errors > 0;
  bool get hasConflicts => conflicts > 0;
  bool get isSuccess    => errors == 0 && conflicts == 0;
}
