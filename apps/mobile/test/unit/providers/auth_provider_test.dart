// test/unit/providers/auth_provider_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:alerta_cidadao/core/api/api_client.dart';
import 'package:alerta_cidadao/core/auth/token_storage.dart';
import 'package:alerta_cidadao/core/notifications/fcm_service.dart';
import 'package:alerta_cidadao/providers/providers.dart';

// ==========================================
// MOCKS
// ==========================================
class MockApiClient       extends Mock implements ApiClient {}
class MockTokenStorage    extends Mock implements TokenStorage {}
class MockFcmService      extends Mock implements FcmService {}

void main() {
  late MockApiClient    mockApi;
  late MockTokenStorage mockStorage;
  late MockFcmService   mockFcm;

  setUp(() {
    mockApi     = MockApiClient();
    mockStorage = MockTokenStorage();
    mockFcm     = MockFcmService();

    registerFallbackValue(<String, dynamic>{});
  });

  // ==========================================
  group('AuthState', () {
    test('estado inicial é não-logado e sem usuário', () {
      const state = AuthState();
      expect(state.isLoggedIn, isFalse);
      expect(state.user,       isNull);
      expect(state.isLoading,  isFalse);
      expect(state.error,      isNull);
    });

    test('copyWith preserva valores não modificados', () {
      const original = AuthState(isLoading: true);
      final updated  = original.copyWith(isLoading: false);
      expect(updated.isLoading, isFalse);
      expect(updated.isLoggedIn, isFalse);
      expect(updated.user,       isNull);
    });

    test('copyWith limpa error quando não fornecido', () {
      const original = AuthState(isLoading: false);
      final withError = original.copyWith(error: 'algum erro');
      expect(withError.error, equals('algum erro'));

      final cleared = withError.copyWith(isLoading: true);
      // error não é preservado pelo copyWith sem o campo explícito
      expect(cleared.error, isNull);
    });
  });

  // ==========================================
  group('AuthNotifier._parseError()', () {
    // Acesso via workaround: criar notifier e chamar método
    late AuthNotifier notifier;

    setUp(() {
      when(() => mockStorage.isLoggedIn()).thenAnswer((_) async => false);
      notifier = AuthNotifier(
        api:     mockApi,
        storage: mockStorage,
        fcm:     mockFcm,
      );
    });

    // Testamos indiretamente através do loginWithEmail
    test('loginWithEmail define error no estado quando API retorna 401', () async {
      when(() => mockStorage.saveTenantSlug(any())).thenAnswer((_) async {});
      when(() => mockApi.login(any(), any())).thenThrows(
        Exception('Response status 401'),
      );

      await notifier.loginWithEmail(
        email:      'test@test.com',
        password:   'wrongpass',
        tenantSlug: 'demo',
      );

      expect(notifier.state.isLoggedIn, isFalse);
      expect(notifier.state.error, isNotNull);
      expect(notifier.state.error, contains('incorretos'));
    });

    test('loginWithEmail define error de rede quando sem conexão', () async {
      when(() => mockStorage.saveTenantSlug(any())).thenAnswer((_) async {});
      when(() => mockApi.login(any(), any())).thenThrows(
        Exception('SocketException: No route to host'),
      );

      await notifier.loginWithEmail(
        email:      'test@test.com',
        password:   'pass',
        tenantSlug: 'demo',
      );

      expect(notifier.state.error, contains('conexão'));
    });

    test('loginWithEmail bem-sucedido define isLoggedIn=true', () async {
      final tokenResponse = {'accessToken': 'at123', 'refreshToken': 'rt456'};
      final meResponse = {
        'id': 'u1', 'name': 'Fulano', 'email': 'f@test.com',
        'role': 'citizen', 'tenantId': 't1',
      };

      when(() => mockStorage.saveTenantSlug(any())).thenAnswer((_) async {});
      when(() => mockStorage.saveTokens(accessToken: any(named: 'accessToken'), refreshToken: any(named: 'refreshToken')))
          .thenAnswer((_) async {});
      when(() => mockStorage.saveUserInfo(
        userId:     any(named: 'userId'),
        userRole:   any(named: 'userRole'),
        userName:   any(named: 'userName'),
        tenantSlug: any(named: 'tenantSlug'),
        tenantId:   any(named: 'tenantId'),
      )).thenAnswer((_) async {});
      when(() => mockStorage.getTenantSlug()).thenAnswer((_) async => 'demo');
      when(() => mockStorage.getTenantId()).thenAnswer((_) async => 't1');
      when(() => mockApi.login(any(), any())).thenAnswer((_) async => tokenResponse);
      when(() => mockApi.getMe()).thenAnswer((_) async => meResponse);
      when(() => mockFcm.getToken()).thenAnswer((_) async => 'fcm_token_123');
      when(() => mockApi.updateFcmToken(any(), any())).thenAnswer((_) async {});
      when(() => mockFcm.onTokenRefresh).thenAnswer((_) => const Stream.empty());

      await notifier.loginWithEmail(
        email:      'f@test.com',
        password:   'senha123',
        tenantSlug: 'demo',
      );

      expect(notifier.state.isLoggedIn, isTrue);
      expect(notifier.state.user?.name, equals('Fulano'));
      expect(notifier.state.user?.role, equals('citizen'));
      expect(notifier.state.error,      isNull);
    });

    test('logout limpa estado e chama API', () async {
      when(() => mockStorage.getRefreshToken()).thenAnswer((_) async => 'rt456');
      when(() => mockApi.logout(any())).thenAnswer((_) async {});
      when(() => mockFcm.getToken()).thenAnswer((_) async => 'fcm_token');
      when(() => mockApi.updateFcmToken(any(), any())).thenAnswer((_) async {});
      when(() => mockStorage.clearAll()).thenAnswer((_) async {});

      await notifier.logout();

      expect(notifier.state.isLoggedIn, isFalse);
      expect(notifier.state.user,       isNull);
      verify(() => mockStorage.clearAll()).called(1);
    });
  });

  // ==========================================
  group('OccurrencesState', () {
    test('estado inicial tem lista vazia e isLoading=true', () {
      const state = OccurrencesState();
      expect(state.items,     isEmpty);
      expect(state.isLoading, isTrue);
      expect(state.hasMore,   isTrue);
      expect(state.page,      equals(1));
      expect(state.error,     isNull);
    });

    test('copyWith com items substitui lista inteira', () {
      const original = OccurrencesState(items: []);
      final updated  = original.copyWith(isLoading: false);
      expect(updated.isLoading, isFalse);
      expect(updated.items,     isEmpty);
    });
  });

  // ==========================================
  group('AppUser helpers', () {
    test('isCitizen retorna true apenas para citizen', () {
      final citizen    = _makeUser('citizen');
      final agent      = _makeUser('agent');
      final admin      = _makeUser('admin');

      expect(citizen.isCitizen,    isTrue);
      expect(agent.isCitizen,      isFalse);
      expect(admin.isCitizen,      isFalse);
    });

    test('isAgent retorna true para agent e supervisor', () {
      final agent      = _makeUser('agent');
      final supervisor = _makeUser('supervisor');
      final citizen    = _makeUser('citizen');

      expect(agent.isAgent,       isTrue);
      expect(supervisor.isAgent,  isTrue);
      expect(citizen.isAgent,     isFalse);
    });

    test('isAdmin retorna true para admin e super_admin', () {
      final admin      = _makeUser('admin');
      final superAdmin = _makeUser('super_admin');
      final agent      = _makeUser('agent');

      expect(admin.isAdmin,      isTrue);
      expect(superAdmin.isAdmin, isTrue);
      expect(agent.isAdmin,      isFalse);
    });

    test('initials retorna 2 letras maiúsculas', () {
      final user = _makeUser('citizen', name: 'João Silva');
      expect(user.initials, equals('JS'));
    });

    test('initials com nome único retorna 2 letras', () {
      final user = _makeUser('citizen', name: 'Maria');
      expect(user.initials, equals('MA'));
    });
  });
}

AppUser _makeUser(String role, {String name = 'Test User'}) {
  return AppUser(
    id:         'u-$role',
    name:       name,
    role:       role,
    tenantId:   't1',
    tenantSlug: 'demo',
  );
}

// Importação necessária para usar AppUser diretamente
import 'package:alerta_cidadao/models/models.dart';
