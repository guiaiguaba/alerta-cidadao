// apps/api/src/modules/analytics/analytics.service.ts
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const DASHBOARD_CACHE_TTL = 300; // 5 minutos

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly db: TenantPrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ==========================================
  // DASHBOARD — Métricas resumo
  // ==========================================

  async getDashboard(schemaName: string) {
    const cacheKey = `stats:${schemaName}:dashboard`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const prisma = await this.db.forTenant(schemaName);

    const [
      totalStats,
      byStatus,
      byPriority,
      avgResolution,
      slaStats,
      todayStats,
      agentPerformance,
    ] = await Promise.all([
      // Total geral
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('rejected','duplicate')) AS total,
          COUNT(*) FILTER (WHERE status = 'open') AS open,
          COUNT(*) FILTER (WHERE status IN ('assigned','in_progress')) AS in_progress,
          COUNT(*) FILTER (WHERE status = 'resolved') AS resolved
        FROM occurrences
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `,

      // Por status
      prisma.$queryRaw<any[]>`
        SELECT status, COUNT(*) as count
        FROM occurrences
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY status
        ORDER BY count DESC
      `,

      // Por prioridade (abertos)
      prisma.$queryRaw<any[]>`
        SELECT priority, COUNT(*) as count
        FROM occurrences
        WHERE status IN ('open','assigned','in_progress')
        GROUP BY priority
        ORDER BY
          CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
      `,

      // Tempo médio de resolução
      prisma.$queryRaw<any[]>`
        SELECT
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)::DECIMAL(10,2) AS avg_minutes,
          PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60
          )::DECIMAL(10,2) AS median_minutes
        FROM occurrences
        WHERE status = 'resolved'
          AND resolved_at IS NOT NULL
          AND created_at >= NOW() - INTERVAL '30 days'
      `,

      // SLA
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*) AS total_resolved,
          COUNT(*) FILTER (WHERE sla_breached = false AND status = 'resolved') AS within_sla,
          COUNT(*) FILTER (WHERE sla_breached = true) AS breached,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE sla_breached = false AND status = 'resolved') /
            NULLIF(COUNT(*) FILTER (WHERE status = 'resolved'), 0),
            1
          ) AS sla_compliance_pct
        FROM occurrences
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `,

      // Hoje
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*) AS total_today,
          COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_today
        FROM occurrences
        WHERE created_at >= CURRENT_DATE
      `,

      // Top 5 agentes por ocorrências resolvidas
      prisma.$queryRaw<any[]>`
        SELECT
          u.id,
          u.name,
          COUNT(*) AS resolved_count,
          AVG(EXTRACT(EPOCH FROM (o.resolved_at - o.created_at)) / 60)::DECIMAL(10,2) AS avg_minutes
        FROM occurrences o
        JOIN users u ON u.id = o.resolved_by
        WHERE o.status = 'resolved'
          AND o.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY u.id, u.name
        ORDER BY resolved_count DESC
        LIMIT 5
      `,
    ]);

    const result = {
      period: '30_days',
      overview: totalStats[0],
      byStatus,
      byPriority,
      resolution: avgResolution[0],
      sla: slaStats[0],
      today: todayStats[0],
      topAgents: agentPerformance,
      generatedAt: new Date().toISOString(),
    };

    await this.redis.setex(cacheKey, DASHBOARD_CACHE_TTL, JSON.stringify(result));
    return result;
  }

  // ==========================================
  // TIMELINE — Volume por período
  // ==========================================

  async getTimeline(
    schemaName: string,
    opts: {
      from: string;
      to: string;
      groupBy?: 'day' | 'week' | 'month';
    },
  ) {
    const prisma = await this.db.forTenant(schemaName);
    const groupBy = opts.groupBy ?? 'day';

    const truncFn = {
      day:   'day',
      week:  'week',
      month: 'month',
    }[groupBy];

    return prisma.$queryRawUnsafe<any[]>(`
      SELECT
        date_trunc('${truncFn}', created_at)::DATE AS period,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
        COUNT(*) FILTER (WHERE priority = 'critical') AS critical,
        COUNT(*) FILTER (WHERE sla_breached = true) AS sla_breaches
      FROM occurrences
      WHERE created_at BETWEEN $1::timestamptz AND $2::timestamptz
      GROUP BY period
      ORDER BY period
    `, opts.from, opts.to);
  }

  // ==========================================
  // CATEGORIAS
  // ==========================================

  async getByCategory(schemaName: string, days = 30) {
    const prisma = await this.db.forTenant(schemaName);
    return prisma.$queryRaw<any[]>`
      SELECT
        c.id,
        c.name,
        c.icon,
        c.color,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE o.status = 'resolved') AS resolved,
        AVG(EXTRACT(EPOCH FROM (o.resolved_at - o.created_at)) / 60)
          FILTER (WHERE o.status = 'resolved')::DECIMAL(10,2) AS avg_minutes,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE o.status = 'resolved') / COUNT(*),
          1
        ) AS resolution_rate_pct
      FROM occurrences o
      JOIN categories c ON c.id = o.category_id
      WHERE o.created_at >= NOW() - (${days} * INTERVAL '1 day')
      GROUP BY c.id, c.name, c.icon, c.color
      ORDER BY total DESC
    `;
  }

  // ==========================================
  // REGIÕES / MAPA DE CALOR
  // ==========================================

  async getByRegion(schemaName: string, days = 30) {
    const prisma = await this.db.forTenant(schemaName);
    return prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(o.region_code, 'sem_regiao') AS region_code,
        r.name AS region_name,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE o.priority IN ('critical','high')) AS high_priority,
        COUNT(*) FILTER (WHERE o.status = 'open') AS open_count
      FROM occurrences o
      LEFT JOIN regions r ON r.code = o.region_code
      WHERE o.created_at >= NOW() - (${days} * INTERVAL '1 day')
      GROUP BY o.region_code, r.name
      ORDER BY total DESC
    `;
  }

  // ==========================================
  // HEATMAP (GeoJSON)
  // ==========================================

  async getHeatmap(
    schemaName: string,
    opts: { days?: number; status?: string } = {},
  ) {
    const prisma = await this.db.forTenant(schemaName);
    const days = opts.days ?? 30;

    const occurrences = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        lat::float8 AS lat,
        lng::float8 AS lng,
        CASE priority
          WHEN 'critical' THEN 4
          WHEN 'high'     THEN 3
          WHEN 'medium'   THEN 2
          ELSE 1
        END AS weight
      FROM occurrences
      WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
        AND is_public = true
        ${opts.status ? `AND status = '${opts.status}'` : ''}
    `, days);

    return {
      type: 'FeatureCollection',
      features: occurrences.map(o => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [o.lng, o.lat],
        },
        properties: { weight: o.weight },
      })),
    };
  }

  // ==========================================
  // PERFORMANCE DE AGENTES
  // ==========================================

  async getAgentPerformance(schemaName: string, days = 30) {
    const prisma = await this.db.forTenant(schemaName);
    return prisma.$queryRaw<any[]>`
      SELECT
        u.id,
        u.name,
        u.avatar_url,
        COUNT(*) FILTER (WHERE o.assigned_to = u.id) AS assigned_total,
        COUNT(*) FILTER (WHERE o.assigned_to = u.id AND o.status = 'resolved') AS resolved_total,
        AVG(
          EXTRACT(EPOCH FROM (o.resolved_at - o.created_at)) / 60
        ) FILTER (WHERE o.assigned_to = u.id AND o.status = 'resolved')::DECIMAL(10,2) AS avg_resolution_min,
        COUNT(*) FILTER (WHERE o.assigned_to = u.id AND o.sla_breached = true) AS sla_breaches,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE o.assigned_to = u.id AND o.status = 'resolved') /
          NULLIF(COUNT(*) FILTER (WHERE o.assigned_to = u.id), 0),
          1
        ) AS resolution_rate_pct
      FROM users u
      LEFT JOIN occurrences o ON o.assigned_to = u.id
        AND o.created_at >= NOW() - (${days} * INTERVAL '1 day')
      WHERE u.role IN ('agent', 'supervisor')
        AND u.is_active = true
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY resolved_total DESC NULLS LAST
    `;
  }

  // ==========================================
  // RELATÓRIO SLA
  // ==========================================

  async getSlaReport(schemaName: string, opts: { from: string; to: string }) {
    const prisma = await this.db.forTenant(schemaName);
    return prisma.$queryRaw<any[]>`
      SELECT
        priority,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE sla_breached = false AND status = 'resolved') AS within_sla,
        COUNT(*) FILTER (WHERE sla_breached = true) AS breached,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE sla_breached = false AND status = 'resolved') /
          NULLIF(COUNT(*), 0),
          1
        ) AS compliance_pct,
        AVG(
          EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60
        ) FILTER (WHERE status = 'resolved')::DECIMAL(10,2) AS avg_resolution_min
      FROM occurrences
      WHERE created_at BETWEEN ${opts.from}::timestamptz AND ${opts.to}::timestamptz
      GROUP BY priority
      ORDER BY
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
    `;
  }
}
