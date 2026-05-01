// lib/providers/providers.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api/api_client.dart';
import '../core/auth/token_storage.dart';
import '../core/notifications/fcm_service.dart';
import '../core/offline/offline_queue.dart';
import '../core/offline/connectivity_service.dart';
import '../core/location/location_service.dart';
import '../core/location/geo_blocker.dart';
import 'package:flutter/material.dart';

import '../models/category.dart';
import '../models/occurrence.dart';
import '../models/user.dart';

// ==========================================
// INFRASTRUCTURE PROVIDERS (singletons)
// ==========================================

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final connectivityProvider = Provider<ConnectivityService>((ref) {
  final service = ConnectivityService();
  service.init();
  ref.onDispose(service.dispose);
  return service;
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(tokenStorageProvider);
  return ApiClient(storage: storage);
});

final offlineQueueProvider = Provider<OfflineQueueService>((ref) {
  final service = OfflineQueueService(
    api:          ref.watch(apiClientProvider),
    connectivity: ref.watch(connectivityProvider),
  );
  service.init();
  ref.onDispose(service.dispose);
  return service;
});

final locationServiceProvider = Provider<LocationService>((_) => LocationService());

final fcmServiceProvider = Provider<FcmService>((ref) {
  final service = FcmService();
  service.init();
  return service;
});

// ==========================================
// AUTH STATE
// ==========================================

class AuthState {
  final AppUser? user;
  final bool     isLoading;
  final String?  error;
  final bool     isLoggedIn;

  const AuthState({
    this.user,
    this.isLoading = false,
    this.error,
    this.isLoggedIn = false,
  });

  AuthState copyWith({
    AppUser? user,
    bool? isLoading,
    String? error,
    bool? isLoggedIn,
  }) => AuthState(
    user:       user ?? this.user,
    isLoading:  isLoading ?? this.isLoading,
    error:      error,
    isLoggedIn: isLoggedIn ?? this.isLoggedIn,
  );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient    _api;
  final TokenStorage _storage;
  final FcmService   _fcm;

  AuthNotifier({
    required ApiClient api,
    required TokenStorage storage,
    required FcmService fcm,
  })  : _api = api,
        _storage = storage,
        _fcm = fcm,
        super(const AuthState()) {
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    state = state.copyWith(isLoading: true);
    try {
      final isLoggedIn = await _storage.isLoggedIn();
      if (isLoggedIn) {
        final userData = await _api.getMe();
        final slug     = await _storage.getTenantSlug() ?? '';
        final tid      = await _storage.getTenantId() ?? '';
        final user = AppUser.fromJson({...userData, 'tenantSlug': slug, 'tenantId': tid});
        state = AuthState(user: user, isLoggedIn: true);
        await _registerFcmToken();
      } else {
        state = const AuthState();
      }
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<void> loginWithEmail({
    required String email,
    required String password,
    required String tenantSlug,
    BuildContext? context, // necessário para mostrar dialog de bloqueio
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    // Verificação geográfica (apenas app do cidadão)
    if (context != null && context.mounted) {
      try {
        await _storage.saveTenantSlug(tenantSlug);
        final permitido = await GeoBlocker.verificar(context, _api);
        if (!permitido) {
          state = state.copyWith(isLoading: false);
          return;
        }
      } catch (_) {
        // Se falhar a verificação geo, deixar seguir (não bloquear por falha técnica)
      }
    }

    try {
      await _storage.saveTenantSlug(tenantSlug);

      final res = await _api.login(email, password) as Map<String, dynamic>;

      await _storage.saveTokens(
        accessToken: res['accessToken']?.toString() ?? '',
        refreshToken: res['refreshToken']?.toString() ?? '',
      );

      final me = await _api.getMe() as Map<String, dynamic>;

      await _storage.saveUserInfo(
        userId: me['id']?.toString() ?? '',
        userRole: me['role']?.toString() ?? '',
        userName: me['name']?.toString() ?? '',
        tenantSlug: tenantSlug,
        tenantId: me['tenantId']?.toString() ?? '',
      );

      final user = AppUser.fromJson({
        ...me,
        'tenantSlug': tenantSlug,
        'tenantId': me['tenantId']?.toString() ?? '',
      });

      state = AuthState(user: user, isLoggedIn: true);

      await _registerFcmToken();

    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: _parseError(e),
        isLoggedIn: false,
      );
    }
  }

  Future<void> loginWithOtp(String phone, String code, String tenantSlug) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _storage.saveTenantSlug(tenantSlug);
      final res = await _api.verifyOtp(phone, code);
      await _afterLoginSuccess(res, tenantSlug);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _parseError(e));
    }
  }

  Future<void> loginWithGoogle(String idToken, String tenantSlug) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _storage.saveTenantSlug(tenantSlug);
      final res = await _api.googleAuth(idToken);
      await _afterLoginSuccess(res, tenantSlug);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _parseError(e));
    }
  }

  Future<void> _afterLoginSuccess(
      Map<String, dynamic> res,
      String tenantSlug,
      ) async {
    await _storage.saveTokens(
      accessToken: res['accessToken']?.toString() ?? '',
      refreshToken: res['refreshToken']?.toString() ?? '',
    );

    final meRaw = await _api.getMe();

    final me = meRaw as Map<String, dynamic>;

    await _storage.saveUserInfo(
      userId: me['id']?.toString() ?? '',
      userRole: me['role']?.toString() ?? '',
      userName: me['name']?.toString() ?? '',
      tenantSlug: tenantSlug,
      tenantId: me['tenantId']?.toString() ?? '',
    );

    final user = AppUser.fromJson({
      ...me,
      'tenantSlug': tenantSlug,
      'tenantId': me['tenantId']?.toString() ?? '',
    });

    state = AuthState(user: user, isLoggedIn: true);

    await _registerFcmToken();
  }

  Future<void> logout() async {
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken != null) {
        await _api.logout(refreshToken);
      }
      // Remover token FCM
      final fcmToken = await _fcm.getToken();
      if (fcmToken != null) {
        await _api.updateFcmToken(fcmToken, 'remove');
      }
    } catch (_) {}
    await _storage.clearAll();
    state = const AuthState();
  }

  Future<void> _registerFcmToken() async {
    try {
      final token = await _fcm.getToken();
      if (token != null) {
        await _api.updateFcmToken(token, 'add');
      }
      // Renovar token automaticamente
      _fcm.onTokenRefresh.listen((newToken) {
        _api.updateFcmToken(newToken, 'add');
      });
    } catch (_) {}
  }

  String _parseError(dynamic e) {
    if (e is Exception) {
      final msg = e.toString();
      if (msg.contains('401') || msg.contains('inválid')) return 'E-mail ou senha incorretos.';
      if (msg.contains('403'))  return 'Acesso negado.';
      if (msg.contains('429'))  return 'Muitas tentativas. Aguarde e tente novamente.';
      if (msg.contains('network') || msg.contains('SocketException')) {
        return 'Sem conexão. Verifique o Wi-Fi ou dados móveis.';
      }
    }
    return 'Erro inesperado. Tente novamente.';
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    api:     ref.watch(apiClientProvider),
    storage: ref.watch(tokenStorageProvider),
    fcm:     ref.watch(fcmServiceProvider),
  );
});

