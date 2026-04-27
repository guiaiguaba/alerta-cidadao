// lib/core/api/api_client.dart
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../auth/token_storage.dart';

const _kDefaultTimeout = Duration(seconds: 30);
const _kUploadTimeout  = Duration(minutes: 3);

class ApiClient {
  late final Dio _dio;
  final TokenStorage _storage;
  bool _isRefreshing = false;

  ApiClient({required TokenStorage storage}) : _storage = storage {
    final options = BaseOptions(
      baseUrl:        const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'http://10.0.2.2:3000/api/v1', // Android emulator → localhost
      ),
      connectTimeout: _kDefaultTimeout,
      receiveTimeout: _kDefaultTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
    );

    _dio = Dio(options);
    _dio.interceptors.addAll([
      _TenantInterceptor(storage),
      _AuthInterceptor(storage, this),
      if (kDebugMode) LogInterceptor(
        requestBody:  true,
        responseBody: true,
        error:        true,
        logPrint:     (obj) => debugPrint('[API] $obj'),
      ),
    ]);
  }

  // ==========================================
  // OCCURRENCES
  // ==========================================

  Future<Map<String, dynamic>> getOccurrences({
    String? status,
    String? priority,
    String? regionCode,
    String? bbox,
    int page = 1,
    int limit = 20,
  }) async {
    final params = <String, dynamic>{'page': page, 'limit': limit};
    if (status != null)     params['status']      = status;
    if (priority != null)   params['priority']    = priority;
    if (regionCode != null) params['regionCode']  = regionCode;
    if (bbox != null)       params['bbox']        = bbox;

    final res = await _dio.get('/occurrences', queryParameters: params);
    return res.data;
  }

  Future<Map<String, dynamic>> getOccurrence(String id) async {
    final res = await _dio.get('/occurrences/$id');
    return res.data;
  }

  Future<Map<String, dynamic>> createOccurrence(Map<String, dynamic> body) async {
    final res = await _dio.post('/occurrences', data: body);
    return res.data;
  }

  Future<Map<String, dynamic>> updateOccurrenceStatus(
    String id,
    String status, {
    String? note,
    String? assignedTo,
    String? rejectionReason,
  }) async {
    final res = await _dio.patch('/occurrences/$id/status', data: {
      'status': status,
      if (note != null)             'note':             note,
      if (assignedTo != null)       'assignedTo':       assignedTo,
      if (rejectionReason != null)  'rejectionReason':  rejectionReason,
    });
    return res.data;
  }

  Future<Map<String, dynamic>> syncBatch(List<Map<String, dynamic>> items) async {
    final res = await _dio.post('/occurrences/sync', data: {'items': items});
    return res.data;
  }

  Future<Map<String, dynamic>> uploadMedia(
    String occurrenceId,
    File file,
    String phase,
  ) async {
    final formData = FormData.fromMap({
      'file':  await MultipartFile.fromFile(file.path),
      'phase': phase,
    });

    final res = await _dio.post(
      '/occurrences/$occurrenceId/media',
      data:    formData,
      options: Options(receiveTimeout: _kUploadTimeout),
    );
    return res.data;
  }

  Future<List<dynamic>> getOccurrenceTimeline(String id) async {
    final res = await _dio.get('/occurrences/$id/timeline');
    return res.data;
  }

  Future<Map<String, dynamic>> getMapData({String? status, String? bbox}) async {
    final res = await _dio.get('/occurrences/map', queryParameters: {
      if (status != null) 'status': status,
      if (bbox != null)   'bbox':   bbox,
    });
    return res.data;
  }

  // ==========================================
  // AUTH
  // ==========================================

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await _dio.post('/auth/login', data: {
      'email':    email,
      'password': password,
    });
    return res.data;
  }

  Future<Map<String, dynamic>> register({
    required String name,
    String? email,
    String? phone,
    String? password,
  }) async {
    final res = await _dio.post('/auth/register', data: {
      'name': name,
      if (email != null)    'email':    email,
      if (phone != null)    'phone':    phone,
      if (password != null) 'password': password,
    });
    return res.data;
  }

  Future<void> sendOtp(String phone) async {
    await _dio.post('/auth/otp/send', data: {'phone': phone});
  }

  Future<Map<String, dynamic>> verifyOtp(String phone, String code) async {
    final res = await _dio.post('/auth/otp/verify', data: {
      'phone': phone,
      'code':  code,
    });
    return res.data;
  }

  Future<Map<String, dynamic>> googleAuth(String idToken) async {
    final res = await _dio.post('/auth/google', data: {'idToken': idToken});
    return res.data;
  }

  Future<Map<String, dynamic>> refreshToken(String refreshToken) async {
    final res = await _dio.post('/auth/refresh', data: {'refreshToken': refreshToken});
    return res.data;
  }

  Future<Map<String, dynamic>> getGeoConfig() async {
    final res = await _dio.get('/admin/geo-config');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await _dio.get('/auth/me');
    return res.data;
  }

  Future<void> logout(String refreshToken) async {
    await _dio.post('/auth/logout', data: {'refreshToken': refreshToken});
  }

  Future<void> updateFcmToken(String token, String action) async {
    await _dio.patch('/users/me/fcm-token', data: {'token': token, 'action': action});
  }

  // ==========================================
  // CATEGORIES
  // ==========================================

  Future<List<dynamic>> getCategories() async {
    final res = await _dio.get('/admin/categories');
    return res.data;
  }

  // ==========================================
  // ALERTS
  // ==========================================

  Future<Map<String, dynamic>> getAlerts({int page = 1}) async {
    final res = await _dio.get('/alerts', queryParameters: {'page': page, 'limit': 20});
    return res.data;
  }

  Future<void> markAlertRead(String alertId) async {
    await _dio.post('/alerts/$alertId/read');
  }

  // ==========================================
  // INTERNAL: token refresh
  // ==========================================

  Future<String?> doRefreshToken() async {
    if (_isRefreshing) return null;
    _isRefreshing = true;

    try {
      final token = await _storage.getRefreshToken();
      if (token == null) return null;

      final res = await refreshToken(token);
      final newAccess  = res['accessToken']  as String;
      final newRefresh = res['refreshToken'] as String;

      await _storage.saveTokens(
        accessToken:  newAccess,
        refreshToken: newRefresh,
      );

      return newAccess;
    } catch (e) {
      debugPrint('[API] Refresh token falhou: $e');
      return null;
    } finally {
      _isRefreshing = false;
    }
  }
}

