import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';

const _orange = Color(0xFFFF6B2B);

final detalheOcorrenciaProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  return ref.read(apiClientProvider).getOcorrencia(id);
});

class DetalheOcorrenciaScreen extends ConsumerWidget {
  final String id;
  const DetalheOcorrenciaScreen({super.key, required this.id});

  static const _statusCfg = {
    'aberta':       ('Aberta',       Color(0xFFEF4444)),
    'em_andamento': ('Em Andamento', Color(0xFFFF6B2B)),
    'resolvida':    ('Resolvida',    Color(0xFF22C55E)),
    'cancelada':    ('Cancelada',    Color(0xFF9CA3AF)),
  };

  static const _prioCfg = {
    'baixa':   ('Baixa',   Color(0xFF22C55E)),
    'normal':  ('Média',   Color(0xFFEAB308)),
    'alta':    ('Alta',    Color(0xFFF97316)),
    'critica': ('Crítica', Color(0xFFEF4444)),
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark  = Theme.of(context).brightness == Brightness.dark;
    final async   = ref.watch(detalheOcorrenciaProvider(id));
    final dbUser  = ref.watch(dbUserProvider).valueOrNull;
    final role    = dbUser?['role'] ?? 'citizen';

    final bg      = isDark ? const Color(0xFF0F1117) : const Color(0xFFF4F5F7);
    final cardBg  = isDark ? const Color(0xFF21253A) : Colors.white;
    final border  = isDark ? const Color(0xFF2E3347) : const Color(0xFFE5E7EB);
    final muted   = isDark ? const Color(0xFF8B90A0) : const Color(0xFF6B7280);
    final text    = isDark ? Colors.white : const Color(0xFF0F1117);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        title: const Text('Detalhes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () => ref.invalidate(detalheOcorrenciaProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.error_outline, size: 48, color: Color(0xFFEF4444)),
              const SizedBox(height: 12),
              Text('Erro ao carregar ocorrência', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: text)),
              const SizedBox(height: 8),
              Text('$e', style: TextStyle(fontSize: 12, color: muted), textAlign: TextAlign.center),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: () => ref.invalidate(detalheOcorrenciaProvider(id)),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Tentar novamente'),
              ),
            ]),
          ),
        ),
        data: (o) {
          final status   = o['status'] as String? ?? '';
          final prioridade = o['prioridade'] as String? ?? 'normal';
          final (sLabel, sColor) = _statusCfg[status]   ?? ('—', const Color(0xFF9CA3AF));
          final (pLabel, pColor) = _prioCfg[prioridade] ?? ('Normal', Color(0xFFEAB308));

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Badges ──────────────────────────────────────
              Row(children: [
                _Badge(sLabel, sColor),
                const SizedBox(width: 8),
                _Badge(pLabel, pColor),
                if (o['categoria_nome'] != null) ...[
                  const SizedBox(width: 8),
                  Expanded(child: Text(o['categoria_nome'] as String,
                    style: TextStyle(fontSize: 12, color: muted), overflow: TextOverflow.ellipsis)),
                ],
              ]),
              const SizedBox(height: 16),

              // ── Descrição ────────────────────────────────────
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: border),
                ),
                child: Text(o['descricao'] as String? ?? '',
                  style: TextStyle(fontSize: 14, height: 1.6, color: text)),
              ),
              const SizedBox(height: 12),

              // ── Meta ─────────────────────────────────────────
              _InfoRow(Icons.location_on_outlined,
                o['endereco'] as String? ??
                '${(o['latitude'] as num?)?.toStringAsFixed(5)}, ${(o['longitude'] as num?)?.toStringAsFixed(5)}',
                muted),
              if (o['autor_nome'] != null)
                _InfoRow(Icons.person_outline, o['autor_nome'] as String, muted),
              if (o['agente_nome'] != null)
                _InfoRow(Icons.engineering_outlined, 'Agente: ${o['agente_nome']}', muted),

              // ── Nota de resolução ────────────────────────────
              if (o['resolucao_nota'] != null) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF22C55E).withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF22C55E).withOpacity(0.3)),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('✅ Nota de Resolução',
                      style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF22C55E), fontSize: 13)),
                    const SizedBox(height: 6),
                    Text(o['resolucao_nota'] as String, style: TextStyle(fontSize: 13, color: text)),
                  ]),
                ),
              ],

              // ── Imagens ──────────────────────────────────────
              if ((o['imagens'] as List?)?.isNotEmpty == true) ...[
                const SizedBox(height: 20),
                Text('FOTOS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: muted)),
                const SizedBox(height: 10),
                SizedBox(
                  height: 110,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: (o['imagens'] as List).length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      final img = (o['imagens'] as List)[i] as Map<String, dynamic>;
                      return ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.network(img['url'] as String, width: 110, height: 110, fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            width: 110, height: 110, color: isDark ? const Color(0xFF2E3347) : const Color(0xFFE5E7EB),
                            child: Icon(Icons.broken_image_outlined, color: muted))),
                      );
                    },
                  ),
                ),
              ],

              // ── Ações do agente ──────────────────────────────
              if (role == 'agent' || role == 'admin') ...[
                const SizedBox(height: 24),
                Divider(color: border),
                const SizedBox(height: 12),
                Text('AÇÕES DO AGENTE',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: muted)),
                const SizedBox(height: 12),
                _AgentActions(
                  ocorrencia: o,
                  onUpdated: () => ref.invalidate(detalheOcorrenciaProvider(id)),
                  isDark: isDark,
                  border: border,
                ),
              ],
              const SizedBox(height: 32),
            ],
          );
        },
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color color;
  const _Badge(this.label, this.color);
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: color.withOpacity(0.12),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withOpacity(0.35)),
    ),
    child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12)),
  );
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color muted;
  const _InfoRow(this.icon, this.text, this.muted);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      Icon(icon, size: 17, color: muted),
      const SizedBox(width: 8),
      Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: muted))),
    ]),
  );
}

