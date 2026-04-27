// apps/api/src/modules/tenants/tenants.controller.ts
// Rotas internas de gerenciamento de tenants (super_admin)

import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Get,
  Patch,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
} from '@nestjs/swagger';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantRequest } from './tenant.middleware';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, Role, CurrentUser } from '../../shared/decorators/index';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

class ProvisionDto {
  @IsString() @MinLength(2) @MaxLength(63)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug: apenas letras minúsculas, números e hífens' })
  slug: string;

  @IsString() @MinLength(3) name: string;
  @IsString() displayName: string;
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  subdomain: string;

  @IsString() @Matches(/^[A-Z]{2}$/) stateCode: string;
  @IsOptional() @IsString() cityIbgeCode?: string;
  @IsOptional() @IsNumber() centerLat?: number;
  @IsOptional() @IsNumber() centerLng?: number;

  @IsEmail() adminEmail: string;
  @IsString() adminName: string;
  @IsOptional() @IsString() @MinLength(8) adminPassword?: string;
  @IsOptional() @IsString() primaryColor?: string;
}

// Guard para rotas internas (usa API key no header)
class InternalApiKeyGuard {
  canActivate(context: any): boolean {
    const req = context.switchToHttp().getRequest();
    const key = req.headers['x-internal-api-key'];
    return key === process.env.INTERNAL_API_KEY;
  }
}

@ApiTags('Internal — Tenants')
@Controller('internal/tenants')
export class TenantsController {
  constructor(
    private readonly provisioningService: TenantProvisioningService,
    private readonly db: TenantPrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Provisionar nova prefeitura (super_admin)' })
  async provision(@Body() dto: ProvisionDto) {
    const result = await this.provisioningService.provision(dto);
    return {
      message: 'Prefeitura provisionada com sucesso',
      tenantId: result.tenantId,
      schemaName: result.schemaName,
      adminEmail: result.adminCredentials.email,
      tempPassword: result.adminCredentials.tempPassword,
      loginUrl: `https://${dto.subdomain}.alertacidadao.com`,
    };
  }

  @Delete(':id/deactivate')
  @ApiOperation({ summary: 'Desativar prefeitura (reversível)' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    await this.provisioningService.deprovision(id);
    return { message: 'Prefeitura desativada' };
  }

  @Delete(':id/drop-schema')
  @ApiOperation({ summary: '⚠️ IRREVERSÍVEL: Remove schema e todos os dados' })
  async dropSchema(@Param('id', ParseUUIDPipe) id: string) {
    await this.provisioningService.dropSchema(id);
    return { message: 'Schema removido permanentemente' };
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as prefeituras' })
  async listAll() {
    const publicClient = this.db.getPublicClient();
    return publicClient.$queryRaw`
      SELECT
        id, slug, name, display_name, subdomain,
        state_code, is_active, created_at
      FROM tenants
      ORDER BY created_at DESC
    `;
  }
}

// =============================================
// ADMIN CONTROLLER (por tenant)
// Rotas de configuração da própria prefeitura
// =============================================

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly db: TenantPrismaService) {}

  @Get('tenant')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Configurações do tenant atual' })
  async getTenantConfig(@Req() req: TenantRequest) {
    const publicClient = this.db.getPublicClient();
    const [tenant] = await publicClient.$queryRaw<any[]>`
      SELECT
        t.*,
        ts.sla_critical_min,
        ts.sla_high_min,
        ts.sla_medium_min,
        ts.sla_low_min,
        ts.max_occ_per_user_day,
        ts.cooldown_minutes
      FROM tenants t
      LEFT JOIN tenant_settings ts ON ts.tenant_id = t.id
      WHERE t.id = ${req.tenantId}
    `;
    return tenant;
  }

  @Patch('tenant')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Atualizar configurações visuais do tenant' })
  async updateTenantConfig(
    @Req() req: TenantRequest,
    @Body() body: {
      displayName?: string;
      primaryColor?: string;
      secondaryColor?: string;
      logoUrl?: string;
    },
  ) {
    const publicClient = this.db.getPublicClient();

    const updates: string[] = [];
    if (body.displayName) updates.push(`display_name = '${body.displayName}'`);
    if (body.primaryColor) updates.push(`primary_color = '${body.primaryColor}'`);
    if (body.secondaryColor) updates.push(`secondary_color = '${body.secondaryColor}'`);
    if (body.logoUrl) updates.push(`logo_url = '${body.logoUrl}'`);

    if (updates.length) {
      await publicClient.$executeRawUnsafe(`
        UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = '${req.tenantId}'
      `);
    }

    return { updated: true };
  }

  @Get('categories')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Gerenciar categorias de ocorrência' })
  async getCategories(@Req() req: TenantRequest) {
    const prisma = await this.db.forTenant(req.schemaName);
    return prisma.$queryRaw`
      SELECT * FROM categories ORDER BY sort_order, name
    `;
  }

  @Post('categories')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Criar categoria customizada' })
  async createCategory(
    @Req() req: TenantRequest,
    @Body() body: {
      code: string;
      name: string;
      icon?: string;
      color?: string;
      defaultPriority?: string;
      parentId?: number;
    },
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    const [category] = await prisma.$queryRaw<any[]>`
      INSERT INTO categories (code, name, icon, color, default_priority, parent_id)
      VALUES (
        ${body.code},
        ${body.name},
        ${body.icon ?? 'report'},
        ${body.color ?? '#9E9E9E'},
        ${body.defaultPriority ?? 'medium'},
        ${body.parentId ?? null}
      )
      RETURNING *
    `;
    return category;
  }

  @Get('regions')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Listar regiões configuradas' })
  async getRegions(@Req() req: TenantRequest) {
    const prisma = await this.db.forTenant(req.schemaName);
    return prisma.$queryRaw`SELECT * FROM regions WHERE is_active = true ORDER BY sort_order, name`;
  }

  @Get('users')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar usuários do tenant' })
  async listUsers(
    @Req() req: TenantRequest,
    @CurrentUser('id') currentUserId: string,
  ) {
    const prisma = await this.db.forTenant(req.schemaName);
    return prisma.$queryRaw`
      SELECT id, name, email, phone, role, is_active, last_login_at, created_at
      FROM users
      WHERE id != ${currentUserId}
      ORDER BY role, name
    `;
  }
}
