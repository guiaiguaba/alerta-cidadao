// apps/api/src/modules/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly db: TenantPrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: JwtPayload) {
    const schemaName = req.schemaName;
    if (!schemaName) throw new UnauthorizedException('Tenant não identificado');

    const prisma = await this.db.forTenant(schemaName);

    const [user] = await prisma.$queryRaw<any[]>`
      SELECT id, name, email, role, is_active, is_blocked
      FROM users
      WHERE id = ${payload.sub}
      LIMIT 1
    `;

    if (!user || !user.is_active || user.is_blocked) {
      throw new UnauthorizedException('Usuário inativo ou bloqueado');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: payload.tenantId,
      schemaName,
    };
  }
}
