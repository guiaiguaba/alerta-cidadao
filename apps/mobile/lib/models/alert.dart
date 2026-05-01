
import 'package:hive/hive.dart';
part 'alert.g.dart';

@HiveType(typeId: 3)
class AppAlert {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String title;

  @HiveField(2)
  final String message;

  @HiveField(3)
  final String alertType;

  @HiveField(4)
  final String severity;

  @HiveField(5)
  final String targetScope;

  @HiveField(6)
  final String status;

  @HiveField(7)
  final int recipientsCount;

  @HiveField(8)
  final String? sentAt;

  @HiveField(9)
  final String? expiresAt;

  @HiveField(10)
  final String createdAt;

  AppAlert({
    required this.id,
    required this.title,
    required this.message,
    required this.alertType,
    required this.severity,
    required this.targetScope,
    required this.status,
    required this.recipientsCount,
    this.sentAt,
    this.expiresAt,
    required this.createdAt,
  });

  factory AppAlert.fromJson(Map<String, dynamic> json) => AppAlert(
    id: json['id']?.toString() ?? '',

    title: json['title']?.toString() ?? '',
    message: json['message']?.toString() ?? '',

    alertType: _parseAlertType(json['alert_type']),
    severity: _parseSeverity(json['severity']),
    targetScope: _parseTargetScope(json['target_scope']),
    status: _parseStatus(json['status']),

    recipientsCount: _toInt(json['recipients_count']),

    sentAt: json['sent_at']?.toString(),
    expiresAt: json['expires_at']?.toString(),

    createdAt: json['created_at']?.toString() ?? '',
  );

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.parse(expiresAt!).isBefore(DateTime.now());
  }
}
int _toInt(dynamic v) {
  if (v == null) return 0;
  if (v is int) return v;
  return int.tryParse(v.toString()) ?? 0;
}
String _parseAlertType(dynamic v) {
  const allowed = ['info', 'warning', 'danger', 'other'];
  final value = v?.toString();
  return allowed.contains(value) ? value! : 'other';
}

String _parseSeverity(dynamic v) {
  const allowed = ['low', 'medium', 'high', 'critical'];
  final value = v?.toString();
  return allowed.contains(value) ? value! : 'medium';
}

String _parseTargetScope(dynamic v) {
  const allowed = ['all', 'region', 'user'];
  final value = v?.toString();
  return allowed.contains(value) ? value! : 'all';
}

String _parseStatus(dynamic v) {
  const allowed = ['draft', 'scheduled', 'sent', 'cancelled'];
  final value = v?.toString();
  return allowed.contains(value) ? value! : 'sent';
}