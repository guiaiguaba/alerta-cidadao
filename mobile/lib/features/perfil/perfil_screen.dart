import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/storage/sync_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/theme_provider.dart';
import '../../shared/widgets/app_widgets.dart';

class PerfilScreen extends ConsumerWidget {
  const PerfilScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fbUser = ref.watch(authStateProvider).valueOrNull;
    final dbUser = ref.watch(dbUserProvider).valueOrNull;
    final pendentes = ref.read(syncServiceProvider).getPendentes();
    final isDark = ref.watch(isDarkProvider);
    final themeMode = ref.watch(themeNotifierProvider).valueOrNull ?? ThemeMode.dark;

    final name = dbUser?['name'] as String? ?? fbUser?.displayName ?? 'Usuário';
    final email = dbUser?['email'] as String? ?? fbUser?.email ?? '';
    final role = dbUser?['role'] as String? ?? 'citizen';
    final initials = name.isNotEmpty ? name[0].toUpperCase() : 'U';

    final roleConfig = {
      'citizen': ('👤 Cidadão', AppColors.info),
      'agent':   ('🦺 Agente de Campo', AppColors.medium),
      'admin':   ('⚙️ Administrador', AppColors.orange),
    }[role] ?? ('Usuário', AppColors.info);

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Avatar + info ─────────────────────────────────────
          AppCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: AppColors.orange,
                  backgroundImage: fbUser?.photoURL != null ? NetworkImage(fbUser!.photoURL!) : null,
                  child: fbUser?.photoURL == null
                      ? Text(initials, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Colors.white))
                      : null,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 2),
                      Text(email, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 12)),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: roleConfig.$2.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: roleConfig.$2.withOpacity(0.3)),
                        ),
                        child: Text(
                          roleConfig.$1,
                          style: TextStyle(fontSize: 12, color: roleConfig.$2, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Tema ──────────────────────────────────────────────
          _sectionLabel(context, 'APARÊNCIA'),
          const SizedBox(height: 10),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(isDark ? Icons.dark_mode_outlined : Icons.light_mode_outlined,
                        color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
                    const SizedBox(width: 12),
                    const Expanded(child: Text('Tema do aplicativo', style: TextStyle(fontWeight: FontWeight.w600))),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    _ThemeOption(
                      label: '🌙 Escuro',
                      selected: themeMode == ThemeMode.dark,
                      onTap: () => ref.read(themeNotifierProvider.notifier).setTheme(ThemeMode.dark),
                    ),
                    const SizedBox(width: 10),
                    _ThemeOption(
                      label: '☀️ Claro',
                      selected: themeMode == ThemeMode.light,
                      onTap: () => ref.read(themeNotifierProvider.notifier).setTheme(ThemeMode.light),
                    ),
                    const SizedBox(width: 10),
                    _ThemeOption(
                      label: '⚙️ Sistema',
                      selected: themeMode == ThemeMode.system,
                      onTap: () => ref.read(themeNotifierProvider.notifier).setTheme(ThemeMode.system),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Sync status ───────────────────────────────────────
          if (pendentes.isNotEmpty) ...[
            AppCard(
              borderColor: AppColors.medium.withOpacity(0.4),
              child: Row(
                children: [
                  const Icon(Icons.cloud_upload_outlined, color: AppColors.medium),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${pendentes.length} pendente(s) offline', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        Text('Serão enviadas quando houver internet', style: TextStyle(fontSize: 12, color: isDark ? AppColors.darkMuted : AppColors.lightMuted)),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => ref.read(syncServiceProvider).tentarSync(),
                    child: const Text('Sync'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // ── Ações ─────────────────────────────────────────────
          _sectionLabel(context, 'CONTA'),
          const SizedBox(height: 10),
          AppCard(
            child: Column(
              children: [
                _actionTile(context, Icons.list_alt_outlined, 'Minhas Ocorrências', () => context.go('/ocorrencias'), isDark),
                Divider(color: isDark ? AppColors.darkBorder : AppColors.lightBorder, height: 1),
                _actionTile(context, Icons.map_outlined, 'Ver Mapa', () => context.go('/mapa'), isDark),
                Divider(color: isDark ? AppColors.darkBorder : AppColors.lightBorder, height: 1),
                _actionTile(context, Icons.logout, 'Sair da conta', () async {
                  await ref.read(authNotifierProvider).signOut();
                  if (context.mounted) context.go('/login');
                }, isDark, color: AppColors.critical),
              ],
            ),
          ),

          const SizedBox(height: 32),
          Center(
            child: Text(
              'Alerta Cidadão v2.0.0',
              style: TextStyle(fontSize: 12, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _sectionLabel(BuildContext context, String text) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: isDark ? AppColors.darkMuted : AppColors.lightMuted));
  }

  Widget _actionTile(BuildContext context, IconData icon, String label, VoidCallback onTap, bool isDark, {Color? color}) {
    final c = color ?? (isDark ? Colors.white : const Color(0xFF1A1D27));
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: color ?? (isDark ? AppColors.darkMuted : AppColors.lightMuted), size: 20),
      title: Text(label, style: TextStyle(color: c, fontSize: 14, fontWeight: FontWeight.w500)),
      trailing: Icon(Icons.chevron_right, color: isDark ? AppColors.darkBorder : AppColors.lightBorder, size: 18),
      onTap: onTap,
    );
  }
}

class _ThemeOption extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _ThemeOption({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? AppColors.orange.withOpacity(0.15) : (isDark ? AppColors.darkBg : AppColors.lightBg),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? AppColors.orange : (isDark ? AppColors.darkBorder : AppColors.lightBorder),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: selected ? AppColors.orange : (isDark ? AppColors.darkMuted : AppColors.lightMuted),
            ),
          ),
        ),
      ),
    );
  }
}
