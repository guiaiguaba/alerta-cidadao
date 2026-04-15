import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';

class ShellScreen extends ConsumerWidget {
  final Widget child;
  const ShellScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dbUser = ref.watch(dbUserProvider).valueOrNull;
    final role = dbUser?['role'] ?? 'citizen';
    final location = GoRouterState.of(context).matchedLocation;

    int currentIndex = 0;
    if (location.startsWith('/mapa')) currentIndex = 1;
    if (location.startsWith('/perfil')) currentIndex = 2;

    return Scaffold(
      body: child,
      floatingActionButton: role != 'citizen'
          ? null
          : location.startsWith('/ocorrencias') && !location.contains('nova')
              ? FloatingActionButton.extended(
                  onPressed: () => context.go('/ocorrencias/nova'),
                  backgroundColor: const Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  icon: const Icon(Icons.add),
                  label: const Text('Nova Ocorrência'),
                )
              : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (i) {
          switch (i) {
            case 0: context.go('/ocorrencias'); break;
            case 1: context.go('/mapa'); break;
            case 2: context.go('/perfil'); break;
          }
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.list_alt_outlined),
            selectedIcon: const Icon(Icons.list_alt),
            label: role == 'citizen' ? 'Minhas' : 'Ocorrências',
          ),
          const NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'Mapa',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}
