// GENERATED CODE - DO NOT MODIFY BY HAND
// Gerado manualmente para evitar dependência de build_runner no deploy.
// Em desenvolvimento, execute: flutter pub run build_runner build

part of 'ocorrencia_local.dart';

class OcorrenciaLocalAdapter extends TypeAdapter<OcorrenciaLocal> {
  @override
  final int typeId = 0;

  @override
  OcorrenciaLocal read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (var i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return OcorrenciaLocal(
      clientId: fields[0] as String,
      descricao: fields[1] as String,
      latitude: fields[2] as double,
      longitude: fields[3] as double,
      categoriaId: fields[4] as String?,
      endereco: fields[5] as String?,
      imagemPaths: (fields[6] as List).cast<String>(),
      sincronizado: fields[7] as bool,
      criadoEm: fields[8] as DateTime,
      serverId: fields[9] as String?,
    );
  }

  @override
  void write(BinaryWriter writer, OcorrenciaLocal obj) {
    writer
      ..writeByte(10)
      ..writeByte(0)
      ..write(obj.clientId)
      ..writeByte(1)
      ..write(obj.descricao)
      ..writeByte(2)
      ..write(obj.latitude)
      ..writeByte(3)
      ..write(obj.longitude)
      ..writeByte(4)
      ..write(obj.categoriaId)
      ..writeByte(5)
      ..write(obj.endereco)
      ..writeByte(6)
      ..write(obj.imagemPaths)
      ..writeByte(7)
      ..write(obj.sincronizado)
      ..writeByte(8)
      ..write(obj.criadoEm)
      ..writeByte(9)
      ..write(obj.serverId);
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OcorrenciaLocalAdapter && runtimeType == other.runtimeType && typeId == other.typeId;

  @override
  int get hashCode => typeId.hashCode;
}
