// lib/core/constants/app_config.dart
// Configurações do app definidas em tempo de build via --dart-define
// Cada município recebe um build próprio com seu TENANT_SLUG

class AppConfig {
  AppConfig._();

  /// Slug do município — configurado via:
  /// flutter build apk --dart-define=TENANT_SLUG=iguaba-grande
  static const tenantSlug = String.fromEnvironment(
    'TENANT_SLUG',
    defaultValue: 'demo', // fallback só para desenvolvimento
  );

  /// URL da API — configurada via:
  /// flutter build apk --dart-define=API_URL=https://api.alertacidadao.com.br/api/v1
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );

  /// Nome de exibição do município (para splash screen, título do app)
  static const nomeMunicipio = String.fromEnvironment(
    'NOME_MUNICIPIO',
    defaultValue: 'Alerta Cidadão',
  );

  /// Flavor do app: 'citizen' ou 'agent'
  static const flavor = String.fromEnvironment(
    'FLAVOR',
    defaultValue: 'citizen',
  );

  static bool get isCitizen => flavor == 'citizen';
  static bool get isAgent   => flavor == 'agent';
}
