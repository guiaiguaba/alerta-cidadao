// apps/api/src/modules/analytics/analytics.controller.ts
import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, Role } from '../../shared/decorators/index';
import { TenantRequest } from '../tenants/tenant.middleware';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERVISOR)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Métricas resumo do dashboard (cache 5min)' })
  dashboard(@Req() req: TenantRequest) {
    return this.analyticsService.getDashboard(req.schemaName);
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Volume de ocorrências por período' })
  @ApiQuery({ name: 'from', example: '2026-01-01' })
  @ApiQuery({ name: 'to', example: '2026-04-30' })
  @ApiQuery({ name: 'groupBy', enum: ['day', 'week', 'month'], required: false })
  timeline(
    @Req() req: TenantRequest,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    return this.analyticsService.getTimeline(req.schemaName, { from, to, groupBy });
  }

  @Get('categories')
  @ApiOperation({ summary: 'Análise por categoria de ocorrência' })
  byCategory(
    @Req() req: TenantRequest,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getByCategory(req.schemaName, days);
  }

  @Get('regions')
  @ApiOperation({ summary: 'Análise por região' })
  byRegion(
    @Req() req: TenantRequest,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getByRegion(req.schemaName, days);
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'GeoJSON de calor para mapa (Pro+)' })
  heatmap(
    @Req() req: TenantRequest,
    @Query('days') days?: number,
    @Query('status') status?: string,
  ) {
    return this.analyticsService.getHeatmap(req.schemaName, { days, status });
  }

  @Get('agents')
  @ApiOperation({ summary: 'Performance de agentes' })
  agents(
    @Req() req: TenantRequest,
    @Query('days') days?: number,
  ) {
    return this.analyticsService.getAgentPerformance(req.schemaName, days);
  }

  @Get('sla')
  @ApiOperation({ summary: 'Relatório de SLA por prioridade' })
  slaReport(
    @Req() req: TenantRequest,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.analyticsService.getSlaReport(req.schemaName, { from, to });
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar dados (CSV ou PDF)' })
  @ApiQuery({ name: 'format', enum: ['csv', 'json'], required: false })
  @ApiQuery({ name: 'type', enum: ['occurrences', 'sla', 'agents'], required: false })
  async export(
    @Req() req: TenantRequest,
    @Res() res: Response,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Query('type') type: 'occurrences' | 'sla' | 'agents' = 'occurrences',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = to ?? new Date().toISOString();

    let data: any[];

    if (type === 'sla') {
      data = await this.analyticsService.getSlaReport(req.schemaName, {
        from: fromDate,
        to: toDate,
      });
    } else if (type === 'agents') {
      data = await this.analyticsService.getAgentPerformance(req.schemaName);
    } else {
      data = (await this.analyticsService.getTimeline(req.schemaName, {
        from: fromDate,
        to: toDate,
      }));
    }

    if (format === 'csv') {
      const csv = this.toCSV(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="alerta-cidadao-${type}-${fromDate.slice(0, 10)}.csv"`,
      );
      res.send('\uFEFF' + csv); // BOM para Excel reconhecer UTF-8
    } else {
      res.json({ data, exportedAt: new Date().toISOString() });
    }
  }

  private toCSV(rows: any[]): string {
    if (!rows.length) return '';

    const headers = Object.keys(rows[0]);
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const str = String(v);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [
      headers.map(escape).join(','),
      ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
    ];

    return lines.join('\r\n');
  }
}
