// lib/core/auth/token_storage.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Armazena tokens JWT e dados de sessão com criptografia nativa
/// Android: EncryptedSharedPreferences | iOS: Keychain
class TokenStorage {
  static const _kAccessToken  = 'access_token';
  static const _kRefreshToken = 'refresh_token';
  static const _kUserId       = 'user_id';
  static const _kUserRole     = 'user_role';
  static const _kUserName     = 'user_name';
  static const _kTenantSlug   = 'tenant_slug';
  static const _kTenantId     = 'tenant_id';

  final FlutterSecureStorage _storage;

  TokenStorage()
    : _storage = const FlutterSecureStorage(
        aOptions: AndroidOptions(encryptedSharedPreferences: true),
        iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
      );

  // ==========================================
  // TOKENS
  // ==========================================

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: _kAccessToken,  value: accessToken),
      _storage.write(key: _kRefreshToken, value: refreshToken),
    ]);
  }

  Future<String?> getAccessToken()  => _storage.read(key: _kAccessToken);
  Future<String?> getRefreshToken() => _storage.read(key: _kRefreshToken);

  // ==========================================
  // USER INFO
  // ==========================================

  Future<void> saveUserInfo({
    required String userId,
    required String userRole,
    required String userName,
    required String tenantSlug,
    required String tenantId,
  }) async {
    await Future.wait([
      _storage.write(key: _kUserId,     value: userId),
      _storage.write(key: _kUserRole,   value: userRole),
      _storage.write(key: _kUserName,   value: userName),
      _storage.write(key: _kTenantSlug, value: tenantSlug),
      _storage.write(key: _kTenantId,   value: tenantId),
    ]);
  }

  Future<String?> getUserId()     => _storage.read(key: _kUserId);
  Future<String?> getUserRole()   => _storage.read(key: _kUserRole);
  Future<String?> getUserName()   => _storage.read(key: _kUserName);
  Future<String?> getTenantSlug() => _storage.read(key: _kTenantSlug);
  Future<String?> getTenantId()   => _storage.read(key: _kTenantId);

  Future<bool> isLoggedIn() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }

  // ==========================================
  // TENANT SLUG (para apps com flavor fixo)
  // ==========================================

  Future<void> saveTenantSlug(String slug) =>
    _storage.write(key: _kTenantSlug, value: slug);

  // ==========================================
  // CLEAR
  // ==========================================

  Future<void> clearTokens() async {
    await Future.wait([
      _storage.delete(key: _kAccessToken),
      _storage.delete(key: _kRefreshToken),
    ]);
  }

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
