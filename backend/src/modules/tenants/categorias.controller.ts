import { Controller, Get, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentTenant } from '../../common/decorators';
import { DatabaseService } from '../../infra/database/database.service';

@Controller('categorias')
@UseGuards(FirebaseAuthGuard)
export class CategoriasController {
  constructor(private db: DatabaseService) {}

  @Get()
  findAll(@CurrentTenant() tenant: any) {
    return this.db.knex('categorias')
      .where({ tenant_id: tenant.id, ativa: true })
      .select('id', 'nome', 'icone', 'cor')
      .orderBy('nome');
  }
}