// ==========================================
// OCCURRENCES PROVIDER
// ==========================================

class OccurrencesState {
  final List<Occurrence> items;
  final bool  isLoading;
  final bool  hasMore;
  final int   page;
  final String? error;
  final Map<String, String> filters;

  const OccurrencesState({
    this.items    = const [],
    this.isLoading = true,
    this.hasMore  = true,
    this.page     = 1,
    this.error,
    this.filters  = const {},
  });

  OccurrencesState copyWith({
    List<Occurrence>? items,
    bool? isLoading,
    bool? hasMore,
    int? page,
    String? error,
    Map<String, String>? filters,
  }) => OccurrencesState(
    items:     items     ?? this.items,
    isLoading: isLoading ?? this.isLoading,
    hasMore:   hasMore   ?? this.hasMore,
    page:      page      ?? this.page,
    error:     error,
    filters:   filters   ?? this.filters,
  );
}

class OccurrencesNotifier extends StateNotifier<OccurrencesState> {
  final ApiClient _api;

  OccurrencesNotifier(this._api) : super(const OccurrencesState()) {
    load();
  }

  Future<void> load({bool refresh = true}) async {
    if (refresh) {
      state = state.copyWith(isLoading: true, page: 1, error: null);
    }

    try {
      final res = await _api.getOccurrences(
        status:     state.filters['status'],
        priority:   state.filters['priority'],
        regionCode: state.filters['regionCode'],
        page:       refresh ? 1 : state.page,
      );

      final raw  = (res['data'] as List?) ?? [];
      final meta = res['meta'] as Map<String, dynamic>? ?? {};

      final newItems = raw.map((j) => Occurrence.fromJson(j as Map<String, dynamic>)).toList();
      final total    = meta['total'] as int? ?? 0;
      final limit    = meta['limit'] as int? ?? 20;

      state = state.copyWith(
        items:     refresh ? newItems : [...state.items, ...newItems],
        isLoading: false,
        page:      refresh ? 2 : state.page + 1,
        hasMore:   (state.items.length + newItems.length) < total,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (!state.hasMore || state.isLoading) return;
    await load(refresh: false);
  }

  void setFilters(Map<String, String> filters) {
    state = state.copyWith(filters: filters);
    load();
  }

  void updateOccurrenceStatus(String id, String newStatus) {
    state = state.copyWith(
      items: state.items.map((o) =>
        o.id == id ? (o..status = newStatus) : o
      ).toList(),
    );
  }
}

final occurrencesProvider =
    StateNotifierProvider<OccurrencesNotifier, OccurrencesState>((ref) {
  return OccurrencesNotifier(ref.watch(apiClientProvider));
});

// ==========================================
// CATEGORIES PROVIDER (com cache offline)
// ==========================================

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  final offline = ref.watch(offlineQueueProvider);
  final api     = ref.watch(apiClientProvider);

  try {
    final data  = await api.getCategories();
    final cats  = data.map((j) => Category.fromJson(j as Map<String, dynamic>)).toList();
    // Cachear para uso offline
    await offline.cacheCategories(data.cast<Map<String, dynamic>>());
    return cats;
  } catch (_) {
    // Fallback: usar cache
    final cached = await offline.getCachedCategories();
    if (cached.isNotEmpty) {
      return cached.map(Category.fromJson).toList();
    }
    return [];
  }
});

// ==========================================
// CONNECTIVITY PROVIDER (stream)
// ==========================================

final connectivityStreamProvider = StreamProvider<bool>((ref) {
  return ref.watch(connectivityProvider).onConnectivityChanged;
});

final isOnlineProvider = Provider<bool>((ref) {
  final stream = ref.watch(connectivityStreamProvider);
  return stream.when(
    data:    (v)  => v,
    loading: ()   => true,
    error:   (_,__) => false,
  );
});

// ==========================================
// OFFLINE SYNC PROVIDER
// ==========================================

final pendingSyncCountProvider = Provider<int>((ref) {
  return ref.watch(offlineQueueProvider).pendingCount;
});
