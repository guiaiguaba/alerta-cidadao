import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_theme.dart';

final ocorrenciasProvider = FutureProvider.family<Map<String, dynamic>, String?>((ref, status) async {
  return ref.read(apiClientProvider).getOcorrencias(status: status, limit: 30);
});

class OcorrenciasScreen extends ConsumerStatefulWidget {
  const OcorrenciasScreen({super.key});
  @override ConsumerState<OcorrenciasScreen> createState() => _State();
}

class _State extends ConsumerState<OcorrenciasScreen> {
  String? _filter;

  static const _statuses = [
    (null,           'Todos'),
    ('aberta',       'aberta'),
    ('em_andamento', 'em andamento'),
    ('resolvida',    'resolvida'),
    ('cancelada',    'cancelada'),
  ];

  static const _statusColors = {
    'aberta':       AppColors.stAberta,
    'em_andamento': AppColors.stAndamento,
    'resolvida':    AppColors.stResolvida,
    'cancelada':    AppColors.stCancelada,
  };

  static const _priorColors = {
    'baixa':   AppColors.prioBaixa,
    'normal':  AppColors.prioNormal,
    'alta':    AppColors.prioAlta,
    'critica': AppColors.prioCritica,
  };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dbUser = ref.watch(dbUserProvider).valueOrNull;
    final role = dbUser?['role'] ?? 'citizen';
    final async = ref.watch(ocorrenciasProvider(_filter));

    return Scaffold(
      appBar: AppBar(
        title: Text(role == 'citizen' ? 'Minhas Ocorrências' : 'Todas as Ocorrências'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () => ref.invalidate(ocorrenciasProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Filter chips (laranja) ─────────────────────────
          Container(
            color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: _statuses.map((s) {
                  final selected = _filter == s.$1;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(s.$2),
                      selected: selected,
                      onSelected: (_) => setState(() => _filter = s.$1),
                      selectedColor: AppColors.orange.withOpacity(0.15),
                      checkmarkColor: AppColors.orange,
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected ? AppColors.orange : (isDark ? AppColors.darkMuted : AppColors.lightMuted),
                      ),
                      side: BorderSide(
                        color: selected ? AppColors.orange : (isDark ? AppColors.darkBorder : AppColors.lightBorder),
                        width: selected ? 1.5 : 1,
                      ),
                      backgroundColor: isDark ? AppColors.darkCard : AppColors.lightCard,
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // ── List ──────────────────────────────────────────
          Expanded(
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _ErrorState(
                message: e.toString(),
                onRetry: () => ref.invalidate(ocorrenciasProvider),
              ),
              data: (data) {
                final items = (data['data'] as List?) ?? [];
                if (items.isEmpty) return _EmptyState(role: role);
                return RefreshIndicator(
                  color: AppColors.orange,
                  onRefresh: () async => ref.invalidate(ocorrenciasProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final o = items[i] as Map<String, dynamic>;
                      final status = o['status'] as String? ?? '';
                      final prioridade = o['prioridade'] as String? ?? 'normal';
                      final statusColor = _statusColors[status] ?? AppColors.stCancelada;
                      final priorColor = _priorColors[prioridade] ?? AppColors.prioNormal;

                      return Card(
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => context.go('/ocorrencias/${o['id']}'),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    _pill(status.replaceAll('_', ' '), statusColor),
                                    const SizedBox(width: 6),
                                    _pill(prioridade, priorColor),
                                    const Spacer(),
                                    if (o['categoria_nome'] != null)
                                      Text(o['categoria_nome'] as String,
                                          style: TextStyle(fontSize: 11, color: isDark ? AppColors.darkMuted : AppColors.lightMuted)),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  o['descricao'] as String? ?? '',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: isDark ? Colors.white : const Color(0xFF1A1D27),
                                  ),
                                ),
                                if (o['created_at'] != null) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    _timeAgo(o['created_at'] as String),
                                    style: TextStyle(fontSize: 11, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
    decoration: BoxDecoration(
      color: color.withOpacity(0.12),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withOpacity(0.35)),
    ),
    child: Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w700)),
  );

  String _timeAgo(String iso) {
    try {
      final d = DateTime.parse(iso);
      final diff = DateTime.now().difference(d);
      if (diff.inMinutes < 1) return 'agora mesmo';
      if (diff.inMinutes < 60) return '${diff.inMinutes}min atrás';
      if (diff.inHours < 24) return '${diff.inHours}h atrás';
      return '${diff.inDays}d atrás';
    } catch (_) { return ''; }
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Extrai mensagem amigável
    String friendly = 'Erro ao carregar ocorrências.';
    if (message.contains('404')) friendly = 'Tenant não encontrado.\nVerifique a configuração do servidor.';
    if (message.contains('SocketException') || message.contains('connection')) friendly = 'Sem conexão com o servidor.\nVerifique se a API está rodando.';
    if (message.contains('401')) friendly = 'Sessão expirada. Faça login novamente.';

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(
                color: AppColors.danger.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.wifi_off_outlined, color: AppColors.danger, size: 32),
            ),
            const SizedBox(height: 16),
            Text(
              friendly,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF1A1D27)),
            ),
            const SizedBox(height: 8),
            Text(
              message.length > 100 ? '${message.substring(0, 100)}...' : message,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String role;
  const _EmptyState({required this.role});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('📭', style: TextStyle(fontSize: 56)),
          const SizedBox(height: 16),
          Text(
            role == 'citizen' ? 'Você ainda não tem ocorrências' : 'Nenhuma ocorrência encontrada',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF1A1D27)),
          ),
          const SizedBox(height: 8),
          Text(
            role == 'citizen' ? 'Toque em "Nova Ocorrência" para registrar' : 'Aguardando registros dos cidadãos',
            style: TextStyle(fontSize: 13, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
