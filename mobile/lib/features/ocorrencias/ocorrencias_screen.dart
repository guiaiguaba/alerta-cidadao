import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';

final ocorrenciasProvider = FutureProvider.family<Map<String, dynamic>, String?>((ref, status) async {
  final client = ref.read(apiClientProvider);
  return client.getOcorrencias(status: status, limit: 30);
});

class OcorrenciasScreen extends ConsumerStatefulWidget {
  const OcorrenciasScreen({super.key});

  @override
  ConsumerState<OcorrenciasScreen> createState() => _OcorrenciasScreenState();
}

class _OcorrenciasScreenState extends ConsumerState<OcorrenciasScreen> {
  String? _statusFilter;

  static const _statuses = ['aberta', 'em_andamento', 'resolvida', 'cancelada'];

  static const _statusColors = {
    'aberta': Color(0xFFEF4444),
    'em_andamento': Color(0xFFF97316),
    'resolvida': Color(0xFF22C55E),
    'cancelada': Color(0xFF9CA3AF),
  };

  static const _priorColors = {
    'baixa': Color(0xFF9CA3AF),
    'normal': Color(0xFFEAB308),
    'alta': Color(0xFFF97316),
    'critica': Color(0xFFEF4444),
  };

  @override
  Widget build(BuildContext context) {
    final dbUser = ref.watch(dbUserProvider).valueOrNull;
    final role = dbUser?['role'] ?? 'citizen';
    final ocorrenciasAsync = ref.watch(ocorrenciasProvider(_statusFilter));

    return Scaffold(
      appBar: AppBar(
        title: Text(role == 'citizen' ? 'Minhas Ocorrências' : 'Todas as Ocorrências'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(ocorrenciasProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                _chip('Todos', null),
                ..._statuses.map((s) => _chip(s.replaceAll('_', ' '), s)),
              ],
            ),
          ),

          // List
          Expanded(
            child: ocorrenciasAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Erro: $e')),
              data: (data) {
                final items = (data['data'] as List?) ?? [];
                if (items.isEmpty) {
                  return const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.inbox_outlined, size: 64, color: Colors.grey),
                        SizedBox(height: 12),
                        Text('Nenhuma ocorrência', style: TextStyle(color: Colors.grey)),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(ocorrenciasProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final o = items[i] as Map<String, dynamic>;
                      final status = o['status'] as String? ?? '';
                      final prioridade = o['prioridade'] as String? ?? 'normal';
                      return Card(
                        elevation: 1,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => context.go('/ocorrencias/${o['id']}'),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    _badge(status.replaceAll('_', ' '), _statusColors[status] ?? Colors.grey),
                                    const SizedBox(width: 6),
                                    _badge(prioridade, _priorColors[prioridade] ?? Colors.grey),
                                    const Spacer(),
                                    if (o['categoria_nome'] != null)
                                      Text(o['categoria_nome'] as String, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  o['descricao'] as String? ?? '',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 14),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, String? value) {
    final selected = _statusFilter == value;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(label, style: TextStyle(fontSize: 12, color: selected ? Colors.white : Colors.black87)),
        selected: selected,
        selectedColor: const Color(0xFFFF6B2B),
        onSelected: (_) => setState(() => _statusFilter = value),
      ),
    );
  }

  Widget _badge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}
