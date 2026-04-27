// apps/api/src/modules/sla/sla-cron.service.ts
// Cron job que verifica SLA violados e notifica supervisores

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OccurrencesGateway } from '../../gateways/occurrences.gateway';

// Intervalo de verificação: a cada 5 minutos
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Tempo para aviso pré-breach: 10 minutos antes
const PRE_BREACH_WARNING_MIN = 10;

@Injectable()
export class SlaCronService implements OnModuleInit {
  private readonly logger = new Logger(SlaCronService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: TenantPrismaService,
    private readonly notifications: NotificationsService,
    private readonly wsGateway: OccurrencesGateway,
  ) {}

  onModuleInit() {
    // Aguardar 30 segundos após start antes do primeiro check
    setTimeout(() => this.startCron(), 30_000);
  }

  private startCron() {
    this.logger.log(`SLA Cron iniciado (intervalo: ${CHECK_INTERVAL_MS / 60000}min)`);
    this.runCheck(); // Execução imediata
    this.timer = setInterval(() => this.runCheck(), CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runCheck(): Promise<void> {
    try {
      const publicClient = this.db.getPublicClient();

      // Buscar todos os tenants ativos
      const tenants = await publicClient.$queryRaw<any[]>`
        SELECT id, schema_name FROM tenants WHERE is_active = true
      `;

      let totalBreached = 0;
      let totalWarnings = 0;

      for (const tenant of tenants) {
        try {
          const { breached, warnings } = await this.checkTenant(
            tenant.id,
            tenant.schema_name,
          );
          totalBreached += breached;
          totalWarnings += warnings;
        } catch (err) {
          this.logger.error(
            `Erro no SLA check do tenant ${tenant.schema_name}: ${err.message}`,
          );
        }
      }

      if (totalBreached > 0 || totalWarnings > 0) {
        this.logger.log(
          `SLA Check: ${totalBreached} violações, ${totalWarnings} alertas prévios`,
        );
      }
    } catch (err) {
      this.logger.error(`SLA Cron falhou: ${err.message}`);
    }
  }

  private async checkTenant(
    tenantId: string,
    schemaName: string,
  ): Promise<{ breached: number; warnings: number }> {
    const prisma = await this.db.forTenant(schemaName);

    // ==========================================
    // 1. MARCAR OCORRÊNCIAS COMO SLA VIOLADO
    // ==========================================
    const newlyBreached = await prisma.$queryRaw<any[]>`
      UPDATE occurrences
      SET sla_breached = true, updated_at = NOW()
      WHERE status IN ('open', 'assigned', 'in_progress')
        AND sla_deadline < NOW()
        AND sla_breached = false
      RETURNING
        id, protocol, priority, assigned_to, region_code,
        reporter_id
    `;

    if (newlyBreached.length > 0) {
      this.logger.warn(
        `[${schemaName}] ${newlyBreached.length} ocorrências violaram SLA`,
      );

      // Inserir na timeline
      for (const occ of newlyBreached) {
        const systemUserId = await this.getSystemUserId(schemaName, prisma);

        await prisma.$executeRaw`
          INSERT INTO occurrence_timeline (id, occurrence_id, user_id, action, metadata)
          VALUES (
            gen_random_uuid(),
            ${occ.id},
            ${systemUserId},
            'sla_breached',
            '{"automated": true}'::jsonb
          )
        `;

        // Notificar via WebSocket (painel)
        this.wsGateway.emitOccurrenceUpdated(tenantId, {
          id: occ.id,
          status: 'open', // Status não muda, só flag SLA
          priority: occ.priority,
          regionCode: occ.region_code,
        });
      }

      // Notificar supervisores
      await this.notifySupervisors(
        newlyBreached,
        tenantId,
        schemaName,
        prisma,
      );
    }

    // ==========================================
    // 2. AVISOS PRÉ-BREACH (10min antes)
    // ==========================================
    const preBreachWarnings = await prisma.$queryRaw<any[]>`
      SELECT id, protocol, priority, assigned_to, region_code
      FROM occurrences
      WHERE status IN ('open', 'assigned', 'in_progress')
        AND sla_breached = false
        AND sla_deadline BETWEEN NOW() AND NOW() + (${PRE_BREACH_WARNING_MIN} * INTERVAL '1 minute')
    `;

    // Usar Redis para não notificar o mesmo prazo 2x
    for (const occ of preBreachWarnings) {
      const warningKey = `sla:warned:${schemaName}:${occ.id}`;
      const alreadyWarned = await this.db['redis']?.exists(warningKey).catch(() => 0);

      if (!alreadyWarned) {
        if (occ.assigned_to) {
          await this.notifications.sendToUser({
            userId: occ.assigned_to,
            type: 'sla_breach',
            title: `⏰ SLA em risco`,
            body: `Ocorrência ${occ.protocol} vence em ${PRE_BREACH_WARNING_MIN} minutos`,
            data: { occurrenceId: occ.id, screen: 'occurrence_detail' },
            schemaName,
          });
        }
        // Marcar no Redis por 15min para não duplicar
        // await redis.setex(warningKey, 15 * 60, '1');
      }
    }

    // ==========================================
    // 3. ATUALIZAR daily_stats
    // ==========================================
    await this.updateDailyStats(schemaName, prisma);

    return {
      breached: newlyBreached.length,
      warnings: preBreachWarnings.length,
    };
  }

  private async notifySupervisors(
    occurrences: any[],
    tenantId: string,
    schemaName: string,
    prisma: any,
  ) {
    // Buscar supervisores e admins ativos
    const supervisors = await prisma.$queryRaw<any[]>`
      SELECT id FROM users
      WHERE role IN ('supervisor', 'admin')
        AND is_active = true
        AND array_length(fcm_tokens, 1) > 0
    `;

    if (!supervisors.length) return;

    const criticalCount = occurrences.filter(o => o.priority === 'critical').length;
    const highCount = occurrences.filter(o => o.priority === 'high').length;

    const title = `⚠️ ${occurrences.length} violação(ões) de SLA`;
    const body = criticalCount > 0
      ? `${criticalCount} crítica(s), ${highCount} alta(s) aguardando`
      : `${occurrences.length} ocorrência(s) passaram do prazo`;

    for (const supervisor of supervisors) {
      await this.notifications.sendToUser({
        userId: supervisor.id,
        type: 'sla_breach',
        title,
        body,
        data: { screen: 'occurrences_list', filter: 'sla_breached' },
        schemaName,
      });
    }
  }

  private async updateDailyStats(schemaName: string, prisma: any) {
    // Upsert nas stats diárias
    await prisma.$executeRaw`
      INSERT INTO daily_stats (date, region_code, category_id, total_opened, total_resolved, total_rejected, avg_resolution_min, sla_breaches)
      SELECT
        CURRENT_DATE AS date,
        region_code,
        category_id,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS total_opened,
        COUNT(*) FILTER (WHERE DATE(resolved_at) = CURRENT_DATE) AS total_resolved,
        COUNT(*) FILTER (WHERE DATE(updated_at) = CURRENT_DATE AND status = 'rejected') AS total_rejected,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)
          FILTER (WHERE DATE(resolved_at) = CURRENT_DATE)::DECIMAL(10,2) AS avg_resolution_min,
        COUNT(*) FILTER (WHERE sla_breached = true AND DATE(updated_at) = CURRENT_DATE) AS sla_breaches
      FROM occurrences
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
      GROUP BY region_code, category_id
      ON CONFLICT (date, COALESCE(region_code, ''), COALESCE(category_id::text, ''))
      DO UPDATE SET
        total_opened = EXCLUDED.total_opened,
        total_resolved = EXCLUDED.total_resolved,
        total_rejected = EXCLUDED.total_rejected,
        avg_resolution_min = EXCLUDED.avg_resolution_min,
        sla_breaches = EXCLUDED.sla_breaches
    `.catch(() => {}); // Não bloquear por erro de stats
  }

  private systemUserIdCache: Record<string, string> = {};

  private async getSystemUserId(schemaName: string, prisma: any): Promise<string> {
    if (this.systemUserIdCache[schemaName]) {
      return this.systemUserIdCache[schemaName];
    }

    // Buscar ou criar usuário sistema
    let [sysUser] = await prisma.$queryRaw<any[]>`
      SELECT id FROM users WHERE email = 'sistema@alertacidadao.internal' LIMIT 1
    `;

    if (!sysUser) {
      [sysUser] = await prisma.$queryRaw<any[]>`
        INSERT INTO users (id, name, email, role)
        VALUES (gen_random_uuid(), 'Sistema', 'sistema@alertacidadao.internal', 'admin')
        RETURNING id
      `;
    }

    this.systemUserIdCache[schemaName] = sysUser.id;
    return sysUser.id;
  }
}
