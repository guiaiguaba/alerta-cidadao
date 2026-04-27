// lib/features/citizen/my_occurrences/occurrence_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/providers.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/widgets.dart';

class OccurrenceDetailScreen extends ConsumerStatefulWidget {
  final String occurrenceId;
  const OccurrenceDetailScreen({super.key, required this.occurrenceId});

  @override
  ConsumerState<OccurrenceDetailScreen> createState() => _OccurrenceDetailState();
}

class _OccurrenceDetailState extends ConsumerState<OccurrenceDetailScreen> {
  Occurrence?   _occ;
  List<dynamic> _timeline = [];
  bool          _loading  = true;

  static const _statusConfig = {
    'open':        _StatusConfig(label: 'Aguardando Atendimento', color: AppColors.statusOpen,        icon: Icons.hourglass_empty),
    'assigned':    _StatusConfig(label: 'Agente Designado',       color: AppColors.statusAssigned,    icon: Icons.person_outlined),
    'in_progress': _StatusConfig(label: 'Em Atendimento',         color: AppColors.statusInProgress,  icon: Icons.engineering),
    'resolved':    _StatusConfig(label: 'Resolvida ✅',            color: AppColors.statusResolved,    icon: Icons.check_circle_outlined),
    'rejected':    _StatusConfig(label: 'Rejeitada',              color: AppColors.statusRejected,    icon: Icons.cancel_outlined),
    'duplicate':   _StatusConfig(label: 'Duplicata',              color: AppColors.statusDuplicate,   icon: Icons.content_copy_outlined),
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
      final [occData, timeline] = await Future.wait([
        api.getOccurrence(widget.occurrenceId),
        api.getOccurrenceTimeline(widget.occurrenceId),
      ]);
      setState(() {
        _occ      = Occurrence.fromJson(occData as Map<String, dynamic>);
        _timeline = timeline as List<dynamic>;
        _loading  = false;
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

    final occ        = _occ!;
    final statusCfg  = _statusConfig[occ.status] ?? _StatusConfig(label: occ.status, color: AppColors.textSecondary, icon: Icons.circle);
    final isResolved = occ.status == 'resolved';
    final isRejected = occ.status == 'rejected';

    return Scaffold(
      appBar: AppBar(
        title: Text(occ.protocol, style: const TextStyle(fontFamily: 'IBMPlexMono')),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: RefreshIndicator(
        color:    AppColors.amber,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [

            // ==========================================
            // STATUS HERO CARD
            // ==========================================
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color:        statusCfg.color.withOpacity(0.08),
                borderRadius: BorderRadius.circular(16),
                border:       Border.all(color: statusCfg.color.withOpacity(0.25)),
              ),
              child: Column(
                children: [
                  Icon(statusCfg.icon, color: statusCfg.color, size: 40),
                  const SizedBox(height: 10),
                  Text(
                    statusCfg.label,
                    style: TextStyle(
                      fontSize:   18,
                      fontWeight: FontWeight.w600,
                      color:      statusCfg.color,
                    ),
                  ),
                  if (isRejected && occ.status == 'rejected') ...[
                    const SizedBox(height: 6),
                    Text(
                      'Se discordar, registre uma nova ocorrência com mais detalhes.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                  if (occ.agentName != null && !isResolved && !isRejected) ...[
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.person, size: 14, color: AppColors.textSecondary),
                        const SizedBox(width: 6),
                        Text(
                          'Agente: ${occ.agentName}',
                          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ==========================================
            // PROGRESS INDICATOR
            // ==========================================
            _StatusProgress(currentStatus: occ.status),

            const SizedBox(height: 16),

            // ==========================================
            // DETALHES
            // ==========================================
            _DetailSection(
              title: 'Informações',
              children: [
                _Row('Protocolo',  occ.protocol, mono: true, color: AppColors.amber),
                _Row('Categoria',  occ.categoryName),
                if (occ.address != null) _Row('Endereço', occ.address!),
                _Row('Prioridade', occ.priority.toUpperCase()),
                _Row('Data',       _fmt(occ.createdAt)),
                if (occ.slaDeadline != null)
                  _Row('Prazo SLA', _fmt(occ.slaDeadline!),
                    color: occ.slaBreached ? AppColors.critical : AppColors.low),
              ],
            ),

            if (occ.description?.isNotEmpty == true) ...[
              const SizedBox(height: 12),
              _DetailSection(
                title: 'Descrição',
                children: [
                  Text(occ.description!, style: const TextStyle(fontSize: 14, height: 1.5)),
                ],
              ),
            ],

            // ==========================================
            // FOTOS
            // ==========================================
            if (occ.media?.isNotEmpty == true) ...[
              const SizedBox(height: 16),
              const Text('FOTOS', style: TextStyle(
                fontFamily: 'IBMPlexMono', fontSize: 10,
                letterSpacing: 1.2, color: AppColors.textTertiary,
              )),
              const SizedBox(height: 8),
              SizedBox(
                height: 110,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: occ.media!.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final m = occ.media![i];
                    return GestureDetector(
                      onTap: () => _showImage(context, m.url),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(
                          m.thumbnailUrl ?? m.url,
                          width: 110, height: 110, fit: BoxFit.cover,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],

            // ==========================================
            // TIMELINE
            // ==========================================
            if (_timeline.isNotEmpty) ...[
              const SizedBox(height: 20),
              const Text('HISTÓRICO', style: TextStyle(
                fontFamily: 'IBMPlexMono', fontSize: 10,
                letterSpacing: 1.2, color: AppColors.textTertiary,
              )),
              const SizedBox(height: 12),
              ..._timeline.map((t) {
                final action   = t['action'] ?? '';
                final from_    = t['from_status'] as String?;
                final to_      = t['to_status'] as String?;
                final note     = t['note'] as String?;
                final user     = t['user_name'] ?? '';
                final created  = t['created_at'] ?? '';

                String label = action;
                if (action == 'status_changed' && from_ != null && to_ != null) {
                  label = '$from_ → $to_';
                } else if (action == 'opened') {
                  label = 'Ocorrência registrada';
                }

                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(children: [
                        Container(
                          width: 10, height: 10,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle, color: AppColors.amber,
                          ),
                        ),
                        Container(width: 1, height: 32, color: AppColors.border),
                      ]),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                            if (note != null && note.isNotEmpty)
                              Text('"$note"', style: const TextStyle(
                                fontSize: 12, color: AppColors.textSecondary, fontStyle: FontStyle.italic)),
                            Text(
                              '$user · ${_relativeTime(created)}',
                              style: const TextStyle(
                                fontSize: 10, color: AppColors.textTertiary, fontFamily: 'IBMPlexMono'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],

            const SizedBox(height: 48),
          ],
        ),
      ),
    );
  }

  String _fmt(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year} '
           '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  String _relativeTime(String iso) {
    final dt   = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1)  return 'agora';
    if (diff.inMinutes < 60) return '${diff.inMinutes}min atrás';
    if (diff.inHours   < 24) return '${diff.inHours}h atrás';
    return '${diff.inDays}d atrás';
  }

  void _showImage(BuildContext context, String url) => showDialog(
    context: context,
    builder: (_) => Dialog(
      backgroundColor: Colors.black87,
      child: InteractiveViewer(child: Image.network(url)),
    ),
  );
}

// ---- Progress indicator ----
class _StatusProgress extends StatelessWidget {
  final String currentStatus;

  static const _steps = ['open', 'assigned', 'in_progress', 'resolved'];
  static const _stepLabels = ['Aberta', 'Atribuída', 'Em andamento', 'Resolvida'];

  const _StatusProgress({required this.currentStatus});

  @override
  Widget build(BuildContext context) {
    final currentIdx = _steps.indexOf(currentStatus);
    if (currentIdx == -1) return const SizedBox.shrink();

    return Row(
      children: List.generate(_steps.length, (i) {
        final done   = i <= currentIdx;
        final active = i == currentIdx;
        return Expanded(
          child: Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                height: 4,
                decoration: BoxDecoration(
                  color:        done ? AppColors.amber : AppColors.border,
                  borderRadius: BorderRadius.horizontal(
                    left:  i == 0 ? const Radius.circular(2) : Radius.zero,
                    right: i == _steps.length - 1 ? const Radius.circular(2) : Radius.zero,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _stepLabels[i],
                style: TextStyle(
                  fontFamily: 'IBMPlexMono',
                  fontSize:   8,
                  color:      active ? AppColors.amber : done ? AppColors.textSecondary : AppColors.textTertiary,
                  fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}

class _StatusConfig {
  final String  label;
  final Color   color;
  final IconData icon;
  const _StatusConfig({required this.label, required this.color, required this.icon});
}

class _DetailSection extends StatelessWidget {
  final String       title;
  final List<Widget> children;
  const _DetailSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color:        AppColors.surface,
      borderRadius: BorderRadius.circular(10),
      border:       Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title.toUpperCase(), style: const TextStyle(
          fontFamily: 'IBMPlexMono', fontSize: 10,
          letterSpacing: 1.0, color: AppColors.textTertiary,
        )),
        const SizedBox(height: 8),
        ...children,
      ],
    ),
  );
}

class _Row extends StatelessWidget {
  final String  label;
  final String  value;
  final bool    mono;
  final Color?  color;
  const _Row(this.label, this.value, {this.mono = false, this.color});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 100,
          child: Text(label, style: const TextStyle(
            fontSize: 11, color: AppColors.textTertiary, fontFamily: 'IBMPlexMono')),
        ),
        Expanded(child: Text(value, style: TextStyle(
          fontSize:   13,
          color:      color ?? AppColors.textPrimary,
          fontFamily: mono ? 'IBMPlexMono' : 'IBMPlexSans',
          fontWeight: mono ? FontWeight.w600 : FontWeight.w400,
        ))),
      ],
    ),
  );
}
