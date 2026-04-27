// lib/features/agent/occurrence_list/agent_list_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/providers.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/priority_badge.dart';
import '../../../shared/widgets/status_badge.dart';
import '../../../shared/widgets/occurrence_card.dart';

class AgentListScreen extends ConsumerStatefulWidget {
  const AgentListScreen({super.key});

  @override
  ConsumerState<AgentListScreen> createState() => _AgentListScreenState();
}

class _AgentListScreenState extends ConsumerState<AgentListScreen>
    with SingleTickerProviderStateMixin {

  late TabController _tabCtrl;
  final _searchCtrl = TextEditingController();
  String _searchText = '';

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _tabCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(occurrencesProvider);

    // Filtros por aba
    final filterMap = [
      {'status': 'open'},
      {'status': 'assigned,in_progress'},
      {'status': 'resolved'},
    ];

    final currentFilter = filterMap[_tabCtrl.index];

    // Filtrar localmente pela aba e busca
    final filtered = state.items.where((o) {
      final matchStatus = currentFilter['status']!.split(',').contains(o.status);
      final matchSearch = _searchText.isEmpty ||
          o.protocol.toLowerCase().contains(_searchText) ||
          o.categoryName.toLowerCase().contains(_searchText) ||
          (o.address?.toLowerCase().contains(_searchText) ?? false);
      return matchStatus && matchSearch;
    }).toList();

    // Ordenar: crítico primeiro, depois por data
    filtered.sort((a, b) {
      const order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3};
      final diff = (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
      if (diff != 0) return diff;
      return b.createdAt.compareTo(a.createdAt);
    });

    return RefreshIndicator(
      color: AppColors.amber,
      onRefresh: () => ref.read(occurrencesProvider.notifier).load(),
      child: CustomScrollView(
        slivers: [
          // ==========================================
          // SEARCH BAR
          // ==========================================
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                controller: _searchCtrl,
                onChanged:  (v) => setState(() => _searchText = v.toLowerCase()),
                decoration: InputDecoration(
                  hintText:    'Buscar por protocolo, categoria...',
                  prefixIcon:  const Icon(Icons.search, color: AppColors.textTertiary, size: 20),
                  suffixIcon:  _searchText.isNotEmpty
                    ? IconButton(
                        icon:     const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _searchText = '');
                        },
                      )
                    : null,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          ),

          // ==========================================
          // TAB BAR
          // ==========================================
          SliverPersistentHeader(
            pinned: true,
            delegate: _TabBarDelegate(
              TabBar(
                controller:       _tabCtrl,
                indicatorColor:   AppColors.amber,
                labelColor:       AppColors.amber,
                unselectedLabelColor: AppColors.textTertiary,
                labelStyle:       const TextStyle(fontFamily: 'IBMPlexMono', fontSize: 11, fontWeight: FontWeight.w600),
                tabs: [
                  Tab(text: 'ABERTAS (${state.items.where((o) => o.status == 'open').length})'),
                  Tab(text: 'EM ANDAMENTO'),
                  Tab(text: 'RESOLVIDAS'),
                ],
              ),
            ),
          ),

          // ==========================================
          // LISTA
          // ==========================================
          if (state.isLoading)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator(color: AppColors.amber)),
            )
          else if (filtered.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.check_circle_outline, size: 48, color: AppColors.textTertiary),
                    const SizedBox(height: 12),
                    Text(
                      _tabCtrl.index == 0 ? 'Nenhuma ocorrência aberta' : 'Sem ocorrências',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, i) {
                  if (i == filtered.length) {
                    // Load more trigger
                    if (state.hasMore) {
                      ref.read(occurrencesProvider.notifier).loadMore();
                      return const Padding(
                        padding: EdgeInsets.all(16),
                        child: Center(child: CircularProgressIndicator(color: AppColors.amber, strokeWidth: 2)),
                      );
                    }
                    return null;
                  }

                  final occ = filtered[i];
                  return OccurrenceCard(
                    occurrence: occ,
                    showAgent:  true,
                    onTap:      () => context.push('/agent/occurrences/${occ.id}'),
                  );
                },
                childCount: filtered.length + (state.hasMore ? 1 : 0),
              ),
            ),
        ],
      ),
    );
  }
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  _TabBarDelegate(this.tabBar);

  @override double get minExtent => tabBar.preferredSize.height + 1;
  @override double get maxExtent => tabBar.preferredSize.height + 1;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: AppColors.base,
      child: Column(children: [tabBar, const Divider(height: 1)]),
    );
  }

  @override
  bool shouldRebuild(_TabBarDelegate oldDelegate) => tabBar != oldDelegate.tabBar;
}

