import 'package:geolocator/geolocator.dart';

class GpsService {
  /// Retorna posição atual com tratamento completo de permissões.
  /// Lança [GpsException] com mensagem amigável em caso de erro.
  static Future<Position> getCurrentPosition() async {
    // 1. Checar se o serviço está habilitado no dispositivo
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw GpsException(
        'O GPS está desligado no seu dispositivo.\nAcesse Configurações → Localização e ative.',
      );
    }

    // 2. Checar/solicitar permissão
    var permission = await Geolocator.checkPermission();

    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw GpsException('Permissão de localização negada.\nPermita o acesso na próxima solicitação.');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw GpsException(
        'Permissão de GPS bloqueada permanentemente.\n'
        'Acesse Configurações → Aplicativos → Alerta Cidadão → Permissões → Localização.',
      );
    }

    // 3. Tentar obter posição com timeout generoso
    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 20),
      );
    } on TimeoutException {
      // Tenta com precisão menor se timeout
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
        timeLimit: const Duration(seconds: 10),
      );
    } catch (e) {
      throw GpsException('Não foi possível obter localização: $e');
    }
  }

  /// Posição de fallback para testes sem GPS real (centro do Brasil)
  static Position fallback() => Position(
    latitude: -15.7801,
    longitude: -47.9292,
    timestamp: DateTime.now(),
    accuracy: 999,
    altitude: 0,
    altitudeAccuracy: 0,
    heading: 0,
    headingAccuracy: 0,
    speed: 0,
    speedAccuracy: 0,
  );
}

class GpsException implements Exception {
  final String message;
  GpsException(this.message);
  @override String toString() => message;
}

class TimeoutException implements Exception {}
