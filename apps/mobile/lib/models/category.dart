
import 'package:hive/hive.dart';
part 'category.g.dart';

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
    id: int.tryParse(json['id'].toString()) ?? 0,

    code: json['code']?.toString() ?? '',
    name: json['name']?.toString() ?? '',

    icon: json['icon']?.toString(),
    color: json['color']?.toString(),

    defaultPriority: json['default_priority']?.toString() ?? 'medium',

    requiresPhoto: json['requires_photo'] == true ||
        json['requires_photo'] == 1 ||
        json['requires_photo'] == 'true',
  );
}