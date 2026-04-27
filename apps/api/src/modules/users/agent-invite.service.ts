// apps/api/src/modules/users/agent-invite.service.ts
// Fluxo: Supervisor convida → código 6 dígitos → agente ativa no app

import {
  Injectable, Logger,
  BadRequestException, ConflictException, UnauthorizedException,
} from '@nestjs/common';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AgentInviteService {
  private readonly logger = new Logger(AgentInviteService.name);

  constructor(private readonly db: TenantPrismaService) {}

  // ==========================================
  // 1. SUPERVISOR CONVIDA AGENTE
  // ==========================================
  async convidar(
    schemaName: string,
    dados: {
      nome:  string;
      email: string;
      cargo: 'agent' | 'supervisor';
    },
  ): Promise<{ id: string; codigo: string; expira: string }> {

    const prisma = await this.db.forTenant(schemaName);

    // Verificar se e-mail já existe
    const [existente] = await prisma.$queryRaw<any[]>`
      SELECT id, is_activated FROM users WHERE email = ${dados.email} LIMIT 1
    `;

    if (existente?.is_activated) {
      throw new ConflictException('Já existe um agente com esse e-mail.');
    }

    // Gerar código de 6 dígitos (sem 0 e 1 para evitar confusão visual)
    const codigo = this.gerarCodigo();
    const expira = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas
    const userId = existente?.id ?? uuidv4();

    if (existente) {
      // Reenviar convite — atualizar código
      await prisma.$executeRaw`
        UPDATE users
        SET activation_code       = ${codigo},
            activation_expires_at = ${expira},
            is_activated          = false,
            name                  = ${dados.nome},
            role                  = ${dados.cargo},
            updated_at            = NOW()
        WHERE id = ${userId}
      `;
    } else {
      // Criar novo agente (ainda não ativado, sem senha)
      await prisma.$executeRaw`
        INSERT INTO users (
          id, name, email, role,
          is_activated, is_active,
          activation_code, activation_expires_at,
          email_verified
        ) VALUES (
          ${userId}, ${dados.nome}, ${dados.email}, ${dados.cargo},
          false, true,
          ${codigo}, ${expira},
          false
        )
      `;
    }

    this.logger.log(
      `Convite enviado: ${dados.email} → cargo ${dados.cargo} → código ${codigo}`,
    );

    return {
      id:     userId,
      codigo,
      expira: expira.toISOString(),
    };
  }

  // ==========================================
  // 2. AGENTE VALIDA O CÓDIGO NO APP
  // ==========================================
  async validarCodigo(
    schemaName: string,
    email:  string,
    codigo: string,
  ): Promise<{ tokenAtivacao: string; nome: string }> {

    const prisma = await this.db.forTenant(schemaName);

    const [usuario] = await prisma.$queryRaw<any[]>`
      SELECT id, name, activation_code, activation_expires_at, is_activated
      FROM users
      WHERE email = ${email.toLowerCase()} AND role IN ('agent','supervisor')
      LIMIT 1
    `;

    if (!usuario) {
      throw new UnauthorizedException('E-mail não encontrado ou não é um agente.');
    }

    if (usuario.is_activated) {
      throw new BadRequestException('Conta já ativada. Use a tela de login normal.');
    }

    if (usuario.activation_code !== codigo.trim()) {
      throw new UnauthorizedException('Código inválido.');
    }

    if (new Date(usuario.activation_expires_at) < new Date()) {
      throw new BadRequestException('Código expirado. Peça ao supervisor um novo convite.');
    }

    // Gerar token temporário para criação de senha (válido 15 minutos)
    const tokenAtivacao = Buffer.from(
      JSON.stringify({
        userId:    usuario.id,
        email,
        schema:    schemaName,
        expiresAt: Date.now() + 15 * 60 * 1000,
        tipo:      'ativacao',
      })
    ).toString('base64');

    return { tokenAtivacao, nome: usuario.name };
  }

  // ==========================================
  // 3. AGENTE CRIA A SENHA DEFINITIVA
  // ==========================================
  async criarSenha(
    tokenAtivacao: string,
    novaSenha:     string,
  ): Promise<{ sucesso: boolean; mensagem: string }> {

    // Decodificar e validar token
    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(tokenAtivacao, 'base64').toString('utf-8'));
    } catch {
      throw new BadRequestException('Token inválido.');
    }

    if (payload.tipo !== 'ativacao') {
      throw new BadRequestException('Token inválido.');
    }

    if (Date.now() > payload.expiresAt) {
      throw new BadRequestException('Token expirado. Recomece o processo de ativação.');
    }

    if (novaSenha.length < 6) {
      throw new BadRequestException('A senha deve ter pelo menos 6 caracteres.');
    }

    const prisma = await this.db.forTenant(payload.schema);
    const senhaHash = await bcrypt.hash(novaSenha, 12);

    await prisma.$executeRaw`
      UPDATE users
      SET password_hash         = ${senhaHash},
          is_activated          = true,
          email_verified        = true,
          activation_code       = NULL,
          activation_expires_at = NULL,
          must_change_password  = false,
          updated_at            = NOW()
      WHERE id = ${payload.userId}
    `;

    this.logger.log(`Agente ativado com sucesso: ${payload.email}`);

    return {
      sucesso:  true,
      mensagem: 'Conta ativada! Você já pode fazer login no app.',
    };
  }

  // ==========================================
  // HELPER
  // ==========================================
  private gerarCodigo(): string {
    // Apenas dígitos 2–9 para evitar confusão com 0, 1
    const chars = '23456789';
    return Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }
}
