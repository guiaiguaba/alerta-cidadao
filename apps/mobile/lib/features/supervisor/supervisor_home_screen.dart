// lib/features/supervisor/supervisor_home_screen.dart
// App do Supervisor — ocorrências, atribuição a agentes, relatórios e envio de alertas
/*
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/app_colors.dart';
import '../../models/occurrence.dart';
import '../../providers/providers.dart';
import '../../shared/widgets/offline_banner.dart';
import '../../shared/widgets/municipal_header.dart';
import '../../shared/widgets/widgets.dart';

// ════════════════════════════════════════════════════════════
// SHELL DO SUPERVISOR
// ════════════════════════════════════════════════════════════
class SupervisorHomeScreen extends ConsumerWidget {
  final Widget child;
  const SupervisorHomeScreen({super.key, required this.child});

  static const _tabs = [
    _Tab(Icons.warning_amber_outlined, Icons.warning_amber, 'Ocorrências', '/supervisor'),
    _Tab(Icons.people_outline,         Icons.people,        'Agentes',     '/supervisor/agents'),
    _Tab(Icons.bar_chart_outlined,     Icons.bar_chart,     'Relatórios',  '/supervisor/reports'),
    _Tab(Icons.send_outlined,          Icons.send,          'Alertas',     '/supervisor/alerts'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location    = GoRouterState.of(context).matchedLocation;
    final pendingSync = ref.watch(pendingSyncCountProvider);
    final user        = ref.watch(authProvider).user;

    int idx = 0;
    for (int i = 0; i < _tabs.length; i++) {
      if (location.startsWith(_tabs[i].path) && _tabs[i].path != '/supervisor') { idx = i; break; }
      if (_tabs[i].path == '/supervisor' && location == '/supervisor') idx = 0;
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        centerTitle: false,
        title: MunicipalTitle(subtitulo: '${user?.name ?? 'Supervisor'} · Supervisor'),
        actions: [
          // Badge de sync
          if (pendingSync > 0)
            IconButton(
              icon: Badge(label: Text('$pendingSync'), child: const Icon(Icons.sync, size: 20)),
              onPressed: () => ref.read(offlineQueueProvider).syncPending(),
            ),
          // Avatar
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: GestureDetector(
              onTap: () => _showMenu(context, ref, user?.name ?? ''),
              child: CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.violet.withOpacity(0.15),
                child: Text(
                  _initials(user?.name),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.violet),
                ),
              ),
            ),
          ),
        ],
      ),
      body: Column(children: [
        OfflineBanner(pendingCount: pendingSync),
        Expanded(child: child),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: idx,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: _tabs.map((t) => NavigationDestination(
            icon: Icon(t.icon), selectedIcon: Icon(t.activeIcon), label: t.label)).toList(),
      ),
    );
  }

  String _initials(String? n) {
    if (n == null || n.isEmpty) return 'S';
    final p = n.trim().split(' ');
    return p.length >= 2 ? '${p[0][0]}${p[1][0]}'.toUpperCase() : p[0][0].toUpperCase();
  }

  void _showMenu(BuildContext context, WidgetRef ref, String nome) {
    showModalBottomSheet(
      context: context, backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          CircleAvatar(radius: 24, backgroundColor: AppColors.violet.withOpacity(0.15),
              child: Text(_initials(nome), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.violet))),
          const SizedBox(height: 8),
          Text(nome, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const Text('Supervisor', style: TextStyle(fontSize: 11, color: AppColors.textTertiary, fontFamily: 'IBMPlexMono')),
          const Divider(height: 24),
          ListTile(
            leading: const Icon(Icons.logout, color: AppColors.critical),
            title: const Text('Sair', style: TextStyle(color: AppColors.critical)),
            onTap: () { Navigator.pop(context); ref.read(authProvider.notifier).logout(); },
          ),
        ]),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════
// ABA 1: OCORRÊNCIAS — com atribuição de agente
// ════════════════════════════════════════════════════════════
class SupervisorOccurrencesScreen extends ConsumerStatefulWidget {
  const SupervisorOccurrencesScreen({super.key});
  @override
  ConsumerState<SupervisorOccurrencesScreen> createState() => _SupervisorOccurrencesState();
}

class _SupervisorOccurrencesState extends ConsumerState<SupervisorOccurrencesScreen> {
  List<Occurrence> _occs    = [];
  List<Map>        _agents  = [];
  bool             _loading = true;
  String           _filter  = 'open';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final [occsRes, agentsRes] = await Future.wait([
        api.getOccurrences(status: _filter == 'all' ? null : _filter, limit: 50),
        api.getAgents(),
      ]);
      setState(() {
        _occs   = (occsRes['data'] as List).map((j) => Occurrence.fromJson(j)).toList();
        _agents = List<Map>.from(agentsRes as List);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _assign(String occId, String agentId, String agentName) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.assignOccurrence(occId, agentId);
      setState(() {
        _occs = _occs.map((o) {
          if (o.id == occId) return o.copyWith(assignedToName: agentName, status: 'assigned');
          return o;
        }).toList();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Atribuído a $agentName'),
          backgroundColor: AppColors.low,
          duration: const Duration(seconds: 2),
        ));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Erro ao atribuir'), backgroundColor: AppColors.critical));
    }
  }

  @override
  Widget build(BuildContext context) {
    final filters = [
      ('all', 'Todos'), ('open', 'Aberta'), ('assigned', 'Atribuída'),
      ('in_progress', 'Em Andamento'), ('resolved', 'Resolvida'),
    ];

    return Scaffold(
      backgroundColor: AppColors.base,
      body: Column(children: [
        // Filtros de status
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(children: filters.map((f) {
            final active = _filter == f.$1;
            return Padding(
              padding: const EdgeInsets.only(right: 6),
              child: GestureDetector(
                onTap: () { setState(() => _filter = f.$1); _load(); },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: active ? AppColors.amber.withOpacity(0.12) : AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: active ? AppColors.amber.withOpacity(0.4) : AppColors.border),
                  ),
                  child: Text(f.$2, style: TextStyle(
                    fontSize: 11, fontFamily: 'IBMPlexMono', fontWeight: FontWeight.w600,
                    color: active ? AppColors.amber : AppColors.textSecondary,
                  )),
                ),
              ),
            );
          }).toList()),
        ),
        // Lista
        Expanded(child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.amber))
            : _occs.isEmpty
            ? const Center(child: Text('Nenhuma ocorrência', style: TextStyle(color: AppColors.textSecondary)))
            : RefreshIndicator(
          color: AppColors.amber,
          onRefresh: _load,
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            itemCount: _occs.length,
            itemBuilder: (_, i) => _OccurrenceCard(
              occ: _occs[i],
              agents: _agents,
              onAssign: _assign,
            ),
          ),
        ),
        ),
      ]),
    );
  }
}

class _OccurrenceCard extends StatelessWidget {
  final Occurrence occ;
  final List<Map>  agents;
  final Future<void> Function(String occId, String agentId, String agentName) onAssign;

  const _OccurrenceCard({required this.occ, required this.agents, required this.onAssign});

  @override
  Widget build(BuildContext context) {
    final color = AppColors.priorityColor(occ.priority);

    return GestureDetector(
      onTap: () => _showDetail(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border(
            left: BorderSide(color: color, width: 3),
            top: BorderSide(color: AppColors.border),
            right: BorderSide(color: AppColors.border),
            bottom: BorderSide(color: AppColors.border),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(13),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              PriorityBadge(priority: occ.priority),
              const SizedBox(width: 6),
              StatusBadge(status: occ.status),
              const Spacer(),
              Text(occ.protocol, style: const TextStyle(
                  fontSize: 9, fontFamily: 'IBMPlexMono', color: AppColors.amber, fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 8),
            Text(occ.categoryName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            if (occ.address != null)
              Text(occ.address!, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            const SizedBox(height: 8),
            Row(children: [
              // Agente atribuído
              if (occ.assignedToName != null)
                Row(children: [
                  const Icon(Icons.person, size: 12, color: AppColors.info),
                  const SizedBox(width: 3),
                  Text(occ.assignedToName!, style: const TextStyle(fontSize: 10, color: AppColors.info, fontFamily: 'IBMPlexMono')),
                ])
              else
                const Text('Sem agente', style: TextStyle(fontSize: 10, color: AppColors.textTertiary, fontFamily: 'IBMPlexMono')),
              const Spacer(),
              // Botão de atribuição
              if (occ.status == 'open' || occ.assignedToName == null)
                GestureDetector(
                  onTap: () => _showAssignSheet(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.amber.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.amber.withOpacity(0.3)),
                    ),
                    child: const Text('Atribuir', style: TextStyle(
                        fontSize: 10, fontFamily: 'IBMPlexMono', color: AppColors.amber, fontWeight: FontWeight.w600)),
                  ),
                ),
            ]),
          ]),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.7, maxChildSize: 0.92, minChildSize: 0.4, expand: false,
        builder: (_, ctrl) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(width: 40, height: 4,
                decoration: BoxDecoration(color: AppColors.muted, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Text(occ.protocol, style: const TextStyle(fontSize: 11, fontFamily: 'IBMPlexMono', color: AppColors.amber)),
            const SizedBox(height: 4),
            Text(occ.categoryName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            if (occ.address != null) Text(occ.address!, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 14),
            Row(children: [PriorityBadge(priority: occ.priority), const SizedBox(width: 8), StatusBadge(status: occ.status)]),
            const SizedBox(height: 14),
            if (occ.description != null) Text(occ.description!, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.5)),
            const Spacer(),
            if (occ.status == 'open' || occ.assignedToName == null)
              SizedBox(width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () { Navigator.pop(context); _showAssignSheet(context); },
                    child: const Text('Atribuir a agente'),
                  )),
          ]),
        ),
      ),
    );
  }

  void _showAssignSheet(BuildContext context) {
    showModalBottomSheet(
      context: context, backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Atribuir ocorrência', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          Text(occ.categoryName, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(height: 16),
          const Text('AGENTES DISPONÍVEIS', style: TextStyle(
              fontSize: 9, fontFamily: 'IBMPlexMono', color: AppColors.textTertiary, letterSpacing: 1)),
          const SizedBox(height: 8),
          ...agents.map((agent) => ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
                radius: 18, backgroundColor: AppColors.amber.withOpacity(0.12),
                child: Text((agent['nome'] as String? ?? '?')[0].toUpperCase(),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.amber))),
            title: Text(agent['nome'] as String? ?? '—', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            subtitle: Text('${agent['ocorrencias_ativas'] ?? 0} ocorrências ativas',
                style: const TextStyle(fontSize: 10, fontFamily: 'IBMPlexMono', color: AppColors.textTertiary)),
            trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: AppColors.textTertiary),
            onTap: () {
              Navigator.pop(context);
              onAssign(occ.id, agent['id'] as String, agent['nome'] as String);
            },
          )),
        ]),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════
// ABA 2: AGENTES — visão rápida de status
// ════════════════════════════════════════════════════════════
class SupervisorAgentsScreen extends ConsumerWidget {
  const SupervisorAgentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.base,
      body: FutureBuilder(
        future: ref.read(apiClientProvider).getAgents(),
        builder: (_, snap) {
          if (snap.connectionState == ConnectionState.waiting)
            return const Center(child: CircularProgressIndicator(color: AppColors.amber));
          if (snap.hasError)
            return const Center(child: Text('Erro ao carregar agentes', style: TextStyle(color: AppColors.critical)));

          final agents = List<Map>.from(snap.data as List);
          final ativos  = agents.where((a) => a['ativo'] == true).toList();

          return ListView(padding: const EdgeInsets.all(14), children: [
            // Resumo
            Row(children: [
              _StatCard('Ativos', '${ativos.length}', AppColors.low),
              const SizedBox(width: 10),
              _StatCard('Em campo', '${ativos.where((a) => (a['ocorrencias_ativas'] ?? 0) > 0).length}', AppColors.amber),
              const SizedBox(width: 10),
              _StatCard('Disponíveis', '${ativos.where((a) => (a['ocorrencias_ativas'] ?? 0) == 0).length}', AppColors.info),
            ]),
            const SizedBox(height: 16),
            ...agents.map((a) {
              final ativas = a['ocorrencias_ativas'] as int? ?? 0;
              final ocupado = ativas > 0;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: AppColors.surface, borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: (ocupado ? AppColors.amber : AppColors.low).withOpacity(0.12),
                    child: Text(
                        (a['nome'] as String? ?? '?').split(' ').take(2).map((p) => p[0]).join().toUpperCase(),
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                            color: ocupado ? AppColors.amber : AppColors.low)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(a['nome'] as String? ?? '—', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                    Text(ocupado ? '$ativas ocorrência(s) ativa(s)' : 'Disponível',
                        style: TextStyle(fontSize: 10, fontFamily: 'IBMPlexMono',
                            color: ocupado ? AppColors.amber : AppColors.low)),
                  ])),
                  Container(
                    width: 8, height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: a['ativo'] == true ? AppColors.low : AppColors.critical,
                    ),
                  ),
                ]),
              );
            }),
          ]);
        },
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════
// ABA 3: RELATÓRIOS — métricas rápidas
// ════════════════════════════════════════════════════════════
class SupervisorReportsScreen extends ConsumerWidget {
  const SupervisorReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.base,
      body: FutureBuilder(
        future: ref.read(apiClientProvider).getAnalytics(),
        builder: (_, snap) {
          if (snap.connectionState == ConnectionState.waiting)
            return const Center(child: CircularProgressIndicator(color: AppColors.amber));

          final data = snap.data as Map<String, dynamic>? ?? {};

          return ListView(padding: const EdgeInsets.all(14), children: [
            const Text('RESUMO DO MÊS', style: TextStyle(
                fontSize: 9, fontFamily: 'IBMPlexMono', color: AppColors.textTertiary, letterSpacing: 1.5)),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10,
              shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 1.6,
              children: [
                _MetricCard('Total', '${data['total'] ?? 0}', AppColors.textPrimary, Icons.list_alt),
                _MetricCard('Resolvidas', '${data['resolved'] ?? 0}', AppColors.low, Icons.check_circle_outline),
                _MetricCard('SLA OK', '${data['sla_ok_pct'] ?? 0}%', AppColors.info, Icons.timer_outlined),
                _MetricCard('Críticas', '${data['critical'] ?? 0}', AppColors.critical, Icons.warning_amber),
              ],
            ),
            const SizedBox(height: 20),
            const Text('POR PRIORIDADE', style: TextStyle(
                fontSize: 9, fontFamily: 'IBMPlexMono', color: AppColors.textTertiary, letterSpacing: 1.5)),
            const SizedBox(height: 10),
            ...(['critical','high','medium','low']).map((p) {
              final val = data['priority_$p'] as int? ?? 0;
              final color = AppColors.priorityColor(p);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  PriorityBadge(priority: p),
                  const SizedBox(width: 10),
                  Expanded(child: LinearProgressIndicator(
                    value: data['total'] == 0 ? 0 : val / (data['total'] as int? ?? 1),
                    backgroundColor: AppColors.muted,
                    color: color,
                    minHeight: 6,
                    borderRadius: BorderRadius.circular(3),
                  )),
                  const SizedBox(width: 10),
                  Text('$val', style: TextStyle(fontSize: 11, fontFamily: 'IBMPlexMono', color: color, fontWeight: FontWeight.w600)),
                ]),
              );
            }),
          ]);
        },
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════
// ABA 4: ALERTAS — enviar notificações para a cidade
// ════════════════════════════════════════════════════════════
class SupervisorAlertsScreen extends ConsumerStatefulWidget {
  const SupervisorAlertsScreen({super.key});
  @override
  ConsumerState<SupervisorAlertsScreen> createState() => _SupervisorAlertsState();
}

class _SupervisorAlertsState extends ConsumerState<SupervisorAlertsScreen> {
  final _titleCtrl   = TextEditingController();
  final _msgCtrl     = TextEditingController();
  String _severity   = 'high';
  String _type       = 'flood_warning';
  bool   _sending    = false;

  // Templates igual ao painel web
  static const _templates = [
    ('🌧️ Briefing', 'BRIEFING METEOROLÓGICO', '*SEDEC — Defesa Civil*\n\n*CENÁRIO ATUAL*\nInforme as condições atuais aqui.\n\n*CENÁRIO FUTURO*\nPrevisão para as próximas horas.\n\n*RISCO*\nNível de risco e regiões afetadas.'),
    ('⚠️ Alagamento', '⚠️ ALERTA DE ALAGAMENTO', '*Defesa Civil informa:*\n\nRisco de alagamento em _[região]_. Evite áreas de baixada.\n\nEm caso de emergência ligue 199.'),
    ('🌊 Mar Agitado', '🌊 MAR AGITADO', '*Defesa Civil:*\n\nMar agitado. *Banho não recomendado.*\n\nEvite atividades náuticas.'),
    ('✅ Normalização', '✅ SITUAÇÃO NORMALIZADA', '*Defesa Civil informa:*\n\nSituação normalizada. Equipes seguem em monitoramento.\n\nObrigado pela colaboração.'),
  ];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _msgCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_titleCtrl.text.trim().isEmpty || _msgCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Preencha título e mensagem'), backgroundColor: AppColors.high));
      return;
    }

    setState(() => _sending = true);
    try {
      final api = ref.read(apiClientProvider);
      final alertRes = await api.createAlert({
        'title':       _titleCtrl.text.trim(),
        'message':     _msgCtrl.text.trim(),
        'alertType':   _type,
        'severity':    _severity,
        'targetScope': 'all',
      });
      await api.sendAlert(alertRes['id'] as String);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('✅ Alerta enviado para todos os cidadãos!'),
          backgroundColor: AppColors.low,
          duration: Duration(seconds: 3),
        ));
        _titleCtrl.clear();
        _msgCtrl.clear();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Erro: $e'), backgroundColor: AppColors.critical));
    } finally {
      setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.base,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Templates
          const Text('TEMPLATES', style: TextStyle(
              fontSize: 9, fontFamily: 'IBMPlexMono', color: AppColors.textTertiary, letterSpacing: 1.5)),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: _templates.map((t) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() { _titleCtrl.text = t.$2; _msgCtrl.text = t.$3; }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: AppColors.surface, borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(t.$1, style: const TextStyle(fontSize: 11, fontFamily: 'IBMPlexMono', color: AppColors.textSecondary)),
                ),
              ),
            )).toList()),
          ),

          const SizedBox(height: 20),

          // Tipo + Severidade
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('SEVERIDADE', style: TextStyle(fontSize: 8, fontFamily: 'IBMPlexMono', color: AppColors.textTertiary, letterSpacing: 1)),
              const SizedBox(height: 4),
              DropdownButtonFormField<String>(
                value: _severity,
                decoration: const InputDecoration(isDense: true),
                items: [
                  ('critical','🔴 Crítico'), ('high','🟠 Alto'),
                  ('medium','🟡 Médio'), ('info','🔵 Info'),
                ].map((e) => DropdownMenuItem(value: e.$1, child: Text(e.$2, style: const TextStyle(fontSize: 12)))).toList(),
                onChanged: (v) => setState(() => _severity = v!),
              ),
            ])),
          ]),

          const SizedBox(height: 14),

          // Título
          const Text('TÍTULO', style: TextStyle(fontSize: 8, fontFamily: 'IBMPlexMono', color: AppColors.textTertiary, letterSpacing: 1)),
          const SizedBox(height: 4),
          TextField(
            controller: _titleCtrl,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            decoration: const InputDecoration(hintText: 'Ex: ⚠️ ALERTA DE ALAGAMENTO', isDense: true),
          ),

          const SizedBox(height: 14),

          // Mensagem
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('MENSAGEM', style: TextStyle(fontSize: 8, fontFamily: 'IBMPlexMono', color: AppColors.textTertiary, letterSpacing: 1)),
            const Text('*negrito*  _itálico_', style: TextStyle(fontSize: 9, fontFamily: 'IBMPlexMono', color: AppColors.textTertiary)),
          ]),
          const SizedBox(height: 4),
          TextField(
            controller: _msgCtrl,
            maxLines: 10,
            style: const TextStyle(fontSize: 12, fontFamily: 'IBMPlexMono', height: 1.5),
            decoration: const InputDecoration(
              hintText: '*SEÇÃO*\nTexto da mensagem...',
              alignLabelWithHint: true,
              isDense: true,
            ),
          ),

          const SizedBox(height: 20),

          // Aviso de impacto
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.high.withOpacity(0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.high.withOpacity(0.25)),
            ),
            child: const Row(children: [
              Icon(Icons.info_outline, size: 16, color: AppColors.high),
              SizedBox(width: 8),
              Expanded(child: Text(
                'Esta notificação será enviada para TODOS os cidadãos cadastrados no app.',
                style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
              )),
            ]),
          ),

          const SizedBox(height: 14),

          ElevatedButton.icon(
            onPressed: _sending ? null : _send,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.critical,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            icon: _sending
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Icon(Icons.send),
            label: Text(_sending ? 'Enviando...' : 'Disparar para toda a cidade'),
          ),
        ]),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════
// WIDGETS AUXILIARES
// ════════════════════════════════════════════════════════════
class _Tab {
  final IconData icon, activeIcon;
  final String label, path;
  const _Tab(this.icon, this.activeIcon, this.label, this.path);
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final Color  color;
  const _StatCard(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) => Expanded(child: Container(
    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
    decoration: BoxDecoration(
      color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(10),
      border: Border.all(color: color.withOpacity(0.2)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: color, fontFamily: 'IBMPlexMono')),
      Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary, fontFamily: 'IBMPlexMono')),
    ]),
  ));
}

class _MetricCard extends StatelessWidget {
  final String label, value;
  final Color  color;
  final IconData icon;
  const _MetricCard(this.label, this.value, this.color, this.icon);

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.surface, borderRadius: BorderRadius.circular(10),
      border: Border.all(color: AppColors.border),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 18, color: color),
      const Spacer(),
      Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: color, fontFamily: 'IBMPlexMono')),
      Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary, fontFamily: 'IBMPlexMono')),
    ]),
  );
}*/