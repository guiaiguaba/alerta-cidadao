import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';

final mapaOcorrenciasProvider = FutureProvider<List<dynamic>>((ref) async {
  final data = await ref.read(apiClientProvider).getOcorrencias(limit: 100);
  return data['data'] as List? ?? [];
});

class MapaScreen extends ConsumerWidget {
  const MapaScreen({super.key});

  static const _statusColors = {
    'aberta': Color(0xFFEF4444),
    'em_andamento': Color(0xFFF97316),
    'resolvida': Color(0xFF22C55E),
    'cancelada': Color(0xFF9CA3AF),
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(mapaOcorrenciasProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mapa de Ocorrências'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(mapaOcorrenciasProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erro: $e')),
        data: (ocorrencias) {
          final valid = ocorrencias
              .where((o) => o['latitude'] != null && o['longitude'] != null)
              .toList();

          final markers = valid.map<Marker>((o) {
            final lat = (o['latitude'] as num).toDouble();
            final lng = (o['longitude'] as num).toDouble();
            final status = o['status'] as String? ?? 'aberta';
            final color = _statusColors[status] ?? Colors.blue;

            return Marker(
              point: LatLng(lat, lng),
              width: 36,
              height: 36,
              child: GestureDetector(
                onTap: () => _showPopup(context, o),
                child: Container(
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4, offset: const Offset(0, 2))],
                  ),
                  child: const Icon(Icons.warning_amber_rounded, size: 18, color: Colors.white),
                ),
              ),
            );
          }).toList();

          // Centro padrão: Brasil
          final center = valid.isNotEmpty
              ? LatLng(
                  (valid.map((o) => (o['latitude'] as num).toDouble()).reduce((a, b) => a + b)) / valid.length,
                  (valid.map((o) => (o['longitude'] as num).toDouble()).reduce((a, b) => a + b)) / valid.length,
                )
              : const LatLng(-22.9, -43.1);

          return Stack(
            children: [
              FlutterMap(
                options: MapOptions(initialCenter: center, initialZoom: 13),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.alertacidadao.app',
                  ),
                  MarkerLayer(markers: markers),
                ],
              ),
              // Legenda
              Positioned(
                bottom: 16,
                left: 16,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 6)],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: _statusColors.entries.map((e) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(width: 10, height: 10, decoration: BoxDecoration(color: e.value, shape: BoxShape.circle)),
                          const SizedBox(width: 6),
                          Text(e.key.replaceAll('_', ' '), style: const TextStyle(fontSize: 11)),
                        ],
                      ),
                    )).toList(),
                  ),
                ),
              ),
              // Contagem
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4)]),
                  child: Text('${valid.length} ocorrências', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showPopup(BuildContext context, dynamic o) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(o['categoria_nome'] as String? ?? 'Ocorrência', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            Text(o['descricao'] as String? ?? '', maxLines: 3, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                    context.go('/ocorrencias/${o['id']}');
                  },
                  child: const Text('Ver detalhes'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
