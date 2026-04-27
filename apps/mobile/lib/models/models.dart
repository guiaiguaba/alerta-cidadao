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
  final String priority;  // critical|high|medium|low

  @HiveField(12)
  String status;  // mutable para updates offline

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

  // Offline sync fields
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
    id:            json['id'] ?? json['client_id'] ?? '',
    protocol:      json['protocol'] ?? 'PENDING',
    categoryId:    json['category_id']?.toString() ?? '',
    categoryName:  json['category_name'] ?? '',
    categoryIcon:  json['category_icon'],
    categoryColor: json['category_color'],
    description:   json['description'],
    lat:           (json['lat'] as num).toDouble(),
    lng:           (json['lng'] as num).toDouble(),
    address:       json['address'],
    regionCode:    json['region_code'],
    priority:      json['priority'] ?? 'medium',
    status:        json['status'] ?? 'open',
    reporterId:    json['reporter_id'] ?? '',
    reporterName:  json['reporter_name'] ?? '',
    agentName:     json['agent_name'],
    slaDeadline:   json['sla_deadline'],
    slaBreached:   json['sla_breached'] ?? false,
    createdAt:     json['created_at'] ?? DateTime.now().toIso8601String(),
    media:         (json['media'] as List?)
        ?.map((m) => OccurrenceMedia.fromJson(m))
        .toList(),
    clientId:      json['client_id'],
    pendingSync:   false,
  );

  Map<String, dynamic> toJson() => {
    'id':          id,
    'protocol':    protocol,
    'category_id': categoryId,
    'lat':         lat,
    'lng':         lng,
    'description': description,
    'address':     address,
    'region_code': regionCode,
    'priority':    priority,
    'status':      status,
    'reporter_id': reporterId,
    'created_at':  createdAt,
    'client_id':   clientId,
  };

  /// Cria ocorrência offline (antes de sincronizar)
  factory Occurrence.offline({
    required String clientId,
    required String categoryId,
    required String categoryName,
    required double lat,
    required double lng,
    String? description,
    String? address,
    String? regionCode,
  }) => Occurrence(
    id:           clientId,
    protocol:     'PENDING',
    categoryId:   categoryId,
    categoryName: categoryName,
    lat:          lat,
    lng:          lng,
    description:  description,
    address:      address,
    regionCode:   regionCode,
    priority:     'medium',
    status:       'open',
    reporterId:   '',
    reporterName: '',
    createdAt:    DateTime.now().toIso8601String(),
    clientId:     clientId,
    pendingSync:  true,
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

  factory OccurrenceMedia.fromJson(Map<String, dynamic> json) => OccurrenceMedia(
    id:           json['id'] ?? '',
    url:          json['url'] ?? '',
    thumbnailUrl: json['thumbnail_url'],
    mediaType:    json['media_type'] ?? 'photo',
    phase:        json['phase'] ?? 'report',
  );
}

// ============================================================

// lib/models/user.dart
@HiveType(typeId: 3)
class AppUser extends HiveObject {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String name;

  @HiveField(2)
  final String? email;

  @HiveField(3)
  final String? phone;

  @HiveField(4)
  final String? avatarUrl;

  @HiveField(5)
  final String role; // citizen|agent|supervisor|admin

  @HiveField(6)
  final String tenantId;

  @HiveField(7)
  final String tenantSlug;

  AppUser({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.avatarUrl,
    required this.role,
    required this.tenantId,
    required this.tenantSlug,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id:         json['id'] ?? '',
    name:       json['name'] ?? '',
    email:      json['email'],
    phone:      json['phone'],
    avatarUrl:  json['avatar_url'],
    role:       json['role'] ?? 'citizen',
    tenantId:   json['tenantId'] ?? '',
    tenantSlug: json['tenantSlug'] ?? '',
  );

  bool get isCitizen    => role == 'citizen';
  bool get isAgent      => role == 'agent' || isSupervisor;
  bool get isSupervisor => role == 'supervisor' || isAdmin;
  bool get isAdmin      => role == 'admin' || role == 'super_admin';

  String get initials {
    final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    if (parts.isNotEmpty) return parts.first.substring(0, 2).toUpperCase();
    return 'U';
  }
}

// ============================================================

// lib/models/category.dart
@HiveType(typeId: 4)
class Category extends HiveObject {
  @HiveField(0)
  final int id;

  @HiveField(1)
  final String code;

  @HiveField(2)
  final String name;

  @HiveField(3)
  final String? icon;

  @HiveField(4)
  final String? color;

  @HiveField(5)
  final String defaultPriority;

  @HiveField(6)
  final bool requiresPhoto;

  Category({
    required this.id,
    required this.code,
    required this.name,
    this.icon,
    this.color,
    required this.defaultPriority,
    this.requiresPhoto = false,
  });

  factory Category.fromJson(Map<String, dynamic> json) => Category(
    id:              json['id'] as int,
    code:            json['code'] ?? '',
    name:            json['name'] ?? '',
    icon:            json['icon'],
    color:           json['color'],
    defaultPriority: json['default_priority'] ?? 'medium',
    requiresPhoto:   json['requires_photo'] ?? false,
  );
}

// ============================================================

// lib/models/alert.dart
class AppAlert {
  final String id;
  final String title;
  final String message;
  final String alertType;
  final String severity;
  final String targetScope;
  final String status;
  final int recipientsCount;
  final String? sentAt;
  final String? expiresAt;
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
    id:              json['id'] ?? '',
    title:           json['title'] ?? '',
    message:         json['message'] ?? '',
    alertType:       json['alert_type'] ?? 'other',
    severity:        json['severity'] ?? 'medium',
    targetScope:     json['target_scope'] ?? 'all',
    status:          json['status'] ?? 'sent',
    recipientsCount: json['recipients_count'] ?? 0,
    sentAt:          json['sent_at'],
    expiresAt:       json['expires_at'],
    createdAt:       json['created_at'] ?? '',
  );

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.parse(expiresAt!).isBefore(DateTime.now());
  }
}

// ============================================================

// lib/models/sync_item.dart
@HiveType(typeId: 5)
class SyncQueueItem extends HiveObject {
  @HiveField(0)
  final String id;  // UUID

  @HiveField(1)
  final String type;  // create_occurrence | update_status | upload_media

  @HiveField(2)
  final Map<String, dynamic> payload;

  @HiveField(3)
  final String createdAt;

  @HiveField(4)
  int retryCount;

  @HiveField(5)
  String? lastError;

  SyncQueueItem({
    required this.id,
    required this.type,
    required this.payload,
    required this.createdAt,
    this.retryCount = 0,
    this.lastError,
  });
}
