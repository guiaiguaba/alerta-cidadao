import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../../infra/database/database.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly db: DatabaseService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const host = req.hostname; // ex: iguaba.alertacidadao.com
    const slug = host.split('.')[0];

    if (!slug || slug === 'api') {
      // rotas de healthcheck / admin global sem tenant
      return next();
    }

    const tenant = await this.db.knex('tenants')
      .where({ slug, active: true })
      .first();

    if (!tenant) {
      throw new NotFoundException(`Tenant "${slug}" não encontrado`);
    }

    (req as any).tenant = tenant;
    next();
  }
}
