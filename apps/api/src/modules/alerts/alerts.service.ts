// apps/api/src/modules/alerts/alerts.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OccurrencesGateway } from '../../gateways/occurrences.gateway';
import { v4 as uuidv4 } from 'uuid';

export interface CreateAlertDto {
  title: string;
  message: string;
  alertType: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  targetScope: 'all' | 'regions' | 'radius';
  targetRegions?: string[];
  targetLat?: number;
  targetLng?: number;
  targetRadiusM?: number;
  occurrenceId?: string;
  expiresAt?: string;
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly notifications: NotificationsService,
    private readonly wsGateway: OccurrencesGateway,
  ) {}

  async create(
    dto: CreateAlertDto,
    userId: string,
    tenantId: string,
    schemaName: string,
  ) {
    const prisma = await this.db.forTenant(schemaName);

    // Validações
    if (dto.targetScope === 'regions' && (!dto.targetRegions?.length)) {
      throw new BadRequestException('Informe ao menos uma região');
    }
    if (dto.targetScope === 'radius' && (!dto.targetLat || !dto.targetLng || !dto.targetRadiusM)) {
      throw new BadRequestException('Informe lat, lng e raio para alerta por raio');
    }

    const id = uuidv4();

    await prisma.$executeRaw`
      INSERT INTO alerts (
        id, title, message, alert_type, severity,
        target_scope, target_regions, target_lat, target_lng, target_radius_m,
        occurrence_id, created_by, status, expires_at
      ) VALUES (
        ${id},
        ${dto.title},
        ${dto.message},
        ${dto.alertType},
        ${dto.severity},
        ${dto.targetScope},
        ${dto.targetRegions ?? null}::text[],
        ${dto.targetLat ?? null},
        ${dto.targetLng ?? null},
        ${dto.targetRadiusM ?? null},
        ${dto.occurrenceId ?? null},
        ${userId},
        'draft',
        ${dto.expiresAt ?? null}
      )
    `;

    return this.findOne(id, schemaName);
  }

  async send(
    alertId: string,
    userId: string,
    tenantId: string,
    schemaName: string,
  ) {
    const prisma = await this.db.forTenant(schemaName);

    const alert = await this.findOne(alertId, schemaName);

    if (alert.status !== 'draft') {
      throw new BadRequestException(
        `Alerta não pode ser enviado no status "${alert.status}"`,
      );
    }

    // Marcar como enviando
    await prisma.$executeRaw`
      UPDATE alerts SET status = 'sending' WHERE id = ${alertId}
    `;

    // Broadcast FCM
    const recipientsCount = await this.notifications.broadcastAlert({
      title: alert.title,
      message: alert.message,
      alertId: alert.id,
      severity: alert.severity,
      targetRegions: alert.target_regions,
      schemaName,
    });

    // Marcar como enviado
    await prisma.$executeRaw`
      UPDATE alerts
      SET status = 'sent', sent_at = NOW(), recipients_count = ${recipientsCount}
      WHERE id = ${alertId}
    `;

    // Emitir via WebSocket para usuários online
    const updatedAlert = await this.findOne(alertId, schemaName);
    this.wsGateway.emitAlertNew(tenantId, updatedAlert);

    return updatedAlert;
  }

  async cancel(alertId: string, userId: string, schemaName: string) {
    const prisma = await this.db.forTenant(schemaName);
    const alert = await this.findOne(alertId, schemaName);

    if (alert.status === 'sent') {
      throw new BadRequestException('Alertas já enviados não podem ser cancelados');
    }

    await prisma.$executeRaw`
      UPDATE alerts SET status = 'cancelled' WHERE id = ${alertId}
    `;

    return this.findOne(alertId, schemaName);
  }

  async findAll(
    schemaName: string,
    opts: { activeOnly?: boolean; page?: number; limit?: number } = {},
  ) {
    const prisma = await this.db.forTenant(schemaName);
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, opts.limit ?? 20);
    const offset = (page - 1) * limit;

    const whereClause = opts.activeOnly
      ? `WHERE a.status = 'sent' AND (a.expires_at IS NULL OR a.expires_at > NOW())`
      : `WHERE 1=1`;

    const alerts = await prisma.$queryRawUnsafe<any[]>(`
      SELECT a.*, u.name AS creator_name
      FROM alerts a
      JOIN users u ON u.id = a.created_by
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const [{ count }] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM alerts a ${whereClause}`,
    );

    return {
      data: alerts,
      meta: {
        total: parseInt(count),
        page,
        limit,
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  }

  async findOne(id: string, schemaName: string) {
    const prisma = await this.db.forTenant(schemaName);
    const [alert] = await prisma.$queryRaw<any[]>`
      SELECT a.*, u.name AS creator_name
      FROM alerts a
      JOIN users u ON u.id = a.created_by
      WHERE a.id = ${id}
      LIMIT 1
    `;
    if (!alert) throw new NotFoundException('Alerta não encontrado');
    return alert;
  }

  async markRead(alertId: string, userId: string, schemaName: string) {
    const prisma = await this.db.forTenant(schemaName);
    await prisma.$executeRaw`
      INSERT INTO alert_reads (alert_id, user_id)
      VALUES (${alertId}, ${userId})
      ON CONFLICT DO NOTHING
    `;
    return { marked: true };
  }
}
