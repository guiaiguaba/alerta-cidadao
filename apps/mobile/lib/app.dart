// lib/app.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/theme/app_theme.dart';
import 'providers/providers.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/otp_screen.dart';
import 'features/citizen/home_screen.dart';
import 'features/citizen/report_occurrence/report_screen.dart';
import 'features/citizen/my_occurrences/my_occurrences_screen.dart';
import 'features/citizen/my_occurrences/occurrence_detail_screen.dart';
import 'features/citizen/map/citizen_map_screen.dart';
import 'features/agent/home_screen.dart';
import 'features/agent/occurrence_list/agent_list_screen.dart';
import 'features/agent/occurrence_list/agent_detail_screen.dart';
import 'features/agent/map/agent_map_screen.dart';
import 'features/alerts/alerts_screen.dart';

// ==========================================
// ROUTER
// ==========================================

final _routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: GoRouterRefreshStream(
      ref.watch(authProvider.notifier).stream,
    ),

    redirect: (context, state) {
      final isLoggedIn = authState.isLoggedIn;
      final isLoading  = authState.isLoading;
      final onLogin    = state.matchedLocation == '/login' ||
                         state.matchedLocation == '/otp';

      if (isLoading) return null;

      if (!isLoggedIn && !onLogin) return '/login';

      if (isLoggedIn && onLogin) {
        // Redirecionar para a home do role correto
        final role = authState.user?.role ?? 'citizen';
        return role == 'citizen' ? '/citizen' : '/agent';
      }

      return null;
    },

    routes: [
      // ==========================================
      // AUTH
      // ==========================================
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/otp',
        name: 'otp',
        builder: (context, state) {
          final phone = state.uri.queryParameters['phone'] ?? '';
          final slug  = state.uri.queryParameters['tenant'] ?? '';
          return OtpScreen(phone: phone, tenantSlug: slug);
        },
      ),

      // ==========================================
      // CIDADÃO
      // ==========================================
      ShellRoute(
        builder: (context, state, child) => CitizenHomeScreen(child: child),
        routes: [
          GoRoute(
            path: '/citizen',
            name: 'citizen-home',
            builder: (context, state) => const CitizenMapScreen(),
          ),
          GoRoute(
            path: '/citizen/report',
            name: 'report',
            builder: (context, state) => const ReportScreen(),
          ),
          GoRoute(
            path: '/citizen/occurrences',
            name: 'my-occurrences',
            builder: (context, state) => const MyOccurrencesScreen(),
          ),
          GoRoute(
            path: '/citizen/occurrences/:id',
            name: 'occurrence-detail',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return OccurrenceDetailScreen(occurrenceId: id);
            },
          ),
          GoRoute(
            path: '/citizen/alerts',
            name: 'citizen-alerts',
            builder: (context, state) => const AlertsScreen(),
          ),
        ],
      ),

      // ==========================================
      // AGENTE
      // ==========================================
      ShellRoute(
        builder: (context, state, child) => AgentHomeScreen(child: child),
        routes: [
          GoRoute(
            path: '/agent',
            name: 'agent-home',
            builder: (context, state) => const AgentListScreen(),
          ),
          GoRoute(
            path: '/agent/occurrences/:id',
            name: 'agent-occurrence-detail',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return AgentDetailScreen(occurrenceId: id);
            },
          ),
          GoRoute(
            path: '/agent/map',
            name: 'agent-map',
            builder: (context, state) => const AgentMapScreen(),
          ),
          GoRoute(
            path: '/agent/alerts',
            name: 'agent-alerts',
            builder: (context, state) => const AlertsScreen(),
          ),
        ],
      ),
    ],

    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Página não encontrada', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => context.go('/login'),
              child: const Text('Voltar ao início'),
            ),
          ],
        ),
      ),
    ),
  );
});

// ==========================================
// APP ROOT
// ==========================================

class AlertaCidadaoApp extends ConsumerWidget {
  const AlertaCidadaoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(_routerProvider);

    return MaterialApp.router(
      title:            'Alerta Cidadão',
      theme:            AppTheme.dark,
      darkTheme:        AppTheme.dark,
      themeMode:        ThemeMode.dark,
      routerConfig:     router,
      debugShowCheckedModeBanner: false,
    );
  }
}

// Adapter para GoRouter refreshListenable
class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _sub = stream.listen((_) => notifyListeners());
  }
  late final _sub;
  @override
  void dispose() { _sub.cancel(); super.dispose(); }
}
