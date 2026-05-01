// lib/core/location/location_service.dart
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:flutter/foundation.dart';

class LocationResult {
  final double  lat;
  final double  lng;
  final String? address;
  final double? accuracy;
  const LocationResult({required this.lat, required this.lng, this.address, this.accuracy});
}

class LocationService {
  Future<LocationResult?> getCurrentLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) throw LocationException('Serviço de localização desabilitado.');

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) throw LocationException('Permissão negada.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw LocationException('Permissão negada permanentemente. Ajuste nas configurações.');
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)),
    );

    String? address;
    try {
      final pm = await placemarkFromCoordinates(position.latitude, position.longitude);
      if (pm.isNotEmpty) {
        final p = pm.first;
        address = [p.street, p.subLocality, p.locality]
            .whereType<String>().where((s) => s.isNotEmpty).join(', ');
      }
    } catch (_) {}

    return LocationResult(lat: position.latitude, lng: position.longitude, address: address, accuracy: position.accuracy);
  }

  Stream<Position> getPositionStream() => Geolocator.getPositionStream(
    locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
  );
}

class LocationException implements Exception {
  final String message;
  const LocationException(this.message);
  @override String toString() => 'LocationException: $message';
}
