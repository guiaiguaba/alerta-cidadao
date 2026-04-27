// lib/features/citizen/map/citizen_map_screen.dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/providers.dart';

class CitizenMapScreen extends ConsumerStatefulWidget {
  const CitizenMapScreen({super.key});

  @override
  ConsumerState<CitizenMapScreen> createState() => _CitizenMapScreenState();
}

class _CitizenMapScreenState extends ConsumerState<CitizenMapScreen> {
  final _mapCtrl = MapController();
  List<_MapOccurrence> _occurrences = [];
  _MapOccurrence?     _selected;
  bool                _loading = true;
  Timer?              _refreshTimer;

  // Centro padrão: Iguaba Grande, RJ (configurável por tenant)
  static const _defaultCenter = LatLng(-22.8486, -42.0085);

  @override
  void initState() {
    super.initState();
    _loadData();
    // Atualizar mapa a cada 2 minutos quando online
    _refreshTimer = Timer.periodic(const Duration(minutes: 2), (_) {
      if (ref.read(isOnlineProvider)) _loadData();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _mapCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final geoJson = await api.getMapData(status: 'open');
      final features = (geoJson['features'] as List?) ?? [];

      setState(() {
        _occurrences = features.map((f) {
          final coords = f['geometry']['coordinates'] as List;
          final props  = f['properties'] as Map<String, dynamic>;
          return _MapOccurrence(
            id:           props['id'] ?? '',
            protocol:     props['protocol'] ?? '',
            priority:     props['priority'] ?? 'medium',
            status:       props['status'] ?? 'open',
            categoryName: props['categoryName'] ?? '',
            address:      props['address'],
            thumbnail:    props['thumbnail'],
            position:     LatLng(coords[1].toDouble(), coords[0].toDouble()),
          );
        }).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOnline = ref.watch(isOnlineProvider);

    return Scaffold(
      body: Stack(
        children: [
          // ==========================================
          // MAPA
          // ==========================================
          FlutterMap(
            mapController: _mapCtrl,
            options: MapOptions(
              initialCenter: _defaultCenter,
              initialZoom:   13.0,
              minZoom:       8.0,
              maxZoom:       18.0,
              onTap: (_, __) => setState(() => _selected = null),
            ),
            children: [
              // Tile layer (CartoDB Dark Matter)
              TileLayer(
                urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                subdomains:  const ['a', 'b', 'c', 'd'],
                userAgentPackageName: 'com.alertacidadao.citizen',
                retinaMode: true,
              ),

              // Marcadores
              MarkerLayer(
                markers: _occurrences.map((occ) {
                  final color = AppColors.priorityColor(occ.priority);
                  final isSelected = _selected?.id == occ.id;

                  return Marker(
                    point:  occ.position,
                    width:  isSelected ? 28 : 20,
                    height: isSelected ? 28 : 20,
                    child: GestureDetector(
                      onTap: () => setState(() => _selected = occ),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        decoration: BoxDecoration(
                          color:       color,
                          shape:       BoxShape.circle,
                          border:      Border.all(
                            color: Colors.white.withOpacity(0.6),
                            width: isSelected ? 3 : 1.5,
                          ),
                          boxShadow: isSelected
                            ? [BoxShadow(color: color.withOpacity(0.6), blurRadius: 12, spreadRadius: 2)]
                            : [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 4)],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),

          // ==========================================
          // HEADER OVERLAY
          // ==========================================
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  // Stats card
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color:        AppColors.surface.withOpacity(0.92),
                      borderRadius: BorderRadius.circular(20),
                      border:       Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8, height: 8,
                          decoration: const BoxDecoration(
                            color: AppColors.statusOpen, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${_occurrences.length} abertas',
                          style: const TextStyle(
                            fontFamily:  'IBMPlexMono',
                            fontSize:    12,
                            fontWeight:  FontWeight.w500,
                            color:       AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),

                  // Offline indicator
                  if (!isOnline)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color:        AppColors.criticalBg.withOpacity(0.9),
                        borderRadius: BorderRadius.circular(12),
                        border:       Border.all(color: AppColors.criticalBorder),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.wifi_off, size: 12, color: AppColors.critical),
                          SizedBox(width: 4),
                          Text('OFFLINE', style: TextStyle(
                            fontFamily: 'IBMPlexMono', fontSize: 9,
                            color: AppColors.critical, fontWeight: FontWeight.w600,
                          )),
                        ],
                      ),
                    ),

                  const SizedBox(width: 8),

                  // Refresh
                  GestureDetector(
                    onTap: _loadData,
                    child: Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        color:        AppColors.surface.withOpacity(0.92),
                        shape:        BoxShape.circle,
                        border:       Border.all(color: AppColors.border),
                      ),
                      child: _loading
                        ? const Padding(
                            padding: EdgeInsets.all(8),
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.amber),
                          )
                        : const Icon(Icons.refresh, size: 18, color: AppColors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ==========================================
          // POPUP DO MARCADOR SELECIONADO
          // ==========================================
          if (_selected != null)
            Positioned(
              left: 16, right: 16, bottom: 100,
              child: GestureDetector(
                onTap: () => context.push('/citizen/occurrences/${_selected!.id}'),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color:        AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border:       Border.all(
                      color: AppColors.priorityColor(_selected!.priority).withOpacity(0.4),
                    ),
                    boxShadow: [BoxShadow(
                      color:     Colors.black.withOpacity(0.3),
                      blurRadius: 16,
                      offset:    const Offset(0, 4),
                    )],
                  ),
                  child: Row(
                    children: [
                      // Thumbnail ou ícone
                      Container(
                        width: 56, height: 56,
                        decoration: BoxDecoration(
                          color:        AppColors.priorityColor(_selected!.priority).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: _selected!.thumbnail != null
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(_selected!.thumbnail!, fit: BoxFit.cover),
                            )
                          : Icon(
                              Icons.warning_amber_rounded,
                              color: AppColors.priorityColor(_selected!.priority),
                              size: 28,
                            ),
                      ),

                      const SizedBox(width: 12),

                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _selected!.protocol,
                              style: const TextStyle(
                                fontFamily:  'IBMPlexMono',
                                fontSize:    11,
                                color:       AppColors.amber,
                                fontWeight:  FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _selected!.categoryName,
                              style: const TextStyle(
                                fontSize:   14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            if (_selected!.address != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                _selected!.address!,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color:    AppColors.textSecondary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ],
                        ),
                      ),

                      Column(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          _PriorityDot(priority: _selected!.priority),
                          const SizedBox(height: 8),
                          const Icon(Icons.chevron_right, color: AppColors.textTertiary, size: 18),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // ==========================================
          // LEGEND
          // ==========================================
          Positioned(
            left: 12, bottom: 16,
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color:        AppColors.surface.withOpacity(0.9),
                borderRadius: BorderRadius.circular(10),
                border:       Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('PRIORIDADE', style: TextStyle(
                    fontFamily: 'IBMPlexMono', fontSize: 9,
                    letterSpacing: 0.8, color: AppColors.textTertiary,
                  )),
                  const SizedBox(height: 6),
                  ...['critical', 'high', 'medium', 'low'].map((p) {
                    final labels = {
                      'critical': 'Crítica',
                      'high':     'Alta',
                      'medium':   'Média',
                      'low':      'Baixa',
                    };
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 8, height: 8,
                            decoration: BoxDecoration(
                              color: AppColors.priorityColor(p), shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 6),
                          Text(labels[p]!, style: const TextStyle(
                            fontSize: 10, color: AppColors.textSecondary)),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PriorityDot extends StatelessWidget {
  final String priority;
  const _PriorityDot({required this.priority});

  @override
  Widget build(BuildContext context) => Container(
    width: 10, height: 10,
    decoration: BoxDecoration(
      color: AppColors.priorityColor(priority), shape: BoxShape.circle),
  );
}

class _MapOccurrence {
  final String   id;
  final String   protocol;
  final String   priority;
  final String   status;
  final String   categoryName;
  final String?  address;
  final String?  thumbnail;
  final LatLng   position;

  const _MapOccurrence({
    required this.id,
    required this.protocol,
    required this.priority,
    required this.status,
    required this.categoryName,
    this.address,
    this.thumbnail,
    required this.position,
  });
}
