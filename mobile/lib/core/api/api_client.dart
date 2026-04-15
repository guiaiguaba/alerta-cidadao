import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const _baseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://vps65913.publiccloud.com.br',
);

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          final token = await user.getIdToken();
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (err, handler) {
        handler.next(err);
      },
    ));
  }

  // Auth
  Future<Map<String, dynamic>?> syncUser(String idToken, {String? fcmToken}) async {
    final res = await _dio.post('/auth/sync-user', data: {
      'id_token': idToken,
      if (fcmToken != null) 'fcm_token': fcmToken,
    });
    return res.data as Map<String, dynamic>?;
  }

  // Ocorrências
  Future<Map<String, dynamic>> getOcorrencias({
    String? status,
    String? prioridade,
    int page = 1,
    int limit = 20,
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

  Future<void> uploadImagens(String ocorrenciaId, List<String> filePaths, {String tipo = 'registro'}) async {
    final formData = FormData();
    for (final path in filePaths) {
      formData.files.add(MapEntry('imagens', await MultipartFile.fromFile(path)));
    }
    formData.fields.add(MapEntry('tipo', tipo));
    await _dio.post('/ocorrencias/$ocorrenciaId/imagens', data: formData);
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
