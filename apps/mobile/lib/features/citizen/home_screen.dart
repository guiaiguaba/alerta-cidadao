// lib/features/citizen/home_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/providers.dart';
import '../../shared/widgets/offline_banner.dart';

class CitizenHomeScreen extends ConsumerWidget {
  final Widget child;
  const CitizenHomeScreen({super.key, required this.child});

  static const _tabs = [
    _TabItem(icon: Icons.map_outlined,         activeIcon: Icons.map,         label: 'Mapa',       path: '/citizen'),
    _TabItem(icon: Icons.add_circle_outline,   activeIcon: Icons.add_circle,  label: 'Registrar',  path: '/citizen/report'),
    _TabItem(icon: Icons.list_alt_outlined,    activeIcon: Icons.list_alt,    label: 'Minhas',     path: '/citizen/occurrences'),
    _TabItem(icon: Icons.notifications_outlined, activeIcon: Icons.notifications, label: 'Alertas', path: '/citizen/alerts'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location   = GoRouterState.of(context).matchedLocation;
    final pendingSync = ref.watch(pendingSyncCountProvider);

    int currentIndex = 0;
    for (int i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path) && _tabs[i].path != '/citizen') {
        currentIndex = i;
        break;
      }
      if (_tabs[i].path == '/citizen' && location == '/citizen') {
        currentIndex = 0;
      }
    }

    return Scaffold(
      body: Column(
        children: [
          // Banner offline + sync pendente
          OfflineBanner(pendingCount: pendingSync),
          Expanded(child: child),
        ],
      ),
      floatingActionButton: location == '/citizen'
        ? FloatingActionButton(
            onPressed: () => context.push('/citizen/report'),
            backgroundColor: AppColors.amber,
            foregroundColor: Colors.black,
            child: const Icon(Icons.add, size: 28),
          )
        : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: _tabs.asMap().entries.map((e) {
          final tab       = e.value;
          final isActive  = e.key == currentIndex;
          final hasBadge  = tab.path == '/citizen/occurrences' && pendingSync > 0;

          return NavigationDestination(
            icon: hasBadge
              ? Badge(
                  label: Text('$pendingSync'),
                  child: Icon(tab.icon),
                )
              : Icon(tab.icon),
            selectedIcon: Icon(tab.activeIcon),
            label: tab.label,
          );
        }).toList(),
      ),
    );
  }
}

// ============================================================

// lib/features/agent/home_screen.dart
class AgentHomeScreen extends ConsumerWidget {
  final Widget child;
  const AgentHomeScreen({super.key, required this.child});

  static const _tabs = [
    _TabItem(icon: Icons.list_alt_outlined,    activeIcon: Icons.list_alt,    label: 'Ocorrências', path: '/agent'),
    _TabItem(icon: Icons.map_outlined,         activeIcon: Icons.map,         label: 'Mapa',        path: '/agent/map'),
    _TabItem(icon: Icons.notifications_outlined, activeIcon: Icons.notifications, label: 'Alertas', path: '/agent/alerts'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location   = GoRouterState.of(context).matchedLocation;
    final pendingSync = ref.watch(pendingSyncCountProvider);
    final user       = ref.watch(authProvider).user;

    int currentIndex = 0;
    for (int i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path) && _tabs[i].path != '/agent') {
        currentIndex = i;
        break;
      }
      if (_tabs[i].path == '/agent' && location == '/agent') {
        currentIndex = 0;
      }
    }

    return Scaffold(
      appBar: currentIndex == 0
        ? AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Alerta Cidadão', style: TextStyle(fontSize: 16)),
                Text(
                  user?.name ?? 'Agente',
                  style: const TextStyle(
                    fontSize:    11,
                    color:       AppColors.textTertiary,
                    fontFamily:  'IBMPlexMono',
                  ),
                ),
              ],
            ),
            actions: [
              // Sync badge
              if (pendingSync > 0)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: IconButton(
                    icon: Badge(
                      label: Text('$pendingSync'),
                      child: const Icon(Icons.sync),
                    ),
                    onPressed: () => ref.read(offlineQueueProvider).syncPending(),
                    tooltip: 'Sincronizar pendentes',
                  ),
                ),
              // Avatar
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: GestureDetector(
                  onTap: () => _showProfileMenu(context, ref),
                  child: CircleAvatar(
                    radius: 16,
                    backgroundColor: AppColors.amber.withOpacity(0.15),
                    child: Text(
                      user?.initials ?? 'A',
                      style: const TextStyle(
                        fontSize:   12,
                        fontWeight: FontWeight.w700,
                        color:      AppColors.amber,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          )
        : null,
      body: Column(
        children: [
          OfflineBanner(pendingCount: pendingSync),
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: _tabs.map((tab) => NavigationDestination(
          icon:         Icon(tab.icon),
          selectedIcon: Icon(tab.activeIcon),
          label:        tab.label,
        )).toList(),
      ),
    );
  }

  void _showProfileMenu(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context:         context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.logout, color: AppColors.critical),
              title:   const Text('Sair', style: TextStyle(color: AppColors.critical)),
              onTap:   () {
                Navigator.pop(context);
                ref.read(authProvider.notifier).logout();
              },
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// SHARED DATA
// ============================================================

class _TabItem {
  final IconData activeIcon;
  final IconData icon;
  final String   label;
  final String   path;

  const _TabItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.path,
  });
}