// ============================================================

// lib/features/agent/occurrence_list/agent_detail_screen.dart
class AgentDetailScreen extends ConsumerStatefulWidget {
  final String occurrenceId;
  const AgentDetailScreen({super.key, required this.occurrenceId});

  @override
  ConsumerState<AgentDetailScreen> createState() => _AgentDetailScreenState();
}

class _AgentDetailScreenState extends ConsumerState<AgentDetailScreen> {
  Occurrence? _occ;
  List<dynamic> _timeline = [];
  bool _loading    = true;
  bool _updating   = false;
  final _noteCtrl  = TextEditingController();
  File? _statusPhoto;

  static const _transitions = {
    'open':        ['assigned', 'rejected'],
    'assigned':    ['in_progress', 'rejected'],
    'in_progress': ['resolved'],
  };

  static const _statusLabels = {
    'assigned':    'Assumir',
    'in_progress': 'Iniciar Atendimento',
    'resolved':    'Marcar Resolvida',
    'rejected':    'Rejeitar',
  };

  @override
  void initState() {
    super.initState();
    _loadOccurrence();
  }

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadOccurrence() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final [occData, timeline] = await Future.wait([
        api.getOccurrence(widget.occurrenceId),
        api.getOccurrenceTimeline(widget.occurrenceId),
      ]);
      setState(() {
        _occ      = Occurrence.fromJson(occData);
        _timeline = timeline;
        _loading  = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: AppColors.critical),
        );
      }
    }
  }

  Future<void> _updateStatus(String newStatus) async {
    setState(() => _updating = true);
    try {
      final api       = ref.read(apiClientProvider);
      final isOnline  = ref.read(isOnlineProvider);

      if (isOnline) {
        // Upload foto antes de resolver (se tivermos)
        if (_statusPhoto != null && _occ != null) {
          await api.uploadMedia(_occ!.id, _statusPhoto!, newStatus == 'resolved' ? 'after' : 'during');
        }

        final updated = await api.updateOccurrenceStatus(
          _occ!.id, newStatus,
          note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
        );
        setState(() {
          _occ = Occurrence.fromJson(updated);
          _noteCtrl.clear();
          _statusPhoto = null;
        });

        // Atualizar na lista global
        ref.read(occurrencesProvider.notifier).updateOccurrenceStatus(_occ!.id, newStatus);
      } else {
        // Offline: enfileirar
        await ref.read(offlineQueueProvider).enqueueStatusUpdate(
          _occ!.id, newStatus,
          note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
        );
        setState(() {
          _occ!.status = newStatus;
          _noteCtrl.clear();
        });
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content:         Text('Status atualizado para ${_statusLabels[newStatus] ?? newStatus} ✅'),
            backgroundColor: AppColors.low,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: AppColors.critical),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Ocorrência')),
        body: const Center(child: CircularProgressIndicator(color: AppColors.amber)),
      );
    }

    if (_occ == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Ocorrência')),
        body: const Center(child: Text('Ocorrência não encontrada')),
      );
    }

    final occ           = _occ!;
    final nextStatuses  = _transitions[occ.status] ?? [];
    final priorityColor = AppColors.priorityColor(occ.priority);

    return Scaffold(
      appBar: AppBar(
        title: Text(occ.protocol, style: const TextStyle(fontFamily: 'IBMPlexMono')),
        actions: [
          // Navegar até o local
          IconButton(
            icon:     const Icon(Icons.navigation_outlined),
            onPressed: () => _openNavigation(occ.lat, occ.lng),
            tooltip:  'Navegar até o local',
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ==========================================
          // BADGES
          // ==========================================
          Wrap(
            spacing: 8,
            children: [
              PriorityBadge(priority: occ.priority),
              StatusBadge(status: occ.status),
              if (occ.slaBreached)
                Chip(
                  label:          const Text('SLA VIOLADO'),
                  backgroundColor: AppColors.criticalBg,
                  side:           const BorderSide(color: AppColors.criticalBorder),
                  labelStyle:     const TextStyle(
                    color:       AppColors.critical,
                    fontFamily:  'IBMPlexMono',
                    fontSize:    10,
                    fontWeight:  FontWeight.w600,
                  ),
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),

          const SizedBox(height: 16),

          // ==========================================
          // INFORMAÇÕES
          // ==========================================
          _InfoCard(children: [
            _InfoRow(label: 'Categoria',   value: occ.categoryName),
            _InfoRow(label: 'Reportado por', value: occ.reporterName),
            if (occ.address != null)
              _InfoRow(label: 'Endereço',   value: occ.address!),
            _InfoRow(label: 'Região',      value: occ.regionCode ?? '—'),
            _InfoRow(
              label: 'Registrado em',
              value: _formatDate(occ.createdAt),
            ),
            if (occ.slaDeadline != null)
              _InfoRow(
                label:      'Prazo SLA',
                value:      _formatDate(occ.slaDeadline!),
                valueColor: occ.slaBreached ? AppColors.critical : AppColors.low,
              ),
          ]),

          if (occ.description != null && occ.description!.isNotEmpty) ...[
            const SizedBox(height: 12),
            _InfoCard(children: [
              const Text('Descrição', style: TextStyle(
                fontSize: 11, color: AppColors.textTertiary,
                fontFamily: 'IBMPlexMono', letterSpacing: 0.8,
              )),
              const SizedBox(height: 4),
              Text(occ.description!, style: const TextStyle(fontSize: 14)),
            ]),
          ],

          // ==========================================
          // MÍDIA
          // ==========================================
          if ((occ.media?.isNotEmpty ?? false)) ...[
            const SizedBox(height: 12),
            const Text('FOTOS', style: TextStyle(
              fontFamily: 'IBMPlexMono', fontSize: 10,
              letterSpacing: 1.2, color: AppColors.textTertiary,
            )),
            const SizedBox(height: 8),
            SizedBox(
              height: 120,
              child: ListView.separated(
                scrollDirection:  Axis.horizontal,
                itemCount:        occ.media!.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final media = occ.media![i];
                  return GestureDetector(
                    onTap: () => _showFullImage(context, media.url),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        media.thumbnailUrl ?? media.url,
                        width:  120,
                        height: 120,
                        fit:    BoxFit.cover,
                      ),
                    ),
                  );
                },
              ),
            ),
          ],

          // ==========================================
          // ATUALIZAÇÃO DE STATUS
          // ==========================================
          if (nextStatuses.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 12),
            const Text('ATUALIZAR STATUS', style: TextStyle(
              fontFamily: 'IBMPlexMono', fontSize: 10,
              letterSpacing: 1.2, color: AppColors.textTertiary,
            )),
            const SizedBox(height: 12),

            // Nota
            TextField(
              controller: _noteCtrl,
              maxLines:   2,
              decoration: const InputDecoration(
                hintText:    'Adicionar observação (opcional)...',
                prefixIcon:  Icon(Icons.note_outlined, size: 18),
              ),
            ),

            // Foto do status (antes/depois)
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _pickStatusPhoto,
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color:        AppColors.panel,
                  borderRadius: BorderRadius.circular(8),
                  border:       const Border.fromBorderSide(BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.add_a_photo_outlined, size: 18, color: AppColors.textTertiary),
                    const SizedBox(width: 8),
                    Text(
                      _statusPhoto != null ? 'Foto selecionada ✅' : 'Adicionar foto (opcional)',
                      style: TextStyle(
                        fontSize: 13,
                        color:    _statusPhoto != null ? AppColors.low : AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Botões de transição
            ...nextStatuses.map((status) {
              final isResolve  = status == 'resolved';
              final isReject   = status == 'rejected';
              final color      = isResolve ? AppColors.low
                               : isReject  ? AppColors.critical
                               : AppColors.info;

              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: SizedBox(
                  width:  double.infinity,
                  height: 48,
                  child: _updating
                    ? OutlinedButton(
                        onPressed: null,
                        style: OutlinedButton.styleFrom(side: BorderSide(color: color.withOpacity(0.3))),
                        child: const SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : ElevatedButton(
                        onPressed: () => _updateStatus(status),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: color.withOpacity(0.15),
                          foregroundColor: color,
                          side:            BorderSide(color: color.withOpacity(0.4)),
                          elevation:       0,
                        ),
                        child: Text(
                          _statusLabels[status] ?? status,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                ),
              );
            }),
          ],

          // ==========================================
          // TIMELINE
          // ==========================================
          if (_timeline.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 12),
            const Text('HISTÓRICO', style: TextStyle(
              fontFamily: 'IBMPlexMono', fontSize: 10,
              letterSpacing: 1.2, color: AppColors.textTertiary,
            )),
            const SizedBox(height: 12),
            ..._timeline.map((t) => _TimelineItem(entry: t)),
          ],

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    return '${dt.day.toString().padLeft(2,'0')}/${dt.month.toString().padLeft(2,'0')}/${dt.year} ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
  }

  Future<void> _pickStatusPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera, imageQuality: 80);
    if (picked != null) setState(() => _statusPhoto = File(picked.path));
  }

  void _openNavigation(double lat, double lng) {
    // Abrir app de mapas nativo
    // Android: geo:lat,lng?q=lat,lng
    // iOS: maps://maps.apple.com/?q=lat,lng
    // Usar url_launcher em produção
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Navegando para: $lat, $lng')),
    );
  }

  void _showFullImage(BuildContext context, String url) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black87,
        child: InteractiveViewer(child: Image.network(url)),
      ),
    );
  }
}

