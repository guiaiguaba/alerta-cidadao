import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

class AgentHomeScreen extends ConsumerWidget {
  const AgentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dbUser = ref.watch(dbUserProvider).valueOrNull;
    final name = dbUser?['name'] as String? ?? 'Agente';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final ocorrenciasAsync = ref.watch(agentOcorrenciasProvider);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // ── SliverAppBar com perfil ───────────────────────────
          SliverAppBar(
            pinned: true,
            expandedHeight: 100,
            backgroundColor: isDark ? AppColors.darkBg : AppColors.lightSurface,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                padding: const EdgeInsets.fromLTRB(16, 48, 16, 12),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: AppColors.info,
                      child: Text(
                        name.isNotEmpty ? name[0].toUpperCase() : 'A',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: Theme.of(context).textTheme.titleMedium),
                          Row(
                            children: [
                              Container(
                                width: 7, height: 7,
                                decoration: const BoxDecoration(color: AppColors.prioBaixa, shape: BoxShape.circle),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                'Disponível · Centro',
                                style: TextStyle(fontSize: 12, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Sino com badge
                    Stack(
                      children: [
                        IconButton(
                          icon: Icon(Icons.notifications_outlined, color: isDark ? Colors.white : const Color(0xFF1A1D27)),
                          onPressed: () {},
                        ),
                        Positioned(
                          top: 8, right: 8,
                          child: Container(
                            width: 8, height: 8,
                            decoration: const BoxDecoration(color: AppColors.prioCritica, shape: BoxShape.circle),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Ocorrências designadas ────────────────────────────
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            sliver: SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ocorrenciasAsync.when(
                    loading: () => const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator())),
                    error: (e, _) => Center(child: Text('Erro: $e')),
                    data: (list) {
                      final assigned = list.where((o) => o['status'] == 'em_andamento').toList();
                      final open = list.where((o) => o['status'] == 'aberta').toList();

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (assigned.isNotEmpty) ...[
                            _SectionHeader(
                              'OCORRÊNCIAS DESIGNADAS',
                              badge: assigned.length.toString(),
                            ),
                            const SizedBox(height: 10),
                            ...assigned.map((o) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _AgentOcorrenciaCard(o: o, expanded: true),
                            )),
                            const SizedBox(height: 8),
                          ],
                          if (open.isNotEmpty) ...[
                            _SectionHeader('NOVAS OCORRÊNCIAS'),
                            const SizedBox(height: 10),
                            ...open.map((o) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _AgentOcorrenciaCard(o: o, expanded: false),
                            )),
                          ],
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
        ],
      ),
    );
  }
}

final agentOcorrenciasProvider = FutureProvider<List<dynamic>>((ref) async {
  final data = await ref.read(apiClientProvider).getOcorrencias(limit: 20);
  return data['data'] as List? ?? [];
});

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? badge;
  const _SectionHeader(this.title, {this.badge});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.1,
            color: isDark ? AppColors.darkMuted : AppColors.lightMuted,
          ),
        ),
        if (badge != null) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(color: AppColors.orange, borderRadius: BorderRadius.circular(10)),
            child: Text(badge!, style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ],
      ],
    );
  }
}

class _AgentOcorrenciaCard extends ConsumerStatefulWidget {
  final Map<String, dynamic> o;
  final bool expanded;
  const _AgentOcorrenciaCard({required this.o, required this.expanded});

  @override
  ConsumerState<_AgentOcorrenciaCard> createState() => _AgentOcorrenciaCardState();
}

class _AgentOcorrenciaCardState extends ConsumerState<_AgentOcorrenciaCard> {
  bool _loading = false;

