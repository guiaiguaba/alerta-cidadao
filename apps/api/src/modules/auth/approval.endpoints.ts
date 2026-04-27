// Adicionar ao apps/api/src/modules/auth/auth.controller.ts
// e ao apps/api/src/modules/users/users.controller.ts

// ============================================================
// ENDPOINT: Cadastro com localização (cidadão no app)
// ============================================================
// No RegisterDto existente, adicionar:

class RegisterDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;

  // Coordenadas do dispositivo — obrigatório para validação geográfica
  @IsNumber() lat: number;
  @IsNumber() lng: number;
}

// No AuthController.register():
@Post('register')
async register(@Body() dto: RegisterDto, @Req() req: TenantRequest) {
  return this.authService.register({
    name:       dto.name,
    email:      dto.email,
    phone:      dto.phone,
    password:   dto.password,
    tenantId:   req.tenantId,
    schemaName: req.schemaName,
    lat:        dto.lat,   // coordenadas do GPS do celular
    lng:        dto.lng,
  });
}

// ============================================================
// ENDPOINTS: Aprovação de cidadãos (Admin/Supervisor)
// ============================================================
// Adicionar no AdminController ou UsersController:

@Get('cidadaos/pendentes')
@Roles(Role.ADMIN, Role.SUPERVISOR)
@ApiOperation({ summary: 'Cidadãos aguardando validação de cadastro' })
async cidadaosPendentes(@Req() req: TenantRequest) {
  return this.geoService.listarPendentes(req.schemaName);
}

@Patch('cidadaos/:id/aprovar')
@Roles(Role.ADMIN, Role.SUPERVISOR)
@ApiOperation({ summary: 'Aprovar cadastro de cidadão' })
async aprovarCidadao(
  @Param('id', ParseUUIDPipe) id: string,
  @Req() req: TenantRequest,
) {
  await this.geoService.aprovar(req.schemaName, id);
  return { aprovado: true };
}

@Patch('cidadaos/:id/rejeitar')
@Roles(Role.ADMIN, Role.SUPERVISOR)
@ApiOperation({ summary: 'Rejeitar/ignorar cadastro de cidadão' })
async rejeitarCidadao(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() body: { motivo?: string },
  @Req() req: TenantRequest,
) {
  await this.geoService.rejeitar(req.schemaName, id, body.motivo);
  return { rejeitado: true };
}

@Get('cidadaos')
@Roles(Role.ADMIN, Role.SUPERVISOR)
@ApiOperation({ summary: 'Listar todos os cidadãos cadastrados' })
async listarCidadaos(
  @Req() req: TenantRequest,
  @Query('status') status?: string, // approved | pending | rejected
) {
  const prisma = await this.db.forTenant(req.schemaName);
  return prisma.$queryRaw`
    SELECT
      id, name, email, phone,
      registration_status AS status,
      registration_lat    AS lat,
      registration_lng    AS lng,
      is_active, is_blocked,
      last_login_at, created_at,
      (SELECT COUNT(*) FROM occurrences WHERE reporter_id = users.id) AS total_ocorrencias
    FROM users
    WHERE role = 'citizen'
      AND (${ status ?? null } IS NULL OR registration_status = ${ status ?? 'approved' })
    ORDER BY
      CASE registration_status WHEN 'pending' THEN 0 ELSE 1 END,
      created_at DESC
    LIMIT 200
  `;
}
