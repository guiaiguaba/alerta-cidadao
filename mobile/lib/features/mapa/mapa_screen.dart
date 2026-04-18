import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';

const _orange = Color(0xFFFF6B2B);

final mapaOcorrenciasProvider = FutureProvider<List<dynamic>>((ref) async {
  final data = await ref.read(apiClientProvider).getOcorrencias(limit: 200);
  return data['data'] as List? ?? [];
});

class MapaScreen extends ConsumerWidget {
  const MapaScreen({super.key});

  static const _statusCfg = {
    'aberta':       ('Aberta',       Color(0xFFEF4444)),
    'em_andamento': ('Em atendimento', Color(0xFFFF6B2B)),
    'resolvida':    ('Resolvida',    Color(0xFF22C55E)),
    'cancelada':    ('Cancelada',    Color(0xFF9CA3AF)),
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final async  = ref.watch(mapaOcorrenciasProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mapa de Ocorrências'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () => ref.invalidate(mapaOcorrenciasProvider),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorView(message: '$e', onRetry: () => ref.invalidate(mapaOcorrenciasProvider), isDark: isDark),
        data: (ocorrencias) {
          final valid = ocorrencias
              .where((o) => o['latitude'] != null && o['longitude'] != null)
              .toList();

          if (valid.isEmpty) {
            return Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Text('🗺️', style: TextStyle(fontSize: 56)),
                const SizedBox(height: 12),
                Text('Nenhuma ocorrência no mapa',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF0F1117))),
                const SizedBox(height: 6),
                Text('As ocorrências aparecerão aqui',
                  style: TextStyle(fontSize: 13,
                    color: isDark ? const Color(0xFF8B90A0) : const Color(0xFF6B7280))),
              ]),
            );
          }

          // Calcula centro
          final lats = valid.map((o) => (o['latitude'] as num).toDouble());
          final lngs = valid.map((o) => (o['longitude'] as num).toDouble());
          final center = LatLng(
            lats.reduce((a, b) => a + b) / lats.length,
            lngs.reduce((a, b) => a + b) / lngs.length,
          );

          final markers = valid.map<Marker>((o) {
            final lat    = (o['latitude']  as num).toDouble();
            final lng    = (o['longitude'] as num).toDouble();
            final status = o['status'] as String? ?? 'aberta';
            final (_, color) = _statusCfg[status] ?? ('', const Color(0xFFFF6B2B));

            return Marker(
              point: LatLng(lat, lng),
              width: 38, height: 38,
              child: GestureDetector(
                onTap: () => _showPopup(context, o, isDark),
                child: Container(
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2.5),
                    boxShadow: [
                      BoxShadow(color: color.withOpacity(0.4), blurRadius: 8, spreadRadius: 1),
                    ],
                  ),
                  child: const Icon(Icons.warning_amber_rounded, size: 18, color: Colors.white),
                ),
              ),
            );
          }).toList();

          return Stack(
            children: [
              FlutterMap(
                options: MapOptions(
                  initialCenter: center,
                  initialZoom: valid.length == 1 ? 15 : 13,
                ),
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
                bottom: 16, left: 12,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFF1A1D27).withOpacity(0.95)
                        : Colors.white.withOpacity(0.95),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isDark ? const Color(0xFF2E3347) : const Color(0xFFE5E7EB)),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 8)],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: _statusCfg.entries.map((e) {
                      final (label, color) = e.value;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Container(width: 10, height: 10,
                            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                          const SizedBox(width: 7),
                          Text(label,
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500,
                              color: isDark ? Colors.white70 : const Color(0xFF374151))),
                        ]),
                      );
                    }).toList(),
                  ),
                ),
              ),

              // Badge contador
              Positioned(
                top: 12, right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFF1A1D27).withOpacity(0.95)
                        : Colors.white.withOpacity(0.95),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isDark ? const Color(0xFF2E3347) : const Color(0xFFE5E7EB)),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 6)],
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Container(width: 7, height: 7,
                      decoration: const BoxDecoration(color: _orange, shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                    Text(
                      '${valid.length} ocorrência${valid.length == 1 ? '' : 's'}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : const Color(0xFF0F1117)),
                    ),
                  ]),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showPopup(BuildContext context, dynamic o, bool isDark) {
    final status = o['status'] as String? ?? 'aberta';
    final (sLabel, sColor) = _statusCfg[status] ?? ('Aberta', const Color(0xFFEF4444));

    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1A1D27) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Handle
          Center(child: Container(width: 36, height: 4, margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2E3347) : const Color(0xFFE5E7EB),
              borderRadius: BorderRadius.circular(2)))),

          // Categoria + badge
          Row(children: [
            Expanded(
              child: Text(o['categoria_nome'] as String? ?? 'Ocorrência',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16,
                  color: isDark ? Colors.white : const Color(0xFF0F1117))),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: sColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: sColor.withOpacity(0.35)),
              ),
              child: Text(sLabel, style: TextStyle(color: sColor, fontSize: 11, fontWeight: FontWeight.w700)),
            ),
          ]),
          const SizedBox(height: 8),

          // Descrição
          Text(
            o['descricao'] as String? ?? '',
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 13, height: 1.5,
              color: isDark ? const Color(0xFF8B90A0) : const Color(0xFF6B7280)),
          ),

          // Endereço
          if (o['endereco'] != null) ...[
            const SizedBox(height: 6),
            Row(children: [
              Icon(Icons.location_on_outlined, size: 14,
                color: isDark ? const Color(0xFF8B90A0) : const Color(0xFF9CA3AF)),
              const SizedBox(width: 4),
              Expanded(child: Text(o['endereco'] as String,
                style: TextStyle(fontSize: 12,
                  color: isDark ? const Color(0xFF8B90A0) : const Color(0xFF9CA3AF)),
                overflow: TextOverflow.ellipsis)),
            ]),
          ],
          const SizedBox(height: 16),

          // Botão ver detalhes
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () { Navigator.pop(context); context.go('/ocorrencias/${o['id']}'); },
              style: ElevatedButton.styleFrom(
                backgroundColor: _orange, foregroundColor: Colors.white,
                elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 13)),
              child: const Text('Ver detalhes', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ]),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final bool isDark;
  const _ErrorView({required this.message, required this.onRetry, required this.isDark});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.wifi_off_outlined, size: 48, color: Color(0xFFEF4444)),
        const SizedBox(height: 12),
        Text('Erro ao carregar mapa',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : const Color(0xFF0F1117))),
        const SizedBox(height: 6),
        Text(message, textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12,
            color: isDark ? const Color(0xFF8B90A0) : const Color(0xFF6B7280))),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Tentar novamente'),
        ),
      ]),
    ),
  );
}