  Future<void> _action(String status) async {
    setState(() => _loading = true);
    try {
      await ref.read(apiClientProvider).updateOcorrencia(widget.o['id'] as String, status: status);
      ref.invalidate(agentOcorrenciasProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erro: $e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.o;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final status = o['status'] as String? ?? 'aberta';
    final prioridade = o['prioridade'] as String? ?? 'normal';
    final protocolo = '#${(o['created_at'] as String? ?? '').hashCode.abs() % 9999}';

    // Monta timeline baseada no status
    final steps = [
      ('Ocorrência registrada', 'Cidadão · ${_timeAgo(o['created_at'])}', true),
      ('Enviada ao painel', 'Sistema automático', true),
      ('Designada ao agente', status != 'aberta' ? 'Você foi designado' : 'Aguardando', status != 'aberta'),
      ('Em atendimento', status == 'em_andamento' || status == 'resolvida' ? 'Em progresso' : 'Aguardando ação', status == 'em_andamento' || status == 'resolvida'),
      ('Concluído', status == 'resolvida' ? 'Resolvido' : 'Pendente', status == 'resolvida'),
    ];

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              _CategoryIcon(o['categoria_nome'] as String? ?? 'Outro'),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      o['categoria_nome'] as String? ?? 'Ocorrência',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                    ),
                    if (o['endereco'] != null || o['latitude'] != null)
                      Text(
                        o['endereco'] as String? ?? '${(o['latitude'] as num?)?.toStringAsFixed(3)}, ${(o['longitude'] as num?)?.toStringAsFixed(3)}',
                        style: TextStyle(fontSize: 11, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
                      ),
                  ],
                ),
              ),
              PriorityBadge(prioridade),
              const SizedBox(width: 6),
              Text(protocolo, style: TextStyle(fontSize: 11, color: isDark ? AppColors.darkMuted : AppColors.lightMuted)),
            ],
          ),
          const SizedBox(height: 10),

          // Descrição
          Text(
            o['descricao'] as String? ?? '',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 13, color: isDark ? Colors.white70 : const Color(0xFF374151)),
          ),
          const SizedBox(height: 8),

          // Meta
          Row(
            children: [
              Icon(Icons.location_on_outlined, size: 13, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
              const SizedBox(width: 4),
              Text(
                o['endereco'] as String? ?? 'Ver localização',
                style: TextStyle(fontSize: 11, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
              ),
              const SizedBox(width: 12),
              Icon(Icons.access_time, size: 13, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
              const SizedBox(width: 4),
              Text(
                _timeAgo(o['created_at']),
                style: TextStyle(fontSize: 11, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
              ),
              if (o['autor_nome'] != null) ...[
                const SizedBox(width: 12),
                Icon(Icons.person_outline, size: 13, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
                const SizedBox(width: 4),
                Text(
                  (o['autor_nome'] as String).split(' ').first,
                  style: TextStyle(fontSize: 11, color: isDark ? AppColors.darkMuted : AppColors.lightMuted),
                ),
              ],
            ],
          ),

          // Mapa mini
          if (widget.expanded && o['latitude'] != null) ...[
            const SizedBox(height: 12),
            Container(
              height: 90,
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkBg : AppColors.lightBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.lightBorder),
              ),
              child: Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: CustomPaint(size: Size.infinite, painter: _MiniGridPainter(isDark: isDark)),
                  ),
                  Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 22, height: 22,
                          decoration: const BoxDecoration(color: AppColors.orange, shape: BoxShape.circle),
                          child: const Icon(Icons.location_on, size: 13, color: Colors.white),
                        ),
                        Container(width: 2, height: 10, color: AppColors.orange),
                      ],
                    ),
                  ),
                  if (o['endereco'] != null)
                    Positioned(
                      bottom: 6, left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xCC1A1D27) : const Color(0xCCFFFFFF),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(o['endereco'] as String, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600)),
                      ),
                    ),
                ],
              ),
            ),
          ],

          // Timeline
          if (widget.expanded) ...[
            const SizedBox(height: 16),
            Text('HISTÓRICO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: isDark ? AppColors.darkMuted : AppColors.lightMuted)),
            const SizedBox(height: 10),
            ...steps.asMap().entries.map((e) => TimelineItem(
              label: e.value.$1,
              subtitle: e.value.$2,
              done: e.value.$3,
              isLast: e.key == steps.length - 1,
            )),
          ],

          // Ações
          if (status != 'resolvida' && status != 'cancelada') ...[
            const SizedBox(height: 14),
            if (status == 'aberta')
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _loading ? null : () => _action('em_andamento'),
                  icon: _loading
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('🚑', style: TextStyle(fontSize: 14)),
                  label: const Text('Iniciar Atendimento'),
                ),
              ),
            if (status == 'em_andamento') ...[
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _loading ? null : () => _action('resolvida'),
                  icon: const Text('✅', style: TextStyle(fontSize: 14)),
                  label: const Text('Marcar como Resolvida'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.prioBaixa,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  String _timeAgo(String? iso) {
    if (iso == null) return '—';
    try {
      final dt = DateTime.parse(iso);
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'agora mesmo';
      if (diff.inMinutes < 60) return '${diff.inMinutes}min atrás';
      if (diff.inHours < 24) return '${diff.inHours}h atrás';
      return '${diff.inDays}d atrás';
    } catch (_) { return '—'; }
  }
}

class _CategoryIcon extends StatelessWidget {
  final String nome;
  const _CategoryIcon(this.nome);

  static const _map = {
    'desliz': (Icons.landslide_outlined, AppColors.prioAlta),
    'alaga':  (Icons.water, AppColors.info),
    'incên':  (Icons.local_fire_department, AppColors.prioCritica),
    'elétr':  (Icons.bolt, AppColors.prioNormal),
    'via':    (Icons.construction, AppColors.prioNormal),
    'vazam':  (Icons.water_drop_outlined, AppColors.info),
  };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final lower = nome.toLowerCase();
    IconData icon = Icons.warning_amber_outlined;
    Color color = AppColors.prioNormal;
    for (final e in _map.entries) {
      if (lower.contains(e.key)) { icon = e.value.$1; color = e.value.$2; break; }
    }
    return Container(
      width: 40, height: 40,
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Icon(icon, color: color, size: 20),
    );
  }
}

class _MiniGridPainter extends CustomPainter {
  final bool isDark;
  _MiniGridPainter({required this.isDark});
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = (isDark ? Colors.white : Colors.black).withOpacity(0.04)..strokeWidth = 1;
    const step = 18.0;
    for (double x = 0; x < size.width; x += step) canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    for (double y = 0; y < size.height; y += step) canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
  }
  @override bool shouldRepaint(_) => false;
}
