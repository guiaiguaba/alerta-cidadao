// Adicionar ao apps/api/src/modules/users/users.controller.ts
// ==========================================
// ENDPOINTS NOVOS — Gestão de Agentes (Admin)
// ==========================================
// Inserir após a classe UpdateUserRoleDto existente

import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

class CriarAgenteDto {
  @IsString() @MinLength(2) @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Telefone inválido' })
  telefone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  senha?: string;

  @IsOptional()
  @IsIn(['agente', 'supervisor'])
  cargo?: string; // 'agente' ou 'supervisor'

  // Pelo menos email OU telefone é obrigatório
}

// ==========================================
// Adicionar dentro do UsersController:
// ==========================================

@Post('agentes')
@Roles(Role.ADMIN)
@ApiOperation({ summary: 'Cadastrar novo agente pelo painel web' })
async criarAgente(
  @Body() dto: CriarAgenteDto,
  @Req() req: TenantRequest,
) {
  if (!dto.email && !dto.telefone) {
    throw new BadRequestException('Informe e-mail ou telefone do agente');
  }

  const prisma = await this.db.forTenant(req.schemaName);

  // Verificar se já existe
  const [existente] = await prisma.$queryRaw<any[]>`
    SELECT id FROM users
    WHERE email = ${dto.email ?? null}
       OR phone = ${dto.telefone ?? null}
    LIMIT 1
  `;

  if (existente) {
    throw new ConflictException(
      'Já existe um usuário com esse e-mail ou telefone'
    );
  }

  // Gerar senha temporária se não informada
  const senhaTemp = dto.senha ?? this.gerarSenhaTemporaria();
  const senhaHash = await bcrypt.hash(senhaTemp, 12);
  const userId    = require('uuid').v4();
  const role      = dto.cargo === 'supervisor' ? 'supervisor' : 'agent';

  await prisma.$executeRaw`
    INSERT INTO users (
      id, name, email, phone,
      password_hash, role,
      email_verified, phone_verified,
      is_active
    ) VALUES (
      ${userId},
      ${dto.nome},
      ${dto.email ?? null},
      ${dto.telefone ?? null},
      ${senhaHash},
      ${role},
      ${!!dto.email},
      ${!!dto.telefone},
      true
    )
  `;

  return {
    id:          userId,
    nome:        dto.nome,
    email:       dto.email,
    telefone:    dto.telefone,
    cargo:       role === 'agent' ? 'Agente' : 'Supervisor',
    senhaTemporaria: dto.senha ? undefined : senhaTemp,
    mensagem: dto.senha
      ? 'Agente cadastrado. Pode fazer login no App do Agente.'
      : `Agente cadastrado. Senha temporária: ${senhaTemp} — compartilhe com o agente.`,
  };
}

@Get('agentes')
@Roles(Role.ADMIN, Role.SUPERVISOR)
@ApiOperation({ summary: 'Listar todos os agentes e supervisores' })
async listarAgentes(@Req() req: TenantRequest) {
  const prisma = await this.db.forTenant(req.schemaName);
  return prisma.$queryRaw`
    SELECT
      u.id,
      u.name      AS nome,
      u.email,
      u.phone     AS telefone,
      u.role      AS cargo,
      u.is_active AS ativo,
      u.last_login_at AS ultimo_acesso,
      u.created_at    AS cadastrado_em,
      COUNT(o.id) FILTER (WHERE o.status IN ('assigned','in_progress')) AS ocorrencias_ativas,
      COUNT(o.id) FILTER (WHERE o.status = 'resolved')                 AS ocorrencias_resolvidas
    FROM users u
    LEFT JOIN occurrences o ON o.assigned_to = u.id
    WHERE u.role IN ('agent', 'supervisor')
    GROUP BY u.id
    ORDER BY u.role, u.name
  `;
}

@Delete('agentes/:id')
@Roles(Role.ADMIN)
@ApiOperation({ summary: 'Desativar agente' })
async desativarAgente(
  @Param('id', ParseUUIDPipe) agenteId: string,
  @Req() req: TenantRequest,
) {
  const prisma = await this.db.forTenant(req.schemaName);
  await prisma.$executeRaw`
    UPDATE users
    SET is_active = false, updated_at = NOW()
    WHERE id = ${agenteId} AND role IN ('agent', 'supervisor')
  `;
  return { desativado: true };
}

@Patch('agentes/:id/reativar')
@Roles(Role.ADMIN)
@ApiOperation({ summary: 'Reativar agente' })
async reativarAgente(
  @Param('id', ParseUUIDPipe) agenteId: string,
  @Req() req: TenantRequest,
) {
  const prisma = await this.db.forTenant(req.schemaName);
  await prisma.$executeRaw`
    UPDATE users
    SET is_active = true, updated_at = NOW()
    WHERE id = ${agenteId} AND role IN ('agent', 'supervisor')
  `;
  return { reativado: true };
}

@Post('agentes/:id/resetar-senha')
@Roles(Role.ADMIN)
@ApiOperation({ summary: 'Gerar nova senha temporária para agente' })
async resetarSenha(
  @Param('id', ParseUUIDPipe) agenteId: string,
  @Req() req: TenantRequest,
) {
  const prisma    = await this.db.forTenant(req.schemaName);
  const senhaTemp = this.gerarSenhaTemporaria();
  const senhaHash = await bcrypt.hash(senhaTemp, 12);

  await prisma.$executeRaw`
    UPDATE users
    SET password_hash = ${senhaHash},
        must_change_password = true,
        updated_at = NOW()
    WHERE id = ${agenteId}
  `;

  return {
    senhaTemporaria: senhaTemp,
    mensagem: `Nova senha gerada. Compartilhe com o agente: ${senhaTemp}`,
  };
}

// Helper privado
private gerarSenhaTemporaria(tamanho = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(
    { length: tamanho },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
