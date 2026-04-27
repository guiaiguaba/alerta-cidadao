// lib/features/agent/analytics/agent_analytics_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/api/api_client.dart';
import '../../../providers/providers.dart';

// Provider de analytics do agente
final _agentAnalyticsProvider = FutureProvider.autoDispose<_AgentStats>((ref) async {
  final api    = ref.watch(apiClientProvider);
  final userId = await ref.watch(tokenStorageProvider).getUserId();

  // Carregar ocorrências do agente (últimos 30 dias)
  final res = await api.getOccurrences(
    status:     'resolved,rejected,assigned,in_progress',
    page:       1,
    limit:      100,
  );

  final items = (res['data'] as List? ?? []);

  // Calcular métricas localmente
  final assigned   = items.length;
  final resolved   = items.where((o) => o['status'] == 'resolved').length;
  final inProgress = items.where((o) => o['status'] == 'in_progress').length;
  final open       = items.where((o) => o['status'] == 'assigned').length;
  final slaBreached = items.where((o) => o['sla_breached'] == true).length;

  // Tempo médio de resolução (minutos)
  double avgMinutes = 0;
  final resolvedItems = items.where((o) =>
    o['status'] == 'resolved' &&
    o['resolved_at'] != null &&
    o['created_at'] != null
  ).toList();

  if (resolvedItems.isNotEmpty) {
    final totalMin = resolvedItems.fold<double>(0, (acc, o) {
      final created  = DateTime.tryParse(o['created_at'])  ?? DateTime.now();
      final resolved = DateTime.tryParse(o['resolved_at']) ?? DateTime.now();
      return acc + resolved.difference(created).inMinutes;
    });
    avgMinutes = totalMin / resolvedItems.length;
  }

  // Por prioridade
  final byPriority = <String, int>{};
  for (final o in items) {
    final p = o['priority'] as String? ?? 'low';
    byPriority[p] = (byPriority[p] ?? 0) + 1;
  }

  // Por categoria (top 5)
  final byCat = <String, int>{};
  for (final o in items) {
    final cat = o['category_name'] as String? ?? 'Outros';
    byCat[cat] = (byCat[cat] ?? 0) + 1;
  }
  final topCategories = (byCat.entries.toList()
    ..sort((a, b) => b.value.compareTo(a.value)))
    .take(5)
    .toList();

  // Trend por semana (últimas 4 semanas)
  final weeklyTrend = <int, int>{0: 0, 1: 0, 2: 0, 3: 0};
  final now = DateTime.now();
  for (final o in items) {
    final created = DateTime.tryParse(o['created_at'] ?? '');
    if (created == null) continue;
    final weeksAgo = now.difference(created).inDays ~/ 7;
    if (weeksAgo < 4) weeklyTrend[weeksAgo] = (weeklyTrend[weeksAgo] ?? 0) + 1;
  }

  return _AgentStats(
    total:         assigned,
    resolved:      resolved,
    inProgress:    inProgress,
    open:          open,
    slaBreached:   slaBreached,
    avgMinutes:    avgMinutes,
    byPriority:    byPriority,
    topCategories: topCategories,
    weeklyTrend:   weeklyTrend,
  );
});

