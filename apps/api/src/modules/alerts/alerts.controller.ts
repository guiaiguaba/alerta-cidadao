// apps/api/src/modules/alerts/dto/alert.dto.ts
import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  IsNumber,
  IsInt,
  IsPositive,
  IsDateString,
  IsUUID,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAlertDto {
  @ApiProperty({ example: '⚠️ Alerta de Alagamento' })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Nível da lagoa em elevação. Evite a Rua da Praia.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message: string;

  @ApiProperty({
    enum: ['evacuation','flood_warning','storm','fire','earthquake','landslide','other'],
  })
  @IsIn(['evacuation','flood_warning','storm','fire','earthquake','landslide','other'])
  alertType: string;

  @ApiProperty({ enum: ['critical','high','medium','info'], default: 'high' })
  @IsIn(['critical','high','medium','info'])
  severity: 'critical' | 'high' | 'medium' | 'info';

  @ApiProperty({ enum: ['all','regions','radius'], default: 'all' })
  @IsIn(['all','regions','radius'])
  targetScope: 'all' | 'regions' | 'radius';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRegions?: string[];

  @ValidateIf(o => o.targetScope === 'radius')
  @IsNumber()
  @Min(-90)
  @Max(90)
  targetLat?: number;

  @ValidateIf(o => o.targetScope === 'radius')
  @IsNumber()
  @Min(-180)
  @Max(180)
  targetLng?: number;

  @ValidateIf(o => o.targetScope === 'radius')
  @IsInt()
  @IsPositive()
  targetRadiusM?: number;

  @IsOptional()
  @IsUUID()
  occurrenceId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// =============================================

// apps/api/src/modules/alerts/alerts.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, Role, CurrentUser } from '../../shared/decorators/index';
import { Public } from '../../shared/decorators/public.decorator';
import { TenantRequest } from '../tenants/tenant.middleware';

@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  // Cidadãos veem alertas ativos
  @Get()
  @ApiOperation({ summary: 'Alertas ativos para o cidadão' })
  listActive(
    @Req() req: TenantRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.alertsService.findAll(req.schemaName, {
      activeOnly: true,
      page,
      limit,
    });
  }

  // Admin vê todos
  @Get('admin')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Todos os alertas (admin)' })
  listAll(
    @Req() req: TenantRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.alertsService.findAll(req.schemaName, { page, limit });
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Criar alerta (salvar como rascunho)' })
  create(
    @Body() dto: CreateAlertDto,
    @Req() req: TenantRequest,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.alertsService.create(dto, userId, tenantId, req.schemaName);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do alerta' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: TenantRequest,
  ) {
    return this.alertsService.findOne(id, req.schemaName);
  }

  @Post(':id/send')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disparar alerta para a população' })
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: TenantRequest,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.alertsService.send(id, userId, tenantId, req.schemaName);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cancelar alerta' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: TenantRequest,
    @CurrentUser('id') userId: string,
  ) {
    return this.alertsService.cancel(id, userId, req.schemaName);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar alerta como lido' })
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: TenantRequest,
    @CurrentUser('id') userId: string,
  ) {
    return this.alertsService.markRead(id, userId, req.schemaName);
  }
}
