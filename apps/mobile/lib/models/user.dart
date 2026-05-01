
import 'package:hive/hive.dart';

part 'user.g.dart';

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
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',

    email: json['email']?.toString(),
    phone: json['phone']?.toString(),
    avatarUrl: json['avatar_url']?.toString(),

    role: _parseUserRole(json['role']),

    tenantId: json['tenantId']?.toString() ??
        json['tenant_id']?.toString() ?? '',

    tenantSlug: json['tenantSlug']?.toString() ??
        json['tenant_slug']?.toString() ?? '',
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
String _parseUserRole(dynamic v) {
  const allowed = ['citizen', 'agent', 'admin'];
  final value = v?.toString();
  return allowed.contains(value) ? value! : 'citizen';
}