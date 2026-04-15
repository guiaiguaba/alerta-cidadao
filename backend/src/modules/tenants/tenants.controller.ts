import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TenantsService, CreateTenantDto } from './tenants.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../common/decorators';

@Controller('tenants')
export class TenantsController {
  constructor(private svc: TenantsService) {}

  // Rota pública para criar tenant (uso interno / super-admin)
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.svc.create(dto);
  }

  @Get('stats')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin')
  stats(@CurrentTenant() tenant: any) {
    return this.svc.stats(tenant.id);
  }

  @Get('categorias')
  @UseGuards(FirebaseAuthGuard)
  categorias(@CurrentTenant() tenant: any) {
    // Disponível para todos usuários autenticados do tenant
    return (this as any).db?.knex('categorias')
      .where({ tenant_id: tenant.id, ativa: true })
      .orderBy('nome');
  }
}
