// lib/providers/tenant_config_provider.dart
// Busca o nome e logo da prefeitura na API e cacheia no app

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api/api_client.dart';
import '../core/constants/app_config.dart';
import 'providers.dart';

class TenantConfig {
  final String nome;
  final String? logoUrl;
  final String? primaryColor;

  const TenantConfig({
    required this.nome,
    this.logoUrl,
    this.primaryColor,
  });

  factory TenantConfig.fallback() => TenantConfig(
    nome: AppConfig.nomeMunicipio,
  );

  factory TenantConfig.fromJson(Map<String, dynamic> json) => TenantConfig(
    nome:         json['display_name'] as String? ?? AppConfig.nomeMunicipio,
    logoUrl:      json['logo_url']     as String?,
    primaryColor: json['primary_color'] as String?,
  );
}

// Provider cacheado — busca uma vez e reutiliza em todo o app
final tenantConfigProvider = FutureProvider<TenantConfig>((ref) async {
  try {
    final api = ref.watch(apiClientProvider);
    final data = await api.getGeoConfig(); // reutiliza o endpoint que já existe
    return TenantConfig.fromJson(data);
  } catch (_) {
    return TenantConfig.fallback();
  }
});

// Provider síncrono com fallback — para uso em widgets sem AsyncValue
final tenantNomeProvider = Provider<String>((ref) {
  final config = ref.watch(tenantConfigProvider);
  return config.when(
    data:    (c) => c.nome,
    loading: () => AppConfig.nomeMunicipio,
    error:   (_, __) => AppConfig.nomeMunicipio,
  );
});

final tenantLogoProvider = Provider<String?>((ref) {
  final config = ref.watch(tenantConfigProvider);
  return config.when(
    data:    (c) => c.logoUrl,
    loading: () => null,
    error:   (_, __) => null,
  );
});