// lib/core/notifications/fcm_service.dart
import 'dart:convert';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Handler de background (top-level, fora da classe)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM BG] Mensagem recebida: ${message.messageId}');
}

class FcmService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final _localNotifications = FlutterLocalNotificationsPlugin();

  static const _channelId = 'alerta_cidadao_critical';
  static const _channelName = 'Alertas Alerta Cidadão';

  /// Callback para navegação ao tocar na notificação
  void Function(Map<String, dynamic>)? onNotificationTap;

  Future<void> init() async {
    // Configurar handler de background
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Solicitar permissão
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    debugPrint('[FCM] Permissão: ${settings.authorizationStatus}');

    // Configurar canal Android
    const androidChannel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: 'Alertas de emergência e atualizações de ocorrências',
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
      enableLights: true,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);

    // Init plugin local
    const initSettings = InitializationSettings(
      android: AndroidInitializationSettings('@drawable/ic_notification'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      ),
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (details) {
        final payload = details.payload;

        if (payload == null) return;

        try {
          final decoded = jsonDecode(payload);

          final data = decoded is Map<String, dynamic>
              ? decoded
              : Map<String, dynamic>.from(decoded as Map);
          onNotificationTap?.call(data);
        } catch (e) {
          debugPrint('[FCM] Erro ao decodificar payload: $e');
        }
      },
    );

    // Escutar mensagens em foreground
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Tap em notificação (app em background → foreground)
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      onNotificationTap?.call(message.data);
    });

    // App aberta por notificação (app estava fechado)
    final initial = await _messaging.getInitialMessage();
    if (initial != null) {
      Future.delayed(const Duration(milliseconds: 500), () {
        onNotificationTap?.call(initial.data);
      });
    }
  }

  Future<String?> getToken() async {
    try {
      return await _messaging.getToken();
    } catch (e) {
      debugPrint('[FCM] Erro ao obter token: $e');
      return null;
    }
  }

  Stream<String> get onTokenRefresh => _messaging.onTokenRefresh;

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    debugPrint(
      '[FCM FG] ${message.notification?.title}: ${message.notification?.body}',
    );

    final notification = message.notification;
    if (notification == null) return;

    final data = message.data;
    final type = (data['type'] ?? '').toString();
    final severity = (data['severity'] ?? 'info').toString();

    final color = _severityColor(severity);

    await _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          importance: Importance.max,
          priority: Priority.high,
          color: color,
          colorized: true,
          icon: _iconForType(type),
          playSound: true,
          enableVibration: true,
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: jsonEncode(data),
    );
  }

  Color _severityColor(String severity) {
    switch (severity) {
      case 'critical':
        return const Color(0xFFEF4444);
      case 'high':
        return const Color(0xFFF97316);
      case 'medium':
        return const Color(0xFFEAB308);
      default:
        return const Color(0xFF3B82F6);
    }
  }

  String _iconForType(String type) {
    switch (type) {
      case 'alert':
        return '@drawable/ic_alert';
      case 'occurrence_update':
        return '@drawable/ic_occurrence';
      case 'sla_breach':
        return '@drawable/ic_warning';
      default:
        return '@drawable/ic_notification';
    }
  }

  Future<void> subscribeToTopic(String topic) =>
      _messaging.subscribeToTopic(topic);

  Future<void> unsubscribeFromTopic(String topic) =>
      _messaging.unsubscribeFromTopic(topic);
}