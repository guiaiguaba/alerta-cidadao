// lib/core/location/geo_blocker.dart
// Verifica se o cidadão está dentro da área de cobertura do município
// Chamado antes de: login, cadastro, criar ocorrência

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../api/api_client.dart';
import '../constants/app_colors.dart';

class GeoBlocker {
  GeoBlocker._();

  /// Verifica a distância e exibe bloqueio se necessário.
  /// Retorna `true` se o usuário pode prosseguir, `false` se bloqueado.
  static Future<bool> verificar(
    BuildContext context,
    ApiClient api,
  ) async {
    // 1. Obter GPS do dispositivo
    final posicao = await _obterPosicao(context);
    if (posicao == null) return false; // sem GPS = bloqueado

    // 2. Buscar config de área do servidor
    late Map<String, dynamic> geoConfig;
    try {
      geoConfig = await api.getGeoConfig();
    } catch (_) {
      // Se não conseguir verificar (offline, etc.), bloqueia por segurança
      await _mostrarBloqueio(
        context,
        distanciaKm: null,
        raioKm: null,
        nomeMunicipio: '',
        semInternet: true,
      );
      return false;
    }

    final centerLat  = (geoConfig['center_lat']   as num?)?.toDouble();
    final centerLng  = (geoConfig['center_lng']   as num?)?.toDouble();
    final raioKm     = (geoConfig['geo_radius_km'] as num?)?.toDouble() ?? 30.0;
    final nomeMun    = geoConfig['display_name']  as String? ?? 'município';

    // Sem coordenadas configuradas = sem restrição
    if (centerLat == null || centerLng == null) return true;

    // 3. Calcular distância
    final distanciaM = Geolocator.distanceBetween(
      posicao.latitude, posicao.longitude,
      centerLat, centerLng,
    );
    final distanciaKm = distanciaM / 1000;

    // 4. Dentro do raio → permitir
    if (distanciaKm <= raioKm) return true;

    // 5. Fora do raio → mostrar bloqueio
    if (context.mounted) {
      await _mostrarBloqueio(
        context,
        distanciaKm: distanciaKm,
        raioKm:      raioKm,
        nomeMunicipio: nomeMun,
        semInternet:   false,
      );
    }
    return false;
  }

  // ---- Obter posição GPS ----
  static Future<Position?> _obterPosicao(BuildContext context) async {
    try {
      final service = await Geolocator.isLocationServiceEnabled();
      if (!service) {
        if (context.mounted) _mostrarErroGps(context, 'GPS desativado. Ative a localização para usar o app.');
        return null;
      }

      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        if (context.mounted) _mostrarErroGps(context, 'Permissão de localização necessária para verificar sua região.');
        return null;
      }

      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy:  LocationAccuracy.reduced, // baixo consumo — só precisamos da região
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  // ---- Dialog de bloqueio ----
  static Future<void> _mostrarBloqueio(
    BuildContext context, {
    required double? distanciaKm,
    required double? raioKm,
    required String  nomeMunicipio,
    required bool    semInternet,
  }) async {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => WillPopScope(
        onWillPop: () async => false, // não pode fechar com back
        child: Dialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: AppColors.criticalBorder),
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 64, height: 64,
                  decoration: BoxDecoration(
                    color:        AppColors.criticalBg,
                    shape:        BoxShape.circle,
                    border:       const Border.fromBorderSide(
                      BorderSide(color: AppColors.criticalBorder)),
                  ),
                  child: const Icon(
                    Icons.location_off_rounded,
                    color: AppColors.critical,
                    size: 32,
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  semInternet
                    ? 'Sem conexão com o servidor'
                    : 'App indisponível na sua região',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize:   17,
                    fontWeight: FontWeight.w700,
                    color:      AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  semInternet
                    ? 'Não foi possível verificar sua localização. '
                      'Conecte-se à internet para usar o app.'
                    : nomeMunicipio.isNotEmpty
                      ? 'Este app é exclusivo para moradores de $nomeMunicipio.\n\n'
                        'Você está a ${distanciaKm!.round()} km do município '
                        '(área de cobertura: ${raioKm!.round()} km).'
                      : 'Você está fora da área de cobertura deste município.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize:   13,
                    color:      AppColors.textSecondary,
                    height:     1.5,
                  ),
                ),
                const SizedBox(height: 24),
                // Mapa visual simples mostrando a distância
                if (distanciaKm != null && raioKm != null) ...[
                  _DistanceVisual(distanciaKm: distanciaKm, raioKm: raioKm),
                  const SizedBox(height: 20),
                ],
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.surface,
                      foregroundColor: AppColors.textSecondary,
                      side:            const BorderSide(color: AppColors.border),
                    ),
                    child: const Text('Fechar'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static void _mostrarErroGps(BuildContext context, String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content:         Text(msg),
      backgroundColor: AppColors.high,
      duration:        const Duration(seconds: 4),
    ));
  }
}

// ---- Widget visual de distância ----
class _DistanceVisual extends StatelessWidget {
  final double distanciaKm;
  final double raioKm;

  const _DistanceVisual({required this.distanciaKm, required this.raioKm});

  @override
  Widget build(BuildContext context) {
    final pct = (raioKm / distanciaKm).clamp(0.05, 0.95);

    return Container(
      height: 56,
      decoration: BoxDecoration(
        color:        AppColors.panel,
        borderRadius: BorderRadius.circular(10),
        border:       const Border.fromBorderSide(BorderSide(color: AppColors.border)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Barra de progresso
          Stack(
            children: [
              Container(height: 8, decoration: BoxDecoration(
                color: AppColors.muted, borderRadius: BorderRadius.circular(4))),
              FractionallySizedBox(
                widthFactor: pct,
                child: Container(height: 8, decoration: BoxDecoration(
                  color: AppColors.amber, borderRadius: BorderRadius.circular(4))),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Área: ${raioKm.round()} km', style: const TextStyle(
                fontSize: 9, fontFamily: 'IBMPlexMono', color: AppColors.amber)),
              Text('Você: ${distanciaKm.round()} km', style: const TextStyle(
                fontSize: 9, fontFamily: 'IBMPlexMono', color: AppColors.critical)),
            ],
          ),
        ],
      ),
    );
  }
}
