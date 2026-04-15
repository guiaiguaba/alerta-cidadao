import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive/hive.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../models/ocorrencia_local.dart';
import '../api/api_client.dart';

final syncServiceProvider = Provider<SyncService>((ref) {
  final client = ref.read(apiClientProvider);
  return SyncService(client);
});

class SyncService {
  final ApiClient _client;
  Box<OcorrenciaLocal>? _box;

  SyncService(this._client);

  Box<OcorrenciaLocal> get box {
    _box ??= Hive.box<OcorrenciaLocal>('ocorrencias_pendentes');
    return _box!;
  }

  /// Salva ocorrência localmente e tenta sincronizar imediatamente
  Future<OcorrenciaLocal> salvarESync(OcorrenciaLocal ocorrencia) async {
    await box.add(ocorrencia);
    await tentarSync();
    return ocorrencia;
  }

  /// Tenta sincronizar todas as pendentes
  Future<void> tentarSync() async {
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity == ConnectivityResult.none) return;

    final pendentes = box.values.where((o) => !o.sincronizado).toList();

    for (final ocorrencia in pendentes) {
      try {
        final result = await _client.createOcorrencia(
          descricao: ocorrencia.descricao,
          latitude: ocorrencia.latitude,
          longitude: ocorrencia.longitude,
          categoriaId: ocorrencia.categoriaId,
          endereco: ocorrencia.endereco,
          clientId: ocorrencia.clientId,
        );

        final serverId = result['id'] as String?;

        // Upload de imagens após criar ocorrência
        if (serverId != null && ocorrencia.imagemPaths.isNotEmpty) {
          await _client.uploadImagens(serverId, ocorrencia.imagemPaths);
        }

        // Marcar como sincronizado (last-write-wins)
        ocorrencia.sincronizado = true;
        ocorrencia.serverId = serverId;
        await ocorrencia.save();
      } catch (_) {
        // Manter pendente para próxima tentativa
      }
    }
  }

  /// Inicializa listener de conectividade
  void iniciarListener() {
    Connectivity().onConnectivityChanged.listen((result) {
      if (result != ConnectivityResult.none) tentarSync();
    });
  }

  List<OcorrenciaLocal> getPendentes() {
    return box.values.where((o) => !o.sincronizado).toList();
  }
}