class AgentAnalyticsScreen extends ConsumerWidget {
  const AgentAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(_agentAnalyticsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Meu Desempenho'),
        actions: [
          IconButton(
            icon:     const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_agentAnalyticsProvider),
          ),
        ],
      ),
      body: stats.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.amber)),
        error: (e, _) => Center(child: Text('Erro: $e', style: const TextStyle(color: AppColors.critical))),
        data: (s) => _buildBody(context, s),
      ),
    );
  }

  Widget _buildBody(BuildContext context, _AgentStats s) {
    final resolutionRate = s.total > 0 ? (s.resolved / s.total * 100) : 0.0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ==========================================
        // PERÍODO
        // ==========================================
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color:        AppColors.amber.withOpacity(0.08),
            borderRadius: BorderRadius.circular(8),
            border:       Border.all(color: AppColors.amber.withOpacity(0.2)),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.calendar_today, size: 13, color: AppColors.amber),
              SizedBox(width: 6),
              Text('Últimos 30 dias', style: TextStyle(
                fontFamily: 'IBMPlexMono', fontSize: 11,
                color: AppColors.amber, fontWeight: FontWeight.w500,
              )),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // ==========================================
        // MÉTRICAS PRINCIPAIS
        // ==========================================
        Row(
          children: [
            Expanded(child: _MetricCard(
              label: 'Total',
              value: s.total.toString(),
              color: AppColors.amber,
              icon:  Icons.list_alt,
            )),
            const SizedBox(width: 10),
            Expanded(child: _MetricCard(
              label: 'Resolvidas',
              value: s.resolved.toString(),
              color: AppColors.low,
              icon:  Icons.check_circle_outline,
            )),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _MetricCard(
              label: 'Em andamento',
              value: s.inProgress.toString(),
              color: AppColors.statusInProgress,
              icon:  Icons.engineering_outlined,
            )),
            const SizedBox(width: 10),
            Expanded(child: _MetricCard(
              label: 'SLA violado',
              value: s.slaBreached.toString(),
              color: s.slaBreached > 0 ? AppColors.critical : AppColors.low,
              icon:  Icons.timer_off_outlined,
            )),
          ],
        ),

        const SizedBox(height: 20),

        // ==========================================
        // TAXA DE RESOLUÇÃO
        // ==========================================
        _SectionCard(
          title: 'Taxa de Resolução',
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${resolutionRate.toStringAsFixed(1)}%',
                    style: const TextStyle(
                      fontFamily: 'IBMPlexMono',
                      fontSize:   32,
                      fontWeight: FontWeight.w700,
                      color:      AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    '${s.resolved}/${s.total}',
                    style: const TextStyle(
                      fontFamily: 'IBMPlexMono',
                      fontSize:   14,
                      color:      AppColors.textTertiary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value:           resolutionRate / 100,
                  backgroundColor: AppColors.muted,
                  valueColor:      AlwaysStoppedAnimation(
                    resolutionRate >= 80 ? AppColors.low
                    : resolutionRate >= 50 ? AppColors.medium
                    : AppColors.critical,
                  ),
                  minHeight: 10,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                resolutionRate >= 80
                  ? '🏆 Excelente desempenho!'
                  : resolutionRate >= 50
                  ? '📈 Bom desempenho — continue!'
                  : '⚠️ Atenção: taxa abaixo do esperado',
                style: TextStyle(
                  fontSize: 12,
                  color:    resolutionRate >= 80 ? AppColors.low
                            : resolutionRate >= 50 ? AppColors.medium
                            : AppColors.critical,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // ==========================================
        // TEMPO MÉDIO DE RESOLUÇÃO
        // ==========================================
        _SectionCard(
          title: 'Tempo Médio de Resolução',
          child: Row(
            children: [
              const Icon(Icons.speed, color: AppColors.amber, size: 32),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _formatMinutes(s.avgMinutes),
                    style: const TextStyle(
                      fontFamily: 'IBMPlexMono',
                      fontSize:   26,
                      fontWeight: FontWeight.w700,
                      color:      AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    s.avgMinutes == 0 ? 'Nenhuma resolvida ainda'
                    : s.avgMinutes < 120 ? 'Acima da meta ✅'
                    : s.avgMinutes < 480 ? 'Dentro do prazo'
                    : 'Acima do prazo ⚠️',
                    style: TextStyle(
                      fontSize: 12,
                      color:    s.avgMinutes == 0 ? AppColors.textTertiary
                                : s.avgMinutes < 120 ? AppColors.low
                                : s.avgMinutes < 480 ? AppColors.medium
                                : AppColors.critical,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // ==========================================
        // POR PRIORIDADE
        // ==========================================
        _SectionCard(
          title: 'Por Prioridade',
          child: Column(
            children: ['critical', 'high', 'medium', 'low'].map((p) {
              final count = s.byPriority[p] ?? 0;
              final max   = s.byPriority.values.fold(0, (a, b) => a > b ? a : b);
              final pct   = max > 0 ? count / max : 0.0;
              final color = AppColors.priorityColor(p);

              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    SizedBox(
                      width: 70,
                      child: Text(
                        p.toUpperCase(),
                        style: TextStyle(
                          fontFamily: 'IBMPlexMono',
                          fontSize:   9,
                          fontWeight: FontWeight.w600,
                          color:      color,
                        ),
                      ),
                    ),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(3),
                        child: LinearProgressIndicator(
                          value:           pct,
                          backgroundColor: color.withOpacity(0.12),
                          valueColor:      AlwaysStoppedAnimation(color),
                          minHeight:       8,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 28,
                      child: Text(
                        count.toString(),
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          fontFamily: 'IBMPlexMono',
                          fontSize:   12,
                          fontWeight: FontWeight.w600,
                          color:      AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),

        const SizedBox(height: 14),

        // ==========================================
        // TOP CATEGORIAS
        // ==========================================
        if (s.topCategories.isNotEmpty)
          _SectionCard(
            title: 'Categorias mais frequentes',
            child: Column(
              children: s.topCategories.asMap().entries.map((e) {
                final rank  = e.key + 1;
                final entry = e.value;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    children: [
                      Text(
                        '$rank.',
                        style: const TextStyle(
                          fontFamily: 'IBMPlexMono',
                          fontSize:   11,
                          color:      AppColors.textTertiary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(entry.key, style: const TextStyle(fontSize: 13)),
                      ),
                      Text(
                        entry.value.toString(),
                        style: const TextStyle(
                          fontFamily: 'IBMPlexMono',
                          fontSize:   12,
                          fontWeight: FontWeight.w600,
                          color:      AppColors.amber,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),

        const SizedBox(height: 14),

        // ==========================================
        // TENDÊNCIA SEMANAL
        // ==========================================
        _SectionCard(
          title: 'Tendência Semanal',
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(4, (i) {
              final week  = 3 - i; // 3=mais antiga, 0=esta semana
              final count = s.weeklyTrend[week] ?? 0;
              final max   = s.weeklyTrend.values.fold(0, (a, b) => a > b ? a : b);
              final height = max > 0 ? (count / max * 80).clamp(4.0, 80.0) : 4.0;
              final labels = ['3 sem', '2 sem', '1 sem', 'Esta'];

              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    count.toString(),
                    style: const TextStyle(
                      fontFamily: 'IBMPlexMono',
                      fontSize:   11,
                      fontWeight: FontWeight.w600,
                      color:      AppColors.amber,
                    ),
                  ),
                  const SizedBox(height: 4),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 600),
                    curve:    Curves.easeOut,
                    width:    40,
                    height:   height,
                    decoration: BoxDecoration(
                      color:        week == 0
                        ? AppColors.amber
                        : AppColors.amber.withOpacity(0.3),
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(labels[i], style: const TextStyle(
                    fontFamily: 'IBMPlexMono',
                    fontSize:   9,
                    color:      AppColors.textTertiary,
                  )),
                ],
              );
            }),
          ),
        ),

        const SizedBox(height: 32),
      ],
    );
  }

  String _formatMinutes(double m) {
    if (m <= 0)  return '—';
    if (m < 60)  return '${m.round()}min';
    final h   = (m / 60).floor();
    final min = (m % 60).round();
    return min > 0 ? '${h}h ${min}min' : '${h}h';
  }
}

class _AgentStats {
  final int    total;
  final int    resolved;
  final int    inProgress;
  final int    open;
  final int    slaBreached;
  final double avgMinutes;
  final Map<String, int> byPriority;
  final List<MapEntry<String, int>> topCategories;
  final Map<int, int> weeklyTrend;

  const _AgentStats({
    required this.total,
    required this.resolved,
    required this.inProgress,
    required this.open,
    required this.slaBreached,
    required this.avgMinutes,
    required this.byPriority,
    required this.topCategories,
    required this.weeklyTrend,
  });
}

class _MetricCard extends StatelessWidget {
  final String   label;
  final String   value;
  final Color    color;
  final IconData icon;

  const _MetricCard({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color:        color.withOpacity(0.06),
      borderRadius: BorderRadius.circular(12),
      border:       Border.all(color: color.withOpacity(0.2)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 8),
        Text(value, style: TextStyle(
          fontFamily: 'IBMPlexMono',
          fontSize:   28,
          fontWeight: FontWeight.w700,
          color:      color,
        )),
        Text(label, style: const TextStyle(
          fontSize:   11,
          color:      AppColors.textTertiary,
          fontFamily: 'IBMPlexMono',
        )),
      ],
    ),
  );
}

class _SectionCard extends StatelessWidget {
  final String   title;
  final Widget   child;

  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color:        AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      border:       Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title.toUpperCase(), style: const TextStyle(
          fontFamily: 'IBMPlexMono', fontSize: 10,
          letterSpacing: 1.0, color: AppColors.textTertiary,
        )),
        const SizedBox(height: 12),
        child,
      ],
    ),
  );
}
