import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ── Configure aqui ──────────────────────────────────────────
// Em produção, troque pela URL real da API
const _baseUrl = String.fromEnvironment('API_URL', defaultValue: 'http://191.252.100.195:3001');
const _tenantSlug = String.fromEnvironment('TENANT_SLUG', defaultValue: 'demo');

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        // Envia tenant via header para funcionar sem subdomínio
        'X-Tenant-Slug': _tenantSlug,
      },
    ));

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final user = FirebaseAuth.instance.currentUser;
          if (user != null) {
            final token = await user.getIdToken();
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (err, handler) {
          // Log detalhado para debug
          final resp = err.response;
          if (resp != null) {
            print('[ApiClient] ${resp.statusCode} ${err.requestOptions.path}: ${resp.data}');
          }
          handler.next(err);
        },
      ),
    );
  }

  // ── Auth ────────────────────────────────────────────────────
  Future<Map<String, dynamic>?> syncUser(String idToken, {String? fcmToken}) async {
    final res = await _dio.post('/auth/sync-user', data: {
      'id_token': idToken,
      if (fcmToken != null) 'fcm_token': fcmToken,
    });
    return res.data as Map<String, dynamic>?;
  }

  // ── Ocorrências ─────────────────────────────────────────────
  Future<Map<String, dynamic>> getOcorrencias({
    String? status, String? prioridade, int page = 1, int limit = 20,
  }) async {
    final res = await _dio.get('/ocorrencias', queryParameters: {
      if (status != null) 'status': status,
      if (prioridade != null) 'prioridade': prioridade,
      'page': page,
      'limit': limit,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createOcorrencia({
    required String descricao,
    required double latitude,
    required double longitude,
    String? categoriaId,
    String? endereco,
    required String clientId,
  }) async {
    final res = await _dio.post('/ocorrencias', data: {
      'descricao': descricao,
      'latitude': latitude,
      'longitude': longitude,
      if (categoriaId != null) 'categoria_id': categoriaId,
      if (endereco != null) 'endereco': endereco,
      'client_id': clientId,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<void> uploadImagens(String ocorrenciaId, List<String> paths, {String tipo = 'registro'}) async {
    final form = FormData();
    for (final p in paths) {
      form.files.add(MapEntry('imagens', await MultipartFile.fromFile(p)));
    }
    form.fields.add(MapEntry('tipo', tipo));
    await _dio.post('/ocorrencias/$ocorrenciaId/imagens', data: form);
  }

  Future<Map<String, dynamic>> getOcorrencia(String id) async {
    final res = await _dio.get('/ocorrencias/$id');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateOcorrencia(String id, {String? status, String? prioridade}) async {
    final res = await _dio.patch('/ocorrencias/$id', data: {
      if (status != null) 'status': status,
      if (prioridade != null) 'prioridade': prioridade,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> getCategorias() async {
    final res = await _dio.get('/categorias');
    return res.data as List<dynamic>;
  }
}
