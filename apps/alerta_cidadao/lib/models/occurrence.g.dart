// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'occurrence.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class OccurrenceAdapter extends TypeAdapter<Occurrence> {
  @override
  final int typeId = 1;

  @override
  Occurrence read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return Occurrence(
      id: fields[0] as String,
      protocol: fields[1] as String,
      categoryId: fields[2] as String,
      categoryName: fields[3] as String,
      categoryIcon: fields[4] as String?,
      categoryColor: fields[5] as String?,
      description: fields[6] as String?,
      lat: fields[7] as double,
      lng: fields[8] as double,
      address: fields[9] as String?,
      regionCode: fields[10] as String?,
      priority: fields[11] as String,
      status: fields[12] as String,
      reporterId: fields[13] as String,
      reporterName: fields[14] as String,
      agentName: fields[15] as String?,
      slaDeadline: fields[16] as String?,
      slaBreached: fields[17] as bool,
      createdAt: fields[18] as String,
      media: (fields[19] as List?)?.cast<OccurrenceMedia>(),
      clientId: fields[20] as String?,
      pendingSync: fields[21] as bool,
    );
  }

  @override
  void write(BinaryWriter writer, Occurrence obj) {
    writer
      ..writeByte(22)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.protocol)
      ..writeByte(2)
      ..write(obj.categoryId)
      ..writeByte(3)
      ..write(obj.categoryName)
      ..writeByte(4)
      ..write(obj.categoryIcon)
      ..writeByte(5)
      ..write(obj.categoryColor)
      ..writeByte(6)
      ..write(obj.description)
      ..writeByte(7)
      ..write(obj.lat)
      ..writeByte(8)
      ..write(obj.lng)
      ..writeByte(9)
      ..write(obj.address)
      ..writeByte(10)
      ..write(obj.regionCode)
      ..writeByte(11)
      ..write(obj.priority)
      ..writeByte(12)
      ..write(obj.status)
      ..writeByte(13)
      ..write(obj.reporterId)
      ..writeByte(14)
      ..write(obj.reporterName)
      ..writeByte(15)
      ..write(obj.agentName)
      ..writeByte(16)
      ..write(obj.slaDeadline)
      ..writeByte(17)
      ..write(obj.slaBreached)
      ..writeByte(18)
      ..write(obj.createdAt)
      ..writeByte(19)
      ..write(obj.media)
      ..writeByte(20)
      ..write(obj.clientId)
      ..writeByte(21)
      ..write(obj.pendingSync);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OccurrenceAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

class OccurrenceMediaAdapter extends TypeAdapter<OccurrenceMedia> {
  @override
  final int typeId = 2;

  @override
  OccurrenceMedia read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return OccurrenceMedia(
      id: fields[0] as String,
      url: fields[1] as String,
      thumbnailUrl: fields[2] as String?,
      mediaType: fields[3] as String,
      phase: fields[4] as String,
    );
  }

  @override
  void write(BinaryWriter writer, OccurrenceMedia obj) {
    writer
      ..writeByte(5)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.url)
      ..writeByte(2)
      ..write(obj.thumbnailUrl)
      ..writeByte(3)
      ..write(obj.mediaType)
      ..writeByte(4)
      ..write(obj.phase);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OccurrenceMediaAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
