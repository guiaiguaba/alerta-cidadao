
import 'package:hive/hive.dart';

part 'sync_item.g.dart';


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