// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'alert.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class AppAlertAdapter extends TypeAdapter<AppAlert> {
  @override
  final int typeId = 3;

  @override
  AppAlert read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return AppAlert(
      id: fields[0] as String,
      title: fields[1] as String,
      message: fields[2] as String,
      alertType: fields[3] as String,
      severity: fields[4] as String,
      targetScope: fields[5] as String,
      status: fields[6] as String,
      recipientsCount: fields[7] as int,
      sentAt: fields[8] as String?,
      expiresAt: fields[9] as String?,
      createdAt: fields[10] as String,
    );
  }

  @override
  void write(BinaryWriter writer, AppAlert obj) {
    writer
      ..writeByte(11)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.title)
      ..writeByte(2)
      ..write(obj.message)
      ..writeByte(3)
      ..write(obj.alertType)
      ..writeByte(4)
      ..write(obj.severity)
      ..writeByte(5)
      ..write(obj.targetScope)
      ..writeByte(6)
      ..write(obj.status)
      ..writeByte(7)
      ..write(obj.recipientsCount)
      ..writeByte(8)
      ..write(obj.sentAt)
      ..writeByte(9)
      ..write(obj.expiresAt)
      ..writeByte(10)
      ..write(obj.createdAt);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AppAlertAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
