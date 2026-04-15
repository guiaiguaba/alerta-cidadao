import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/storage/sync_service.dart';

class PerfilScreen extends ConsumerWidget {
  const PerfilScreen({super.key});

  static const _roleLabels = {
    'citizen': '👤 Cidadão',
    'agent': '🦺 Agente',
    'admin': '⚙️ Administrador',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fbUser = ref.watch(authStateProvider).valueOrNull;
    final dbUser = ref.watch(dbUserProvider).valueOrNull;
    final pendentes = ref.read(syncServiceProvider).getPendentes();

    return Scaffold(
      appBar: AppBar(title: const Text('Meu Perfil')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Avatar + nome
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 44,
                  backgroundColor: const Color(0xFF1D4ED8),
                  backgroundImage: fbUser?.photoURL != null ? NetworkImage(fbUser!.photoURL!) : null,
                  child: fbUser?.photoURL == null
                      ? Text(
                          (dbUser?['name'] as String? ?? fbUser?.displayName ?? 'U')[0].toUpperCase(),
                          style: const TextStyle(fontSize: 32, color: Colors.white),
                        )
                      : null,
                ),
                const SizedBox(height: 12),
                Text(
                  dbUser?['name'] as String? ?? fbUser?.displayName ?? 'Usuário',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  dbUser?['email'] as String? ?? fbUser?.email ?? '',
                  style: const TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1D4ED8).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _roleLabels[dbUser?['role']] ?? dbUser?['role'] ?? '—',
                    style: const TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          const Divider(),

          // Sincronização
          if (pendentes.isNotEmpty) ...[
            ListTile(
              leading: const Icon(Icons.cloud_upload_outlined, color: Colors.orange),
              title: Text('${pendentes.length} ocorrência(s) pendente(s) de envio'),
              subtitle: const Text('Aguardando conexão à internet'),
              trailing: TextButton(
                onPressed: () => ref.read(syncServiceProvider).tentarSync(),
                child: const Text('Sincronizar'),
              ),
            ),
            const Divider(),
          ],

          // Opções
          _option(
            icon: Icons.list_alt_outlined,
            label: 'Minhas Ocorrências',
            onTap: () => context.go('/ocorrencias'),
          ),
          _option(
            icon: Icons.map_outlined,
            label: 'Ver Mapa',
            onTap: () => context.go('/mapa'),
          ),
          const Divider(),
          _option(
            icon: Icons.logout,
            label: 'Sair',
            color: Colors.red,
            onTap: () async {
              await ref.read(authNotifierProvider).signOut();
              if (context.mounted) context.go('/login');
            },
          ),

          const SizedBox(height: 32),
          const Center(
            child: Text('Alerta Cidadão v1.0.0', style: TextStyle(color: Colors.grey, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Widget _option({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? color,
  }) =>
      ListTile(
        leading: Icon(icon, color: color ?? const Color(0xFF1D4ED8)),
        title: Text(label, style: TextStyle(color: color)),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
        onTap: onTap,
      );
}
