// lib/core/notifications/notification_storage.dart
// Armazena localmente todas as notificações recebidas via FCM usando Hive

import 'package:hive_flutter/hive_flutter.dart';

// ── Modelo salvo no Hive ───────────────────────────────────
class LocalNotification {
  final String  id;
  final String  title;
  final String  body;         // corpo completo com formatação
  final String  type;         // 'alert' | 'occurrence_update' | 'briefing' | 'other'
  final String  severity;     // 'critical' | 'high' | 'medium' | 'info'
  final bool    isRead;
  final DateTime receivedAt;
  final Map<String, dynamic> data; // payload completo do FCM

  LocalNotification({
    required this.id,
    required this.title,
    required this.body,
    this.type     = 'other',
    this.severity = 'info',
    this.isRead   = false,
    required this.receivedAt,
    this.data     = const {},
  });

  LocalNotification copyWith({bool? isRead}) => LocalNotification(
    id:         id,
    title:      title,
    body:       body,
    type:       type,
    severity:   severity,
    isRead:     isRead ?? this.isRead,
    receivedAt: receivedAt,
    data:       data,
  );

  Map<String, dynamic> toJson() => {
    'id':         id,
    'title':      title,
    'body':       body,
    'type':       type,
    'severity':   severity,
    'isRead':     isRead,
    'receivedAt': receivedAt.toIso8601String(),
    'data':       data,
  };

  factory LocalNotification.fromJson(Map<dynamic, dynamic> json) => LocalNotification(
    id:         json['id'] as String,
    title:      json['title'] as String,
    body:       json['body'] as String,
    type:       json['type'] as String? ?? 'other',
    severity:   json['severity'] as String? ?? 'info',
    isRead:     json['isRead'] as bool? ?? false,
    receivedAt: DateTime.parse(json['receivedAt'] as String),
    data:       Map<String, dynamic>.from((json['data'] as Map?) ?? {}),
  );
}

// ── Serviço de storage ─────────────────────────────────────
class NotificationStorage {
  static const _boxName = 'notifications_v1';
  static const _maxItems = 200; // limite para não crescer indefinidamente

  late Box<Map> _box;

  Future<void> init() async {
    _box = await Hive.openBox<Map>(_boxName);
  }

  /// Salvar nova notificação recebida
  Future<void> save(LocalNotification notification) async {
    await _box.put(notification.id, notification.toJson());
    await _trimIfNeeded();
  }

  /// Listar todas as notificações (mais recentes primeiro)
  List<LocalNotification> getAll() {
    return _box.values
        .map((m) => LocalNotification.fromJson(m))
        .toList()
      ..sort((a, b) => b.receivedAt.compareTo(a.receivedAt));
  }

  /// Contar não lidas
  int get unreadCount =>
      _box.values.where((m) => m['isRead'] != true).length;

  /// Marcar como lida
  Future<void> markAsRead(String id) async {
    final existing = _box.get(id);
    if (existing != null) {
      final updated = Map<dynamic, dynamic>.from(existing);
      updated['isRead'] = true;
      await _box.put(id, updated);
    }
  }

  /// Marcar todas como lidas
  Future<void> markAllAsRead() async {
    final updates = <String, Map>{};
    for (final key in _box.keys) {
      final m = _box.get(key);
      if (m != null && m['isRead'] != true) {
        final updated = Map<dynamic, dynamic>.from(m);
        updated['isRead'] = true;
        updates[key as String] = Map<String, dynamic>.from(updated);
      }
    }
    await _box.putAll(updates);
  }

  /// Deletar uma notificação
  Future<void> delete(String id) => _box.delete(id);

  /// Limpar tudo
  Future<void> clearAll() => _box.clear();

  /// Manter somente os últimos _maxItems
  Future<void> _trimIfNeeded() async {
    if (_box.length <= _maxItems) return;
    final sorted = _box.keys.toList();
    // Remover os mais antigos
    final toDelete = sorted.take(_box.length - _maxItems).toList();
    await _box.deleteAll(toDelete);
  }
}

// Instância global (inicializada no main)
final notificationStorage = NotificationStorage();