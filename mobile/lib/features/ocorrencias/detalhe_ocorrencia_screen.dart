import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';

final detalheOcorrenciaProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  return ref.read(apiClientProvider).getOcorrencia(id);
});

class DetalheOcorrenciaScreen extends ConsumerWidget {
  final String id;
  const DetalheOcorrenciaScreen({super.key, required this.id});

  static const _statusColors = {
    'aberta': Color(0xFFEF4444),
    'em_andamento': Color(0xFFF97316),
    'resolvida': Color(0xFF22C55E),
    'cancelada': Color(0xFF9CA3AF),
  };

  static const _statusLabels = {
    'aberta': 'Aberta',
    'em_andamento': 'Em Andamento',
    'resolvida': 'Resolvida',
    'cancelada': 'Cancelada',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(detalheOcorrenciaProvider(id));
    final dbUser = ref.watch(dbUserProvider).valueOrNull;
    final role = dbUser?['role'] ?? 'citizen';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalhes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(detalheOcorrenciaProvider(id)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (o) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Status + prioridade
            Row(
              children: [
                _badge(
                  _statusLabels[o['status']] ?? o['status'],
                  _statusColors[o['status']] ?? Colors.grey,
                ),
                const SizedBox(width: 8),
                _badge(
                  o['prioridade'] as String? ?? 'normal',
                  _priorColor(o['prioridade'] as String? ?? 'normal'),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (o['categoria_nome'] != null)
              _infoRow(Icons.category_outlined, o['categoria_nome'] as String),
            const SizedBox(height: 12),

            // Descrição
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Text(o['descricao'] as String? ?? '', style: const TextStyle(fontSize: 15, height: 1.5)),
            ),
            const SizedBox(height: 12),

            _infoRow(
              Icons.location_on_outlined,
              o['endereco'] as String? ??
                  '${(o['latitude'] as num?)?.toStringAsFixed(5)}, ${(o['longitude'] as num?)?.toStringAsFixed(5)}',
            ),

            if (o['autor_nome'] != null)
              _infoRow(Icons.person_outline, o['autor_nome'] as String),

            if (o['agente_nome'] != null)
              _infoRow(Icons.engineering_outlined, 'Agente: ${o['agente_nome']}'),

            if (o['resolucao_nota'] != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Nota de Resolução', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                    const SizedBox(height: 6),
                    Text(o['resolucao_nota'] as String),
                  ],
                ),
              ),
            ],

            // Imagens
            if ((o['imagens'] as List?)?.isNotEmpty == true) ...[
              const SizedBox(height: 16),
              const Text('Imagens', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
              const SizedBox(height: 8),
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
                      child: Image.network(
                        img['url'] as String,
                        width: 110,
                        height: 110,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 110, height: 110,
                          color: Colors.grey.shade200,
                          child: const Icon(Icons.broken_image_outlined),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],

            // Ações agente/admin
            if (role == 'agent' || role == 'admin') ...[
              const SizedBox(height: 24),
              const Divider(),
              const SizedBox(height: 12),
              const Text('Ações do Agente', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
              const SizedBox(height: 12),
              _AgentActions(ocorrencia: o, onUpdated: () => ref.invalidate(detalheOcorrenciaProvider(id))),
            ],

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _badge(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
    child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
  );

  Widget _infoRow(IconData icon, String text) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      Icon(icon, size: 18, color: Colors.grey),
      const SizedBox(width: 8),
      Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
    ]),
  );

  Color _priorColor(String p) => const {
    'baixa': Color(0xFF9CA3AF),
    'normal': Color(0xFF3B82F6),
    'alta': Color(0xFFF97316),
    'critica': Color(0xFFEF4444),
  }[p] ?? Colors.grey;
}

class _AgentActions extends ConsumerStatefulWidget {
  final Map<String, dynamic> ocorrencia;
  final VoidCallback onUpdated;
  const _AgentActions({required this.ocorrencia, required this.onUpdated});

  @override
  ConsumerState<_AgentActions> createState() => _AgentActionsState();
}

class _AgentActionsState extends ConsumerState<_AgentActions> {
  bool _loading = false;

  Future<void> _updateStatus(String status) async {
    setState(() => _loading = true);
    try {
      await ref.read(apiClientProvider).updateOcorrencia(widget.ocorrencia['id'] as String, status: status);
      widget.onUpdated();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Status atualizado: $status'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _uploadFoto() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.camera, imageQuality: 75);
    if (file == null) return;
    setState(() => _loading = true);
    try {
      await ref.read(apiClientProvider).uploadImagens(
        widget.ocorrencia['id'] as String,
        [file.path],
        tipo: 'depois',
      );
      widget.onUpdated();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erro upload: $e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.ocorrencia['status'] as String? ?? '';
    final canProgress = status != 'resolvida' && status != 'cancelada';

    if (!canProgress) {
      return Text('Ocorrência já encerrada ($status)', style: const TextStyle(color: Colors.grey));
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        if (status == 'aberta')
          _actionBtn('Assumir', Icons.engineering, Colors.orange, () => _updateStatus('em_andamento')),
        if (status == 'em_andamento')
          _actionBtn('Resolver', Icons.check_circle_outline, Colors.green, () => _updateStatus('resolvida')),
        _actionBtn('Cancelar', Icons.cancel_outlined, Colors.grey, () => _updateStatus('cancelada')),
        _actionBtn('📷 Foto', Icons.camera_alt_outlined, const Color(0xFF1D4ED8), _uploadFoto),
        if (_loading) const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
      ],
    );
  }

  Widget _actionBtn(String label, IconData icon, Color color, VoidCallback onTap) =>
      OutlinedButton.icon(
        onPressed: _loading ? null : onTap,
        icon: Icon(icon, size: 16, color: color),
        label: Text(label, style: TextStyle(color: color, fontSize: 13)),
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: color.withOpacity(0.5)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ),
      );
}
