// lib/core/offline/connectivity_service.dart
import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Monitora o estado da conexão de rede e emite eventos de mudança.
/// Usado pelo OfflineQueueService para disparar sync automático.
class ConnectivityService {
  final _connectivity = Connectivity();
  final _controller   = StreamController<bool>.broadcast();

  bool _isOnline = true;

  Stream<bool> get onConnectivityChanged => _controller.stream;
  bool get isOnline => _isOnline;

  Future<void> init() async {
    // Estado inicial
    final result = await _connectivity.checkConnectivity();
    _isOnline = _isConnected(result.first);

    // Escutar mudanças
    _connectivity.onConnectivityChanged.listen((results) {
      final online = results.any(_isConnected);
      if (online != _isOnline) {
        _isOnline = online;
        _controller.add(online);
        debugPrint('[Connectivity] ${online ? "Online ✅" : "Offline ❌"}');
      }
    });
  }

  Future<bool> checkConnectivity() async {
    final result = await _connectivity.checkConnectivity();
    _isOnline = result.any(_isConnected);
    return _isOnline;
  }

  bool _isConnected(ConnectivityResult r) =>
    r == ConnectivityResult.mobile   ||
    r == ConnectivityResult.wifi     ||
    r == ConnectivityResult.ethernet ||
    r == ConnectivityResult.vpn;

  void dispose() => _controller.close();
}
