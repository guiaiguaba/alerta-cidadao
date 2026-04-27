// apps/api/src/modules/auth/auth.service.ts
// Serviço de autenticação multi-tenant com JWT

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';

export interface JwtPayload {
  sub: string;        // user id
  tenantId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: {
    name: string;
    email?: string;
    phone?: string;
    password?: string;
    tenantId: string;
    schemaName: string;
    // Coordenadas do dispositivo no momento do cadastro (obrigatório para cidadãos)
    lat?: number;
    lng?: number;
  }): Promise<AuthTokens & { status?: string; mensagem?: string }> {
    const prisma = await this.db.forTenant(dto.schemaName);

    // Verificar se e-mail já existe
    if (dto.email) {
      const exists = await prisma.$queryRaw<any[]>`
        SELECT id FROM users WHERE email = ${dto.email} LIMIT 1
      `;
      if (exists.length > 0) {
        throw new ConflictException('E-mail já cadastrado');
      }
    }

    if (!dto.email && !dto.phone) {
      throw new BadRequestException('E-mail ou telefone obrigatório');
    }

    // Validação geográfica — bloquear cadastros muito distantes do município
    let registrationStatus: 'approved' | 'pending' = 'approved';
    if (dto.lat !== undefined && dto.lng !== undefined) {
      const geoService = new (await import('./geo-registration.service')).GeoRegistrationService(this.db);
      const geoResult  = await geoService.verificarLocalizacao(dto.schemaName, dto.lat, dto.lng);

      if (!geoResult.permitido) {
        // Bloqueio total — muito longe
        throw new ForbiddenException(
          geoResult.mensagem ??
          `Este app é exclusivo para moradores do município. Você está a ${Math.round(geoResult.distanciaKm)}km.`,
        );
      }
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, this.config.get<number>('BCRYPT_ROUNDS', 12))
      : null;

    const [user] = await prisma.$queryRaw<any[]>`
      INSERT INTO users (
        id, name, email, phone, password_hash, role,
        registration_status, registration_lat, registration_lng
      )
      VALUES (
        ${uuidv4()}, ${dto.name}, ${dto.email ?? null}, ${dto.phone ?? null},
        ${passwordHash}, 'citizen',
        ${registrationStatus},
        ${dto.lat ?? null}, ${dto.lng ?? null}
      )
      RETURNING id, name, email, role, registration_status
    `;

    return this.generateTokens(user.id, dto.tenantId, user.role, dto.schemaName);
  }

  async login(dto: {
    email: string;
    password: string;
    tenantId: string;
    schemaName: string;
  }): Promise<AuthTokens> {
    const prisma = await this.db.forTenant(dto.schemaName);

    const [user] = await prisma.$queryRaw<any[]>`
      SELECT id, email, password_hash, role, is_active, is_blocked
      FROM users
      WHERE email = ${dto.email}
      LIMIT 1
    `;

    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    if (!user.is_active) throw new UnauthorizedException('Conta inativa');
    if (user.is_blocked) throw new UnauthorizedException('Conta bloqueada');

    const passwordMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatch) throw new UnauthorizedException('Credenciais inválidas');

    // Atualizar last_login
    await prisma.$executeRaw`
      UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}
    `;

    return this.generateTokens(user.id, dto.tenantId, user.role, dto.schemaName);
  }

  async refreshTokens(dto: {
    refreshToken: string;
    tenantId: string;
    schemaName: string;
  }): Promise<AuthTokens> {
    const prisma = await this.db.forTenant(dto.schemaName);

    const tokenHash = await bcrypt.hash(dto.refreshToken, 1); // hash simples para comparação

    const [tokenRecord] = await prisma.$queryRaw<any[]>`
      SELECT rt.*, u.role, u.is_active
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ${tokenHash}
        AND rt.expires_at > NOW()
        AND rt.revoked_at IS NULL
      LIMIT 1
    `;

    if (!tokenRecord) throw new UnauthorizedException('Refresh token inválido');

    // Revogar token atual (rotação)
    await prisma.$executeRaw`
      UPDATE refresh_tokens SET revoked_at = NOW()
      WHERE id = ${tokenRecord.id}
    `;

    return this.generateTokens(tokenRecord.user_id, dto.tenantId, tokenRecord.role, dto.schemaName);
  }

  private async generateTokens(
    userId: string,
    tenantId: string,
    role: string,
    schemaName: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, tenantId, role };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRY', '15m'),
    });

    const refreshToken = uuidv4() + '-' + uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 1);

    const prisma = await this.db.forTenant(schemaName);
    await prisma.$executeRaw`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES (
        ${uuidv4()},
        ${userId},
        ${refreshTokenHash},
        NOW() + INTERVAL '30 days'
      )
    `;

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // segundos
    };
  }

  // ==========================================
  // GOOGLE OAUTH
  // ==========================================

  async googleAuth(dto: {
    idToken: string;
    tenantId: string;
    schemaName: string;
  }): Promise<AuthTokens> {
    // Verificar o ID token com a API do Google
    const googleUser = await this.verifyGoogleToken(dto.idToken);

    const prisma = await this.db.forTenant(dto.schemaName);

    // Buscar por google_id primeiro, depois por e-mail
    let [user] = await prisma.$queryRaw<any[]>`
      SELECT id, role, is_active, is_blocked
      FROM users
      WHERE google_id = ${googleUser.sub}
         OR (email = ${googleUser.email} AND email IS NOT NULL)
      LIMIT 1
    `;

    if (!user) {
      // Primeiro login com Google — criar usuário
      const userId = uuidv4();
      [user] = await prisma.$queryRaw<any[]>`
        INSERT INTO users (id, name, email, google_id, email_verified, avatar_url, role)
        VALUES (
          ${userId},
          ${googleUser.name},
          ${googleUser.email},
          ${googleUser.sub},
          true,
          ${googleUser.picture ?? null},
          'citizen'
        )
        RETURNING id, role, is_active, is_blocked
      `;
    } else {
      // Atualizar google_id e avatar se ainda não vinculados
      await prisma.$executeRaw`
        UPDATE users
        SET google_id = COALESCE(google_id, ${googleUser.sub}),
            email_verified = true,
            avatar_url = COALESCE(avatar_url, ${googleUser.picture ?? null}),
            last_login_at = NOW(),
            updated_at = NOW()
        WHERE id = ${user.id}
      `;
    }

    if (!user.is_active)  throw new UnauthorizedException('Conta inativa');
    if (user.is_blocked)  throw new UnauthorizedException('Conta bloqueada');

    return this.generateTokens(user.id, dto.tenantId, user.role, dto.schemaName);
  }

  private async verifyGoogleToken(idToken: string): Promise<{
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    // Verificar com endpoint de tokeninfo do Google
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );

    if (!response.ok) {
      throw new UnauthorizedException('Token Google inválido');
    }

    const payload = await response.json();

    // Verificar audience (client_id do app)
    const expectedAudience = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (expectedAudience && payload.aud !== expectedAudience) {
      throw new UnauthorizedException('Token Google inválido (audience incorreta)');
    }

    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Token Google não contém dados de usuário');
    }

    return {
      sub:     payload.sub,
      email:   payload.email,
      name:    payload.name ?? payload.email.split('@')[0],
      picture: payload.picture,
    };
  }

  // ==========================================
  // LOGOUT — Revogar refresh token
  // ==========================================

  async logout(dto: {
    refreshToken: string;
    userId: string;
    schemaName: string;
  }): Promise<void> {
    const prisma = await this.db.forTenant(dto.schemaName);
    const tokenHash = await bcrypt.hash(dto.refreshToken, 1);

    await prisma.$executeRaw`
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = ${tokenHash}
        AND user_id = ${dto.userId}
        AND revoked_at IS NULL
    `;
  }
}
