import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../../infra/database/database.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly db: DatabaseService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // 1. Tenta resolver pelo subdomínio (produção com domínio)
    const host = req.hostname;
    let slug = host.split('.')[0];

    // 2. Fallback: header X-Tenant-Slug (quando acessa por IP direto)
    if (!slug || slug === 'localhost' || /^\d+$/.test(slug) || slug === 'api') {
      slug = (req.headers['x-tenant-slug'] as string) ?? '';
    }

    // 3. Rotas sem tenant (healthcheck, criar tenant)
    if (!slug) return next();

    const tenant = await this.db.knex('tenants')
      .where({ slug, active: true })
      .first();

    if (!tenant) {
      throw new NotFoundException(`Tenant "${slug}" não encontrado. Verifique se o tenant foi criado via POST /tenants`);
    }

    (req as any).tenant = tenant;
    next();
  }
}