// ============================================================
// INTERCEPTORS
// ============================================================

class _TenantInterceptor extends Interceptor {
  final TokenStorage _storage;
  _TenantInterceptor(this._storage);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final slug = await _storage.getTenantSlug();
    if (slug != null) {
      options.headers['X-Tenant-Slug'] = slug;
    }
    handler.next(options);
  }
}

class _AuthInterceptor extends Interceptor {
  final TokenStorage _storage;
  final ApiClient _client;
  _AuthInterceptor(this._storage, this._client);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // Rotas públicas não precisam de token
    if (_isPublicRoute(options.path)) {
      handler.next(options);
      return;
    }

    final token = await _storage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    // Token expirado — tentar refresh
    final newToken = await _client.doRefreshToken();
    if (newToken == null) {
      // Refresh falhou — logout
      await _storage.clearAll();
      handler.next(err);
      return;
    }

    // Retry com novo token
    try {
      final opts = err.requestOptions;
      opts.headers['Authorization'] = 'Bearer $newToken';
      final res = await _client._dio.fetch(opts);
      handler.resolve(res);
    } catch (e) {
      handler.next(err);
    }
  }

  bool _isPublicRoute(String path) {
    return path.contains('/auth/login')
        || path.contains('/auth/register')
        || path.contains('/auth/refresh')
        || path.contains('/auth/otp')
        || path.contains('/auth/google')
        || path.contains('/auth/ativar')   // rotas de ativação de agente
        || path.contains('/occurrences/map');
  }
}

// Extensão: métodos de ativação de conta
extension ApiClientAtivacao on ApiClient {
  Future<Map<String, dynamic>> validarCodigoAtivacao({
    required String email,
    required String codigo,
  }) async {
    final res = await _dio.post('/auth/ativar/validar', data: {
      'email':  email,
      'codigo': codigo,
    });
    return res.data as Map<String, dynamic>;
  }

  Future<void> criarSenhaAtivacao({
    required String tokenAtivacao,
    required String novaSenha,
    required String confirmarSenha,
  }) async {
    await _dio.post('/auth/ativar/criar-senha', data: {
      'tokenAtivacao':  tokenAtivacao,
      'novaSenha':      novaSenha,
      'confirmarSenha': confirmarSenha,
    });
  }
}
