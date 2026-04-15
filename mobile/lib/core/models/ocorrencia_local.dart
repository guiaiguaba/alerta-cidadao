import 'package:hive/hive.dart';

part 'ocorrencia_local.g.dart';

@HiveType(typeId: 0)
class OcorrenciaLocal extends HiveObject {
  @HiveField(0)
  final String clientId;

  @HiveField(1)
  final String descricao;

  @HiveField(2)
  final double latitude;

  @HiveField(3)
  final double longitude;

  @HiveField(4)
  final String? categoriaId;

  @HiveField(5)
  final String? endereco;

  @HiveField(6)
  final List<String> imagemPaths;

  @HiveField(7)
  bool sincronizado;

  @HiveField(8)
  final DateTime criadoEm;

  @HiveField(9)
  String? serverId; // preenchido após sync bem-sucedido

  OcorrenciaLocal({
    required this.clientId,
    required this.descricao,
    required this.latitude,
    required this.longitude,
    this.categoriaId,
    this.endereco,
    required this.imagemPaths,
    this.sincronizado = false,
    required this.criadoEm,
    this.serverId,
  });
}
