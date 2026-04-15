import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/login_screen.dart';
import '../features/ocorrencias/ocorrencias_screen.dart';
import '../shared/widgets/shell_screen.dart';
import '../core/auth/auth_provider.dart';
import '../features/ocorrencias/nova_ocorrencia_screen.dart';
import '../features/ocorrencias/detalhe_ocorrencia_screen.dart';
import '../features/mapa/mapa_screen.dart';
import '../features/perfil/perfil_screen.dart';


final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull != null;
      final isLoginRoute = state.matchedLocation == '/login';

      if (!isLoggedIn && !isLoginRoute) return '/login';
      if (isLoggedIn && isLoginRoute) return '/ocorrencias';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (_, __, child) => ShellScreen(child: child),
        routes: [
          GoRoute(
            path: '/ocorrencias',
            builder: (_, __) => const OcorrenciasScreen(),
            routes: [
              GoRoute(
                path: 'nova',
                builder: (_, __) => const NovaOcorrenciaScreen(),
              ),
              GoRoute(
                path: ':id',
                builder: (_, state) =>
                    DetalheOcorrenciaScreen(id: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(
            path: '/mapa',
            builder: (_, __) => const MapaScreen(),
          ),
          GoRoute(
            path: '/perfil',
            builder: (_, __) => const PerfilScreen(),
          ),
        ],
      ),
    ],
  );
});
