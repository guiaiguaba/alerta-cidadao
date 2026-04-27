// Adicionar ao apps/api/src/modules/tenants/tenants.controller.ts
// ==========================================
// ENDPOINTS DE CONFIGURAÇÃO GEOGRÁFICA
// ==========================================

// GET /admin/geo-config — público (app do cidadão consulta sem estar logado)
// Retorna apenas as informações necessárias para verificação de área
@Get('geo-config')
@ApiOperation({ summary: 'Configuração geográfica do tenant (pública)' })
async getGeoConfig(@Req() req: TenantRequest) {
  const publicClient = this.db.getPublicClient();

  const [tenant] = await publicClient.$queryRaw<any[]>`
    SELECT
      center_lat,
      center_lng,
      geo_radius_km,
      display_name
    FROM tenants
    WHERE id = ${req.tenantId}
    LIMIT 1
  `;

  return {
    center_lat:    tenant?.center_lat    ? parseFloat(tenant.center_lat)    : null,
    center_lng:    tenant?.center_lng    ? parseFloat(tenant.center_lng)    : null,
    geo_radius_km: tenant?.geo_radius_km ? parseInt(tenant.geo_radius_km)   : 30,
    display_name:  tenant?.display_name  ?? '',
  };
}

// PATCH /admin/tenant-config — atualizar configurações incluindo raio geo
// Atualizar o updateTenantConfig existente para incluir os novos campos:

@Patch('tenant-config')
@Roles(Role.ADMIN)
@ApiOperation({ summary: 'Atualizar configurações do tenant' })
async updateTenantConfig(
  @Body() dto: UpdateTenantConfigDto,
  @Req() req: TenantRequest,
) {
  const publicClient = this.db.getPublicClient();

  await publicClient.$executeRaw`
    UPDATE tenants
    SET
      display_name  = COALESCE(${dto.displayName  ?? null}, display_name),
      primary_color = COALESCE(${dto.primaryColor ?? null}, primary_color),
      secondary_color = COALESCE(${dto.secondaryColor ?? null}, secondary_color),
      logo_url      = COALESCE(${dto.logoUrl      ?? null}, logo_url),
      center_lat    = COALESCE(${dto.centerLat    ?? null}, center_lat),
      center_lng    = COALESCE(${dto.centerLng    ?? null}, center_lng),
      geo_radius_km = COALESCE(${dto.geoRadiusKm  ?? null}, geo_radius_km),
      updated_at    = NOW()
    WHERE id = ${req.tenantId}
  `;

  return { atualizado: true };
}

// DTO atualizado
class UpdateTenantConfigDto {
  @IsOptional() @IsString()  displayName?:   string;
  @IsOptional() @IsString()  primaryColor?:  string;
  @IsOptional() @IsString()  secondaryColor?: string;
  @IsOptional() @IsString()  logoUrl?:       string;
  @IsOptional() @IsNumber()  centerLat?:     number;
  @IsOptional() @IsNumber()  centerLng?:     number;
  @IsOptional() @IsInt() @Min(1) @Max(200)
  geoRadiusKm?: number;
}
