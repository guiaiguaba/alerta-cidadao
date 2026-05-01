// lib/features/agent/analytics/agent_analytics_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/providers.dart';

// Provider de analytics do agente
final _agentAnalyticsProvider = FutureProvider.autoDispose<_AgentStats>((ref) async {
  final api = ref.watch(apiClientProvider);

  final res = await api.getOccurrences(
    status: 'resolved,rejected,assigned,in_progress',
    page: 1,
    limit: 100,
  );

  // ✅ CORREÇÃO: tipagem segura
  final items = (res['data'] as List? ?? [])
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();

  // ================================
  // MÉTRICAS
  // ================================
  final assigned   = items.length;
  final resolved   = items.where((o) => o['status'] == 'resolved').length;
  final inProgress = items.where((o) => o['status'] == 'in_progress').length;
  final open       = items.where((o) => o['status'] == 'assigned').length;
  final slaBreached = items.where((o) => o['sla_breached'] == true).length;

  // ================================
  // TEMPO MÉDIO
  // ================================
  double avgMinutes = 0;

  final resolvedItems = items.where((o) =>
  o['status'] == 'resolved' &&
      o['resolved_at'] != null &&
      o['created_at'] != null
  ).toList();

  if (resolvedItems.isNotEmpty) {
    final totalMin = resolvedItems.fold<double>(0, (acc, o) {
      final created  = DateTime.tryParse(o['created_at']?.toString() ?? '');
      final resolved = DateTime.tryParse(o['resolved_at']?.toString() ?? '');

      if (created == null || resolved == null) return acc;

      return acc + resolved.difference(created).inMinutes;
    });

    avgMinutes = totalMin / resolvedItems.length;
  }

  // ================================
  // POR PRIORIDADE
  // ================================
  final byPriority = <String, int>{};

  for (final o in items) {
    final p = (o['priority'] ?? 'low').toString();
    byPriority[p] = (byPriority[p] ?? 0) + 1;
  }

  // ================================
  // POR CATEGORIA
  // ================================
  final byCat = <String, int>{};

  for (final o in items) {
    final cat = (o['category_name'] ?? 'Outros').toString();
    byCat[cat] = (byCat[cat] ?? 0) + 1;
  }

  final topCategories = (byCat.entries.toList()
    ..sort((a, b) => b.value.compareTo(a.value)))
      .take(5)
      .toList();

  // ================================
  // TREND SEMANAL
  // ================================
  final weeklyTrend = <int, int>{0: 0, 1: 0, 2: 0, 3: 0};
  final now = DateTime.now();

  for (final o in items) {
    final created = DateTime.tryParse(o['created_at']?.toString() ?? '');
    if (created == null) continue;

    final weeksAgo = now.difference(created).inDays ~/ 7;
    if (weeksAgo < 4) {
      weeklyTrend[weeksAgo] = (weeklyTrend[weeksAgo] ?? 0) + 1;
    }
  }


  return _AgentStats(
    total: assigned,
    resolved: resolved,
    inProgress: inProgress,
    open: open,
    slaBreached: slaBreached,
    avgMinutes: avgMinutes,
    byPriority: byPriority,
    topCategories: topCategories,
    weeklyTrend: weeklyTrend,
  );
});

class _AgentStats {
  final int total; final int resolved; final int inProgress; final int open; final int slaBreached; final double avgMinutes; final Map<String, int> byPriority; final List<MapEntry<String, int>> topCategories; final Map<int, int> weeklyTrend; const _AgentStats({ required this.total, required this.resolved, required this.inProgress, required this.open, required this.slaBreached, required this.avgMinutes, required this.byPriority, required this.topCategories, required this.weeklyTrend, });

}

