// lib/features/agent/map/agent_map_screen.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/providers.dart';

class AgentMapScreen extends ConsumerStatefulWidget {
  const AgentMapScreen({super.key});

  @override
  ConsumerState<AgentMapScreen> createState() => _AgentMapScreenState();
}

class _AgentMapScreenState extends ConsumerState<AgentMapScreen> {
  final _mapCtrl = MapController();

  List<_AgentMarker>    _occurrences    = [];
  LatLng?               _agentPosition;
  StreamSubscription?   _positionSub;
  String?               _selectedId;
  bool                  _loading        = true;
  String                _filterPriority = 'all';
  Timer?                _refreshTimer;

  static const _defaultCenter = LatLng(-22.8486, -42.0085);

  @override
  void initState() {
    super.initState();
    _loadData();
    _startLocationTracking();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (ref.read(isOnlineProvider)) _loadData();
    });
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    _refreshTimer?.cancel();
    _mapCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final api   = ref.read(apiClientProvider);
      final geoJs = await api.getMapData(
        status: 'open,assigned,in_progress',
      );

      final features = (geoJs['features'] as List?) ?? [];

      setState(() {
        _occurrences = features
            .whereType<Map>() // garante que é Map
            .map<_AgentMarker?>((f) {
          final geometry = f['geometry'];
          final props    = f['properties'];

          if (geometry is! Map || props is! Map) return null;

          final coords = geometry['coordinates'];

          if (coords is! List || coords.length < 2) return null;

          final lat = (coords[1] as num?)?.toDouble();
          final lng = (coords[0] as num?)?.toDouble();

          if (lat == null || lng == null) return null;

          return _AgentMarker(
            id:           props['id']?.toString() ?? '',
            protocol:     props['protocol']?.toString() ?? '',
            priority:     props['priority']?.toString() ?? 'medium',
            status:       props['status']?.toString() ?? 'open',
            categoryName: props['categoryName']?.toString() ?? '',
            address:      props['address']?.toString(),
            position:     LatLng(lat, lng),
          );
        })
            .whereType<_AgentMarker>() // remove nulls
            .toList();

        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _startLocationTracking() {
    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy:      LocationAccuracy.high,
        distanceFilter: 15,
      ),
    ).listen((pos) {
      setState(() {
        _agentPosition = LatLng(pos.latitude, pos.longitude);
      });
    }, onError: (_) {}); // Silenciar erros de permissão
  }

  void _centerOnAgent() {
    if (_agentPosition != null) {
      _mapCtrl.move(_agentPosition!, 16.0);
    }
  }

  List<_AgentMarker> get _filtered {
    if (_filterPriority == 'all') return _occurrences;
    return _occurrences.where((o) => o.priority == _filterPriority).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // ==========================================
          // MAPA
          // ==========================================
          FlutterMap(
            mapController: _mapCtrl,
            options: MapOptions(
              initialCenter: _agentPosition ?? _defaultCenter,
              initialZoom:   13.0,
              minZoom:       8.0,
              maxZoom:       19.0,
              onTap: (_, __) => setState(() => _selectedId = null),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                subdomains:  const ['a', 'b', 'c', 'd'],
                userAgentPackageName: 'com.alertacidadao.agent',
                retinaMode: true,
              ),

              // Marcadores de ocorrências
              MarkerLayer(
                markers: _filtered.map((occ) {
                  final color      = AppColors.priorityColor(occ.priority);
                  final isSelected = _selectedId == occ.id;

                  return Marker(
                    point:  occ.position,
                    width:  isSelected ? 36 : 26,
                    height: isSelected ? 36 : 26,
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedId = occ.id),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            decoration: BoxDecoration(
                              color:  color,
                              shape:  BoxShape.circle,
                              border: Border.all(
                                color: Colors.white.withOpacity(0.5),
                                width: isSelected ? 3 : 1.5,
                              ),
                              boxShadow: [BoxShadow(
                                color:      color.withOpacity(isSelected ? 0.7 : 0.3),
                                blurRadius: isSelected ? 16 : 6,
                                spreadRadius: isSelected ? 2 : 0,
                              )],
                            ),
                          ),
                          // Ícone de status para "em andamento"
                          if (occ.status == 'in_progress')
                            const Icon(Icons.engineering, size: 12, color: Colors.white),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),

              // Marcador do agente
              if (_agentPosition != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point:  _agentPosition!,
                      width:  22,
                      height: 22,
                      child: Container(
                        decoration: BoxDecoration(
                          color:  AppColors.info,
                          shape:  BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2.5),
                          boxShadow: [BoxShadow(
                            color: AppColors.info.withOpacity(0.4),
                            blurRadius: 10,
                          )],
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),

          // ==========================================
          // FILTROS
          // ==========================================
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Filter row
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _FilterChip(
                          label:    'Todas (${_occurrences.length})',
                          selected: _filterPriority == 'all',
                          color:    AppColors.textSecondary,
                          onTap:    () => setState(() => _filterPriority = 'all'),
                        ),
                        const SizedBox(width: 6),
                        ...['critical', 'high', 'medium'].map((p) {
                          final count = _occurrences.where((o) => o.priority == p).length;
                          return Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: _FilterChip(
                              label:    '${p[0].toUpperCase()}${p.substring(1)} ($count)',
                              selected: _filterPriority == p,
                              color:    AppColors.priorityColor(p),
                              onTap:    () => setState(() => _filterPriority = p),
                            ),
                          );
                        }),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ==========================================
          // POPUP SELECIONADO
          // ==========================================
          if (_selectedId != null)
            Positioned(
              left: 12, right: 12, bottom: 20,
              child: Builder(
                builder: (_) {
                  final occ = _filtered.firstWhere(
                    (o) => o.id == _selectedId,
                    orElse: () => _filtered.first,
                  );
                  return _OccurrencePopup(
                    occ:          occ,
                    agentPosition: _agentPosition,
                    onNavigate:   () => _navigateTo(occ.position),
                    onDetail:     () => context.push('/agent/occurrences/${occ.id}'),
                  );
                },
              ),
            ),

          // ==========================================
          // FAB: centrar em mim
          // ==========================================
          Positioned(
            right: 12,
            bottom: _selectedId != null ? 160 : 20,
            child: Column(
              children: [
                FloatingActionButton.small(
                  heroTag:   'refresh_map',
                  onPressed: _loadData,
                  backgroundColor: AppColors.surface,
                  foregroundColor: AppColors.textSecondary,
                  child: _loading
                    ? const SizedBox(
                        width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.amber))
                    : const Icon(Icons.refresh, size: 18),
                ),
                const SizedBox(height: 8),
                FloatingActionButton.small(
                  heroTag:   'center_me',
                  onPressed: _centerOnAgent,
                  backgroundColor: AppColors.info.withOpacity(0.9),
                  child: const Icon(Icons.my_location, size: 18),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _navigateTo(LatLng destination) {
    // Em produção: abrir Maps nativo via url_launcher
    // 'geo:${destination.latitude},${destination.longitude}?q=${destination.latitude},${destination.longitude}'
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Navegando para: ${destination.latitude.toStringAsFixed(4)}, ${destination.longitude.toStringAsFixed(4)}'),
        action: SnackBarAction(label: 'Fechar', onPressed: () {}),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String   label;
  final bool     selected;
  final Color    color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color:        selected ? color.withOpacity(0.15) : AppColors.surface.withOpacity(0.88),
        borderRadius: BorderRadius.circular(20),
        border:       Border.all(color: selected ? color.withOpacity(0.5) : AppColors.border),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontFamily:  'IBMPlexMono',
          fontSize:    11,
          fontWeight:  FontWeight.w500,
          color:       selected ? color : AppColors.textSecondary,
        ),
      ),
    ),
  );
}

class _OccurrencePopup extends StatelessWidget {
  final _AgentMarker   occ;
  final LatLng?        agentPosition;
  final VoidCallback   onNavigate;
  final VoidCallback   onDetail;

  const _OccurrencePopup({
    required this.occ,
    this.agentPosition,
    required this.onNavigate,
    required this.onDetail,
  });

  String? _distanceLabel() {
    if (agentPosition == null) return null;
    const calc = Distance();
    final m = calc.as(LengthUnit.Meter, agentPosition!, occ.position);
    if (m < 1000) return '${m.round()}m de distância';
    return '${(m / 1000).toStringAsFixed(1)}km de distância';
  }

  @override
  Widget build(BuildContext context) {
    final color    = AppColors.priorityColor(occ.priority);
    final distance = _distanceLabel();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color:        AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border:       Border.all(color: color.withOpacity(0.35)),
        boxShadow:    [BoxShadow(color: Colors.black.withOpacity(0.4), blurRadius: 20, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Text(occ.protocol, style: const TextStyle(
                fontFamily: 'IBMPlexMono', fontSize: 12,
                color: AppColors.amber, fontWeight: FontWeight.w600,
              )),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color:        color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(4),
                  border:       Border.all(color: color.withOpacity(0.3)),
                ),
                child: Text(
                  occ.priority.toUpperCase(),
                  style: TextStyle(
                    fontFamily: 'IBMPlexMono', fontSize: 9,
                    fontWeight: FontWeight.w700, color: color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(occ.categoryName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
          if (occ.address != null)
            Text(occ.address!, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          if (distance != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(distance, style: const TextStyle(
                fontSize: 11, color: AppColors.info, fontFamily: 'IBMPlexMono')),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onNavigate,
                  icon:  const Icon(Icons.navigation_outlined, size: 16),
                  label: const Text('Navegar'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    side:    BorderSide(color: AppColors.info.withOpacity(0.4)),
                    foregroundColor: AppColors.info,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onDetail,
                  icon:  const Icon(Icons.open_in_new, size: 16),
                  label: const Text('Ver detalhes'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AgentMarker {
  final String id;
  final String protocol;
  final String priority;
  final String status;
  final String categoryName;
  final String? address;
  final LatLng position;

  const _AgentMarker({
    required this.id,
    required this.protocol,
    required this.priority,
    required this.status,
    required this.categoryName,
    this.address,
    required this.position,
  });
}