// ============================================================
// WIDGETS AUXILIARES
// ============================================================

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color:        AppColors.surface,
      borderRadius: BorderRadius.circular(10),
      border:       const Border.fromBorderSide(BorderSide(color: AppColors.border)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    ),
  );
}

class _InfoRow extends StatelessWidget {
  final String  label;
  final String  value;
  final Color?  valueColor;
  const _InfoRow({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 110,
          child: Text(
            label,
            style: const TextStyle(
              fontSize:   11,
              color:      AppColors.textTertiary,
              fontFamily: 'IBMPlexMono',
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 13,
              color:    valueColor ?? AppColors.textPrimary,
            ),
          ),
        ),
      ],
    ),
  );
}

class _TimelineItem extends StatelessWidget {
  final Map<String, dynamic> entry;
  const _TimelineItem({required this.entry});

  @override
  Widget build(BuildContext context) {
    final action   = entry['action'] ?? '';
    final userName = entry['user_name'] ?? 'Sistema';
    final note     = entry['note'] as String?;
    final from_    = entry['from_status'] as String?;
    final to_      = entry['to_status'] as String?;
    final createdAt = entry['created_at'] ?? '';

    String actionLabel = action;
    if (action == 'status_changed' && from_ != null && to_ != null) {
      actionLabel = '$from_ → $to_';
    } else if (action == 'opened')      { actionLabel = 'Ocorrência registrada'; }
    else if (action == 'photo_added')   { actionLabel = 'Foto adicionada'; }
    else if (action == 'sla_breached')  { actionLabel = '⚠️ SLA violado'; }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 8, height: 8,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.border,
                ),
              ),
              Container(width: 1, height: 40, color: AppColors.border),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  actionLabel,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                ),
                if (note != null && note.isNotEmpty)
                  Text('"$note"', style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary, fontStyle: FontStyle.italic,
                  )),
                const SizedBox(height: 2),
                Text(
                  '$userName · ${_formatRelative(createdAt)}',
                  style: const TextStyle(
                    fontSize: 10, color: AppColors.textTertiary, fontFamily: 'IBMPlexMono',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatRelative(String iso) {
    final dt  = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1)  return 'agora';
    if (diff.inMinutes < 60) return '${diff.inMinutes}min atrás';
    if (diff.inHours   < 24) return '${diff.inHours}h atrás';
    return '${diff.inDays}d atrás';
  }
}


