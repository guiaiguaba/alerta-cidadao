// lib/models/occurrence.dart
import 'package:hive/hive.dart';

part 'occurrence.g.dart';

@HiveType(typeId: 1)
class Occurrence extends HiveObject {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String protocol;

  @HiveField(2)
  final String categoryId;

  @HiveField(3)
  final String categoryName;

  @HiveField(4)
  final String? categoryIcon;

  @HiveField(5)
  final String? categoryColor;

  @HiveField(6)
  final String? description;

  @HiveField(7)
  final double lat;

  @HiveField(8)
  final double lng;

  @HiveField(9)
  final String? address;

  @HiveField(10)
  final String? regionCode;

  @HiveField(11)
  final String priority;

  @HiveField(12)
  String status;

  @HiveField(13)
  final String reporterId;

  @HiveField(14)
  final String reporterName;

  @HiveField(15)
  final String? agentName;

  @HiveField(16)
  final String? slaDeadline;

  @HiveField(17)
  final bool slaBreached;

  @HiveField(18)
  final String createdAt;

  @HiveField(19)
  final List<OccurrenceMedia>? media;

  @HiveField(20)
  final String? clientId;

  @HiveField(21)
  bool pendingSync;

  Occurrence({
    required this.id,
    required this.protocol,
    required this.categoryId,
    required this.categoryName,
    this.categoryIcon,
    this.categoryColor,
    this.description,
    required this.lat,
    required this.lng,
    this.address,
    this.regionCode,
    required this.priority,
    required this.status,
    required this.reporterId,
    required this.reporterName,
    this.agentName,
    this.slaDeadline,
    this.slaBreached = false,
    required this.createdAt,
    this.media,
    this.clientId,
    this.pendingSync = false,
  });

  factory Occurrence.fromJson(Map<String, dynamic> json) => Occurrence(
    id: json['id']?.toString() ??
        json['client_id']?.toString() ??
        '',

    protocol: json['protocol']?.toString() ?? 'PENDING',

    categoryId: json['category_id']?.toString() ?? '',
    categoryName: json['category_name']?.toString() ?? '',
    categoryIcon: json['category_icon']?.toString(),
    categoryColor: json['category_color']?.toString(),

    description: json['description']?.toString(),

    lat: _toDouble(json['lat']),
    lng: _toDouble(json['lng']),

    address: json['address']?.toString(),
    regionCode: json['region_code']?.toString(),

    priority: json['priority']?.toString() ?? 'medium',
    status: json['status']?.toString() ?? 'open',

    reporterId: json['reporter_id']?.toString() ?? '',
    reporterName: json['reporter_name']?.toString() ?? '',

    agentName: json['agent_name']?.toString(),

    slaDeadline: json['sla_deadline']?.toString(),

    slaBreached: _toBool(json['sla_breached']),

    createdAt: json['created_at']?.toString() ??
        DateTime.now().toIso8601String(),

    media: (json['media'] is List)
        ? (json['media'] as List)
        .map((m) => OccurrenceMedia.fromJson(m as Map<String, dynamic>))
        .toList()
        : null,

    clientId: json['client_id']?.toString(),

    pendingSync: false,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'protocol': protocol,
    'category_id': categoryId,
    'lat': lat,
    'lng': lng,
    'description': description,
    'address': address,
    'region_code': regionCode,
    'priority': priority,
    'status': status,
    'reporter_id': reporterId,
    'created_at': createdAt,
    'client_id': clientId,
  };

  factory Occurrence.offline({
    required String clientId,
    required String categoryId,
    required String categoryName,
    required double lat,
    required double lng,
    String? description,
    String? address,
    String? regionCode,
  }) =>
      Occurrence(
        id: clientId,
        protocol: 'PENDING',
        categoryId: categoryId,
        categoryName: categoryName,
        lat: lat,
        lng: lng,
        description: description,
        address: address,
        regionCode: regionCode,
        priority: 'medium',
        status: 'open',
        reporterId: '',
        reporterName: '',
        createdAt: DateTime.now().toIso8601String(),
        clientId: clientId,
        pendingSync: true,
      );
}

@HiveType(typeId: 2)
class OccurrenceMedia extends HiveObject {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String url;

  @HiveField(2)
  final String? thumbnailUrl;

  @HiveField(3)
  final String mediaType;

  @HiveField(4)
  final String phase;

  OccurrenceMedia({
    required this.id,
    required this.url,
    this.thumbnailUrl,
    required this.mediaType,
    required this.phase,
  });

  factory OccurrenceMedia.fromJson(Map<String, dynamic> json) =>
      OccurrenceMedia(
        id: json['id']?.toString() ?? '',
        url: json['url']?.toString() ?? '',
        thumbnailUrl: json['thumbnail_url']?.toString(),
        mediaType: _parseMediaType(json['media_type']),
        phase: _parsePhase(json['phase']),
      );
}

//
// 🔧 HELPERS (escopo do arquivo)
//

double _toDouble(dynamic v) {
  if (v == null) return 0.0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0.0;
}

bool _toBool(dynamic v) {
  return v == true || v == 1 || v == 'true';
}

String _parseMediaType(dynamic v) {
  const allowed = ['photo', 'video'];
  final value = v?.toString();
  return allowed.contains(value) ? value! : 'photo';
}

String _parsePhase(dynamic v) {
  const allowed = ['report', 'resolution'];
  final value = v?.toString();
  return allowed.contains(value) ? value! : 'report';
}