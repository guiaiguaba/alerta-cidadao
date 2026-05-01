// lib/features/citizen/map/citizen_map_screen.dart
import 'dart:async';
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
  _MapOccurrence? _selected;
  bool _loading = true;
  Timer? _refreshTimer;

  static const _defaultCenter = LatLng(-22.8486, -42.0085);

  @override
  void initState() {
    super.initState();
    _loadData();

    _refreshTimer = Timer.periodic(const Duration(minutes: 2), (_) {
      if (mounted && ref.read(isOnlineProvider)) {
        _loadData();
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadData() async {
    if (!mounted) return;

    setState(() => _loading = true);

    try {
      final api = ref.read(apiClientProvider);
      final geoJson = await api.getMapData(status: 'open');

      final features = (geoJson['features'] as List?) ?? [];

      final parsed = features.map<_MapOccurrence?>((f) {
        try {
          final geometry = f['geometry'] as Map<String, dynamic>?;
          final coords = geometry?['coordinates'] as List?;

          if (coords == null || coords.length < 2) return null;

          final lng = (coords[0] as num?)?.toDouble();
          final lat = (coords[1] as num?)?.toDouble();

          if (lat == null || lng == null) return null;

          final props = f['properties'] as Map<String, dynamic>?;

          return _MapOccurrence(
            id: props?['id']?.toString() ?? '',
            protocol: props?['protocol']?.toString() ?? '',
            priority: props?['priority']?.toString() ?? 'medium',
            status: props?['status']?.toString() ?? 'open',
            categoryName: props?['categoryName']?.toString() ?? '',
            address: props?['address']?.toString(),
            thumbnail: props?['thumbnail']?.toString(),
            position: LatLng(lat, lng),
          );
        } catch (_) {
          return null;
        }
      }).whereType<_MapOccurrence>().toList();

      if (!mounted) return;

      setState(() {
        _occurrences = parsed;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOnline = ref.watch(isOnlineProvider);

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapCtrl,
            options: MapOptions(
              initialCenter: _defaultCenter,
              initialZoom: 13,
              minZoom: 8,
              maxZoom: 18,
              onTap: (_, __) => setState(() => _selected = null),
            ),
            children: [
              TileLayer(
                urlTemplate:
                'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                subdomains: const ['a', 'b', 'c', 'd'],
              ),

              MarkerLayer(
                markers: _occurrences.map((occ) {
                  final color = AppColors.priorityColor(occ.priority);
                  final isSelected = _selected?.id == occ.id;

                  return Marker(
                    point: occ.position,
                    width: isSelected ? 28 : 20,
                    height: isSelected ? 28 : 20,
                    child: GestureDetector(
                      onTap: () => setState(() => _selected = occ),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withOpacity(0.6),
                            width: isSelected ? 3 : 1.5,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),

          /// HEADER
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.surface.withOpacity(0.92),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      '${_occurrences.length} abertas',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),

                  const Spacer(),

                  if (!isOnline)
                    const Icon(Icons.wifi_off, color: AppColors.critical),

                  const SizedBox(width: 8),

                  IconButton(
                    onPressed: _loadData,
                    icon: _loading
                        ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                        : const Icon(Icons.refresh),
                  ),
                ],
              ),
            ),
          ),

          /// POPUP
          if (_selected != null)
            Positioned(
              left: 16,
              right: 16,
              bottom: 100,
              child: GestureDetector(
                onTap: () =>
                    context.push('/citizen/occurrences/${_selected!.id}'),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.priorityColor(_selected!.priority),
                    ),
                  ),
                  child: Text(_selected!.protocol),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MapOccurrence {
  final String id;
  final String protocol;
  final String priority;
  final String status;
  final String categoryName;
  final String? address;
  final String? thumbnail;
  final LatLng position;

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