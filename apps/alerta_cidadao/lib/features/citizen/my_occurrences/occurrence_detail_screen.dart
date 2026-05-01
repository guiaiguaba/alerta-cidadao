// lib/features/citizen/my_occurrences/occurrence_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../models/occurrence.dart';
import '../../../providers/providers.dart';

class OccurrenceDetailScreen extends ConsumerStatefulWidget {
  final String occurrenceId;
  const OccurrenceDetailScreen({super.key, required this.occurrenceId});

  @override
  ConsumerState<OccurrenceDetailScreen> createState() => _OccurrenceDetailState();
}

class _OccurrenceDetailState extends ConsumerState<OccurrenceDetailScreen> {
  Occurrence? _occ;
  List<Map<String, dynamic>> _timeline = [];
  bool _loading = true;

  static const _statusConfig = {
    'open': _StatusConfig(label: 'Aguardando Atendimento', color: AppColors.statusOpen, icon: Icons.hourglass_empty),
    'assigned': _StatusConfig(label: 'Agente Designado', color: AppColors.statusAssigned, icon: Icons.person_outlined),
    'in_progress': _StatusConfig(label: 'Em Atendimento', color: AppColors.statusInProgress, icon: Icons.engineering),
    'resolved': _StatusConfig(label: 'Resolvida ✅', color: AppColors.statusResolved, icon: Icons.check_circle_outlined),
    'rejected': _StatusConfig(label: 'Rejeitada', color: AppColors.statusRejected, icon: Icons.cancel_outlined),
    'duplicate': _StatusConfig(label: 'Duplicata', color: AppColors.statusDuplicate, icon: Icons.content_copy_outlined),
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);

      final results = await Future.wait([
        api.getOccurrence(widget.occurrenceId),
        api.getOccurrenceTimeline(widget.occurrenceId),
      ]);

      final occData = results[0] as Map<String, dynamic>;
      final timelineData = (results[1] as List)
          .map((e) => e as Map<String, dynamic>)
          .toList();

      setState(() {
        _occ = Occurrence.fromJson(occData);
        _timeline = timelineData;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
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
        body: const Center(child: Text('Não encontrada')),
      );
    }

    final occ = _occ!;
    final statusCfg = _statusConfig[occ.status] ??
        _StatusConfig(label: occ.status, color: AppColors.textSecondary, icon: Icons.circle);

    return Scaffold(
      appBar: AppBar(
        title: Text(occ.protocol, style: const TextStyle(fontFamily: 'IBMPlexMono')),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [

            /// STATUS
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: statusCfg.color.withOpacity(0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: statusCfg.color.withOpacity(0.25)),
              ),
              child: Column(
                children: [
                  Icon(statusCfg.icon, color: statusCfg.color, size: 40),
                  const SizedBox(height: 10),
                  Text(
                    statusCfg.label,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: statusCfg.color,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            /// TIMELINE
            if (_timeline.isNotEmpty) ...[
              const Text('HISTÓRICO'),
              const SizedBox(height: 12),

              ..._timeline.map((t) {
                final action = t['action']?.toString() ?? '';
                final fromStatus = t['from_status']?.toString();
                final toStatus = t['to_status']?.toString();
                final note = t['note']?.toString();
                final user = t['user_name']?.toString() ?? '';
                final created = t['created_at']?.toString() ?? '';

                String label = action;

                if (action == 'status_changed' && fromStatus != null && toStatus != null) {
                  label = '$fromStatus → $toStatus';
                } else if (action == 'opened') {
                  label = 'Ocorrência registrada';
                }

                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.amber,
                            ),
                          ),
                          Container(width: 1, height: 32, color: AppColors.border),
                        ],
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(label),
                            if (note != null && note.isNotEmpty)
                              Text('"$note"'),
                            Text(
                              '$user · ${_relativeTime(created)}',
                              style: const TextStyle(fontSize: 10),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }

  String _relativeTime(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';

    final diff = DateTime.now().difference(dt);

    if (diff.inMinutes < 1) return 'agora';
    if (diff.inMinutes < 60) return '${diff.inMinutes}min atrás';
    if (diff.inHours < 24) return '${diff.inHours}h atrás';

    return '${diff.inDays}d atrás';
  }
}

class _StatusConfig {
  final String label;
  final Color color;
  final IconData icon;

  const _StatusConfig({
    required this.label,
    required this.color,
    required this.icon,
  });
}