// Adicionar ao apps/api/src/modules/auth/auth.controller.ts
// ==========================================
// ENDPOINTS DE ATIVAÇÃO DE AGENTE
// ==========================================
// Estes 3 endpoints ficam em /auth/* e são públicos (sem JWT)

import { AgentInviteService } from '../users/agent-invite.service';
import { IsString, IsEmail, MinLength } from 'class-validator';
import { TenantRequest } from '../tenants/tenant.middleware';

class ValidarCodigoDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  codigo: string;
}

class CriarSenhaDto {
  @IsString()
  tokenAtivacao: string;

  @IsString()
  @MinLength(6)
  novaSenha: string;

  @IsString()
  @MinLength(6)
  confirmarSenha: string;
}

// ---- Dentro do AuthController ----

// Validar e-mail + código → retorna token de ativação
@Post('ativar/validar')
@ApiOperation({ summary: 'Agente valida e-mail + código de convite' })
async validarCodigo(
  @Body() dto: ValidarCodigoDto,
  @Req() req: TenantRequest,
) {
  const resultado = await this.inviteService.validarCodigo(
    req.schemaName,
    dto.email,
    dto.codigo,
  );
  return {
    tokenAtivacao: resultado.tokenAtivacao,
    nome:          resultado.nome,
    mensagem:      'Código válido! Crie sua senha para continuar.',
  };
}

// Criar senha definitiva com o token
@Post('ativar/criar-senha')
@ApiOperation({ summary: 'Agente define a senha definitiva' })
async criarSenha(@Body() dto: CriarSenhaDto) {
  if (dto.novaSenha !== dto.confirmarSenha) {
    throw new BadRequestException('As senhas não coincidem.');
  }
  return this.inviteService.criarSenha(dto.tokenAtivacao, dto.novaSenha);
}

// ==========================================
// ENDPOINT DE CONVITE (autenticado — admin/supervisor)
// ==========================================
// Adicionar no UsersController

class ConvidarAgenteDto {
  @IsString() @MinLength(2) @MaxLength(100)
  nome: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsIn(['agent', 'supervisor'])
  cargo?: 'agent' | 'supervisor';
}

@Post('agentes/convidar')
@Roles(Role.ADMIN, Role.SUPERVISOR)
@ApiOperation({ summary: 'Convidar agente — gera código de 6 dígitos' })
async convidarAgente(
  @Body() dto: ConvidarAgenteDto,
  @Req() req: TenantRequest,
) {
  const resultado = await this.inviteService.convidar(
    req.schemaName,
    {
      nome:  dto.nome,
      email: dto.email,
      cargo: dto.cargo ?? 'agent',
    },
  );

  return {
    id:     resultado.id,
    nome:   dto.nome,
    email:  dto.email,
    codigo: resultado.codigo,
    expira: resultado.expira,
    instrucao: [
      `1. Envie o código ${resultado.codigo} para ${dto.nome} (WhatsApp, e-mail ou pessoalmente)`,
      `2. O agente abre o App do Agente e digita o e-mail e o código`,
      `3. O app pede para criar uma senha — pronto, acesso liberado`,
      `(O código expira em 48 horas)`,
    ].join('\n'),
  };
}
