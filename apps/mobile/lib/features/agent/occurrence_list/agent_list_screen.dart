// lib/features/agent/occurrence_list/agent_list_screen.dart
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/constants/app_colors.dart';
import '../../../models/occurrence.dart';
import '../../../providers/providers.dart';
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

    final filterMap = [
      {'status': 'open'},
      {'status': 'assigned,in_progress'},
      {'status': 'resolved'},
    ];

    final currentFilter = filterMap[_tabCtrl.index];

    final filtered = state.items.where((o) {
      final matchStatus = currentFilter['status']!
          .split(',')
          .contains(o.status);

      final matchSearch = _searchText.isEmpty ||
          o.protocol.toLowerCase().contains(_searchText) ||
          o.categoryName.toLowerCase().contains(_searchText) ||
          (o.address?.toLowerCase().contains(_searchText) ?? false);

      return matchStatus && matchSearch;
    }).toList();

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
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                controller: _searchCtrl,
                onChanged: (v) =>
                    setState(() => _searchText = v.toLowerCase()),
                decoration: InputDecoration(
                  hintText: 'Buscar por protocolo, categoria...',
                  prefixIcon: const Icon(Icons.search,
                      color: AppColors.textTertiary, size: 20),
                  suffixIcon: _searchText.isNotEmpty
                      ? IconButton(
                    icon: const Icon(Icons.clear, size: 18),
                    onPressed: () {
                      _searchCtrl.clear();
                      setState(() => _searchText = '');
                    },
                  )
                      : null,
                  contentPadding:
                  const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          ),

          SliverPersistentHeader(
            pinned: true,
            delegate: _TabBarDelegate(
              TabBar(
                controller: _tabCtrl,
                indicatorColor: AppColors.amber,
                labelColor: AppColors.amber,
                unselectedLabelColor: AppColors.textTertiary,
                labelStyle: const TextStyle(
                    fontFamily: 'IBMPlexMono',
                    fontSize: 11,
                    fontWeight: FontWeight.w600),
                tabs: [
                  Tab(
                      text:
                      'ABERTAS (${state.items.where((o) => o.status == 'open').length})'),
                  const Tab(text: 'EM ANDAMENTO'),
                  const Tab(text: 'RESOLVIDAS'),
                ],
              ),
            ),
          ),

          if (state.isLoading)
            const SliverFillRemaining(
              child: Center(
                  child:
                  CircularProgressIndicator(color: AppColors.amber)),
            )
          else if (filtered.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.check_circle_outline,
                        size: 48, color: AppColors.textTertiary),
                    const SizedBox(height: 12),
                    Text(
                      _tabCtrl.index == 0
                          ? 'Nenhuma ocorrência aberta'
                          : 'Sem ocorrências',
                      style:
                      const TextStyle(color: AppColors.textSecondary),
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
                    if (state.hasMore) {
                      ref
                          .read(occurrencesProvider.notifier)
                          .loadMore();
                      return const Padding(
                        padding: EdgeInsets.all(16),
                        child: Center(
                            child: CircularProgressIndicator(
                                color: AppColors.amber,
                                strokeWidth: 2)),
                      );
                    }
                    return null;
                  }

                  final occ = filtered[i];
                  return OccurrenceCard(
                    occurrence: occ,
                    showAgent: true,
                    onTap: () =>
                        context.push('/agent/occurrences/${occ.id}'),
                  );
                },
                childCount:
                filtered.length + (state.hasMore ? 1 : 0),
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

  @override
  double get minExtent => tabBar.preferredSize.height + 1;
  @override
  double get maxExtent => tabBar.preferredSize.height + 1;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: AppColors.base,
      child: Column(children: [tabBar, const Divider(height: 1)]),
    );
  }

  @override
  bool shouldRebuild(_TabBarDelegate oldDelegate) =>
      tabBar != oldDelegate.tabBar;
}

// ============================================================
// DETAIL
// ============================================================

class AgentDetailScreen extends ConsumerStatefulWidget {
  final String occurrenceId;
  const AgentDetailScreen(
      {super.key, required this.occurrenceId});

  @override
  ConsumerState<AgentDetailScreen> createState() =>
      _AgentDetailScreenState();
}

class _AgentDetailScreenState
    extends ConsumerState<AgentDetailScreen> {
  Occurrence? _occ;
  List<Map<String, dynamic>> _timeline = [];

  bool _loading = true;
  bool _updating = false;

  final _noteCtrl = TextEditingController();
  File? _statusPhoto;

  @override
  void initState() {
    super.initState();
    _loadOccurrence();
  }

  Future<void> _loadOccurrence() async {
    setState(() => _loading = true);

    try {
      final api = ref.read(apiClientProvider);

      final results = await Future.wait([
        api.getOccurrence(widget.occurrenceId),
        api.getOccurrenceTimeline(widget.occurrenceId),
      ]);

      final occData = results[0] as Map<String, dynamic>;
      final timelineData = results[1] as List;

      setState(() {
        _occ = Occurrence.fromJson(occData);

        _timeline = timelineData
            .where((e) => e is Map)
            .map<Map<String, dynamic>>(
                (e) => Map<String, dynamic>.from(e as Map))
            .toList();

        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // TODO: implement build
    throw UnimplementedError();
  }

// ============================================================
// TIMELINE ITEM FIX
// ============================================================

}

class _TimelineItem extends StatelessWidget {
  final Map<String, dynamic> entry;
  const _TimelineItem({required this.entry});

  @override
  Widget build(BuildContext context) {
    final action   = entry['action']?.toString() ?? '';
    final userName = entry['user_name']?.toString() ?? 'Sistema';
    final note     = entry['note']?.toString();
    final from_    = entry['from_status']?.toString();
    final to_      = entry['to_status']?.toString();
    final createdAt = entry['created_at']?.toString() ?? '';

    String actionLabel = action;

    if (action == 'status_changed' && from_ != null && to_ != null) {
      actionLabel = '$from_ → $to_';
    } else if (action == 'opened') {
      actionLabel = 'Ocorrência registrada';
    } else if (action == 'photo_added') {
      actionLabel = 'Foto adicionada';
    } else if (action == 'sla_breached') {
      actionLabel = '⚠️ SLA violado';
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 8,
                height: 8,
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
                Text(actionLabel),
                if (note != null && note.isNotEmpty)
                  Text('"$note"'),
                Text('$userName · ${_formatRelative(createdAt)}'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatRelative(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);

    if (diff.inMinutes < 1) return 'agora';
    if (diff.inMinutes < 60) return '${diff.inMinutes}min atrás';
    if (diff.inHours < 24) return '${diff.inHours}h atrás';
    return '${diff.inDays}d atrás';
  }
}