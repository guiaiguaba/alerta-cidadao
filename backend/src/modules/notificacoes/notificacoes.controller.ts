import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../common/decorators';
import { DatabaseService } from '../../infra/database/database.service';

@Controller('notificacoes')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class NotificacoesController {
  constructor(private db: DatabaseService) {}

  @Get()
  @Roles('admin', 'agent')
  findAll(
    @CurrentTenant() tenant: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.db.knex('notificacoes')
      .where({ tenant_id: tenant.id })
      .orderBy('created_at', 'desc')
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit));
  }
}