// ─────────────────────────────────────────────────────────────
// Ações do agente
// ─────────────────────────────────────────────────────────────
class _AgentActions extends ConsumerStatefulWidget {
  final Map<String, dynamic> ocorrencia;
  final VoidCallback onUpdated;
  final bool isDark;
  final Color border;

  const _AgentActions({
    required this.ocorrencia,
    required this.onUpdated,
    required this.isDark,
    required this.border,
  });

  @override
  ConsumerState<_AgentActions> createState() => _AgentActionsState();
}

class _AgentActionsState extends ConsumerState<_AgentActions> {
  bool _loading = false;

  Future<void> _updateStatus(String status) async {
    setState(() => _loading = true);
    try {
      await ref.read(apiClientProvider).updateOcorrencia(
        widget.ocorrencia['id'] as String, status: status);
      widget.onUpdated();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Status atualizado: $status'),
          backgroundColor: const Color(0xFF22C55E)));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro: $e'), backgroundColor: const Color(0xFFEF4444)));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _uploadFoto() async {
    final file = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 75);
    if (file == null) return;
    setState(() => _loading = true);
    try {
      await ref.read(apiClientProvider).uploadImagens(
        widget.ocorrencia['id'] as String, [file.path], tipo: 'depois');
      widget.onUpdated();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro upload: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.ocorrencia['status'] as String? ?? '';

    if (status == 'resolvida' || status == 'cancelada') {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF22C55E).withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF22C55E).withOpacity(0.3)),
        ),
        child: Text(
          status == 'resolvida' ? '✅ Ocorrência encerrada como Resolvida' : '🚫 Ocorrência Cancelada',
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF22C55E)),
        ),
      );
    }

    return Column(children: [
      if (status == 'aberta')
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _loading ? null : () => _updateStatus('em_andamento'),
            icon: _loading
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('🚑', style: TextStyle(fontSize: 16)),
            label: const Text('Iniciar Atendimento', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),

      if (status == 'em_andamento') ...[
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _loading ? null : () => _updateStatus('resolvida'),
            icon: const Text('✅', style: TextStyle(fontSize: 16)),
            label: const Text('Marcar como Resolvida', style: TextStyle(fontWeight: FontWeight.w700)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF22C55E),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _loading ? null : _uploadFoto,
            icon: const Icon(Icons.camera_alt_outlined, size: 18, color: _orange),
            label: const Text('Adicionar Foto', style: TextStyle(color: _orange, fontWeight: FontWeight.w600)),
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: widget.border),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(vertical: 13),
            ),
          ),
        ),
      ],

      const SizedBox(height: 8),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: _loading ? null : () => _updateStatus('cancelada'),
          icon: const Icon(Icons.cancel_outlined, size: 18, color: Color(0xFF6B7280)),
          label: const Text('Cancelar Ocorrência', style: TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w600)),
          style: OutlinedButton.styleFrom(
            side: BorderSide(color: widget.border),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(vertical: 13),
          ),
        ),
      ),
    ]);
  }
}
