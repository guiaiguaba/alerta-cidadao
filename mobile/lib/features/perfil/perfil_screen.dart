import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/storage/sync_service.dart';

const _orange = Color(0xFFFF6B2B);

class PerfilScreen extends ConsumerWidget {
  const PerfilScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark   = Theme.of(context).brightness == Brightness.dark;
    final fbUser   = ref.watch(authStateProvider).valueOrNull;
    final dbUser   = ref.watch(dbUserProvider).valueOrNull;
    final pendentes = ref.read(syncServiceProvider).getPendentes();

    final bg       = isDark ? const Color(0xFF0F1117) : const Color(0xFFF4F5F7);
    final cardBg   = isDark ? const Color(0xFF21253A) : Colors.white;
    final border   = isDark ? const Color(0xFF2E3347) : const Color(0xFFE5E7EB);
    final muted    = isDark ? const Color(0xFF8B90A0) : const Color(0xFF6B7280);
    final textColor = isDark ? Colors.white : const Color(0xFF0F1117);

    final name   = dbUser?['name']  as String? ?? fbUser?.displayName ?? 'Usuário';
    final email  = dbUser?['email'] as String? ?? fbUser?.email ?? '';
    final role   = dbUser?['role']  as String? ?? 'citizen';
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'U';

    final (roleLabel, roleColor) = switch (role) {
      'admin'   => ('⚙️ Administrador', const Color(0xFFFF6B2B)),
      'agent'   => ('🦺 Agente de Campo', const Color(0xFFF97316)),
      _         => ('👤 Cidadão', const Color(0xFF22C55E)),
    };

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(title: const Text('Meu Perfil')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [

          // ── Card do usuário ─────────────────────────────
          _Card(isDark: isDark, cardBg: cardBg, border: border,
            child: Row(children: [
              // Avatar
              CircleAvatar(
                radius: 32,
                backgroundColor: _orange,
                backgroundImage: fbUser?.photoURL != null ? NetworkImage(fbUser!.photoURL!) : null,
                child: fbUser?.photoURL == null
                    ? Text(initial, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Colors.white))
                    : null,
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: textColor)),
                const SizedBox(height: 2),
                Text(email, style: TextStyle(fontSize: 12, color: muted), overflow: TextOverflow.ellipsis),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: roleColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: roleColor.withOpacity(0.3)),
                  ),
                  child: Text(roleLabel,
                    style: TextStyle(fontSize: 11, color: roleColor, fontWeight: FontWeight.w700)),
                ),
              ])),
            ]),
          ),
          const SizedBox(height: 20),

          // ── Pendentes offline ────────────────────────────
          if (pendentes.isNotEmpty) ...[
            _Card(isDark: isDark, cardBg: cardBg, border: const Color(0xFFEAB308),
              child: Row(children: [
                const Icon(Icons.cloud_upload_outlined, color: Color(0xFFEAB308), size: 22),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${pendentes.length} ocorrência(s) offline',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  Text('Serão enviadas quando houver internet',
                    style: TextStyle(fontSize: 12, color: muted)),
                ])),
                TextButton(
                  onPressed: () => ref.read(syncServiceProvider).tentarSync(),
                  child: const Text('Sync', style: TextStyle(color: _orange, fontWeight: FontWeight.w700)),
                ),
              ]),
            ),
            const SizedBox(height: 20),
          ],

          // ── Navegação ────────────────────────────────────
          _SectionLabel('NAVEGAÇÃO', muted),
          const SizedBox(height: 8),
          _Card(isDark: isDark, cardBg: cardBg, border: border,
            padding: EdgeInsets.zero,
            child: Column(children: [
              _NavTile(icon: Icons.list_alt_outlined, label: 'Minhas Ocorrências',
                color: _orange, border: border, isDark: isDark,
                onTap: () => context.go('/ocorrencias')),
              Divider(height: 1, color: border),
              _NavTile(icon: Icons.map_outlined, label: 'Mapa de Ocorrências',
                color: _orange, border: border, isDark: isDark,
                onTap: () => context.go('/mapa')),
            ]),
          ),
          const SizedBox(height: 20),

          // ── Conta ─────────────────────────────────────────
          _SectionLabel('CONTA', muted),
          const SizedBox(height: 8),
          _Card(isDark: isDark, cardBg: cardBg, border: border,
            padding: EdgeInsets.zero,
            child: _NavTile(
              icon: Icons.logout,
              label: 'Sair da conta',
              color: const Color(0xFFEF4444),
              border: border,
              isDark: isDark,
              showChevron: false,
              onTap: () async {
                await ref.read(authNotifierProvider).signOut();
                if (context.mounted) context.go('/login');
              },
            ),
          ),

          const SizedBox(height: 32),
          Center(child: Text('Alerta Cidadão v1.0.0',
            style: TextStyle(fontSize: 12, color: muted))),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  final Widget child;
  final bool isDark;
  final Color cardBg, border;
  final EdgeInsetsGeometry? padding;

  const _Card({required this.child, required this.isDark, required this.cardBg,
    required this.border, this.padding});

  @override
  Widget build(BuildContext context) => Container(
    padding: padding ?? const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: cardBg,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: border),
    ),
    child: child,
  );
}

class _NavTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color border;
  final bool isDark;
  final bool showChevron;
  final VoidCallback onTap;

  const _NavTile({required this.icon, required this.label, required this.color,
    required this.border, required this.isDark, required this.onTap, this.showChevron = true});

  @override
  Widget build(BuildContext context) {
    final textColor = isDark ? Colors.white : const Color(0xFF0F1117);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(children: [
          Container(width: 36, height: 36,
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20)),
          const SizedBox(width: 12),
          Expanded(child: Text(label,
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: color == const Color(0xFFEF4444) ? color : textColor))),
          if (showChevron)
            Icon(Icons.chevron_right, size: 18, color: isDark ? const Color(0xFF2E3347) : const Color(0xFFD1D5DB)),
        ]),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  final Color color;
  const _SectionLabel(this.text, this.color);
  @override
  Widget build(BuildContext context) => Text(text,
    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: color));
}
