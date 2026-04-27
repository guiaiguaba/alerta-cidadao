// apps/api/src/modules/tenants/tenant.middleware.ts
// Extrai o tenant do subdomínio e injeta no request.

import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { ConfigService } from '@nestjs/config';

export interface TenantRequest extends Request {
  tenantId: string;
  schemaName: string;
  tenantSlug: string;
}

const TENANT_CACHE_TTL = 300; // 5 minutos

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    const subdomain = this.extractSubdomain(req);

    if (!subdomain) {
      throw new NotFoundException('Tenant não identificado');
    }

    const tenant = await this.resolveTenant(subdomain);

    if (!tenant) {
      throw new NotFoundException(`Prefeitura "${subdomain}" não encontrada`);
    }

    if (!tenant.isActive) {
      throw new UnauthorizedException('Prefeitura inativa');
    }

    // Injeta no request para uso nos controllers/services
    req.tenantId = tenant.id;
    req.schemaName = tenant.schemaName;
    req.tenantSlug = tenant.slug;

    next();
  }

  private extractSubdomain(req: Request): string | null {
    const host = req.hostname; // ex: "iguaba.alertacidadao.com"
    const appDomain = this.config.get<string>('APP_DOMAIN', 'alertacidadao.com');

    // Desenvolvimento: usar header X-Tenant-Slug
    if (host === 'localhost' || host === '127.0.0.1') {
      return req.headers['x-tenant-slug'] as string ?? 'demo';
    }

    // Produção: extrair subdomínio
    if (host.endsWith(`.${appDomain}`)) {
      return host.replace(`.${appDomain}`, '');
    }

    return null;
  }

  private async resolveTenant(subdomain: string) {
    // 1. Tentar cache Redis
    const cacheKey = `tenant:${subdomain}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Buscar no banco público
    const publicClient = this.db.getPublicClient();
    const tenant = await publicClient.tenant.findUnique({
      where: { subdomain },
      select: {
        id: true,
        slug: true,
        schemaName: true,
        isActive: true,
      },
    });

    if (tenant) {
      await this.redis.setex(cacheKey, TENANT_CACHE_TTL, JSON.stringify(tenant));
    }

    return tenant;
  }
}
