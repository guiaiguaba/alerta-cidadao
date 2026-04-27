// apps/api/src/modules/occurrences/occurrences.service.ts
// Lógica central de negócio para ocorrências

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type OccurrenceStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'rejected' | 'duplicate';

export interface CreateOccurrenceDto {
  categoryId: number;
  description?: string;
  lat: number;
  lng: number;
  address?: string;
  regionCode?: string;
  clientId?: string;       // UUID gerado offline
}

export interface UpdateStatusDto {
  status: OccurrenceStatus;
  note?: string;
  assignedTo?: string;
  rejectionReason?: string;
  duplicateOf?: string;
}

export interface ListOccurrencesDto {
  status?: OccurrenceStatus;
  priority?: Priority;
  regionCode?: string;
  categoryId?: number;
  assignedTo?: string;
  page?: number;
  limit?: number;
  // BBox para mapa: minLat,minLng,maxLat,maxLng
  bbox?: [number, number, number, number];
}

// SLA em minutos por prioridade
const SLA_MINUTES: Record<Priority, number> = {
  critical: 30,
  high:     120,
  medium:   480,
  low:      1440,
};

@Injectable()
export class OccurrencesService {
  constructor(
    private readonly db: TenantPrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async create(
    dto: CreateOccurrenceDto,
    userId: string,
    tenantId: string,
    schemaName: string,
  ) {
    const prisma = await this.db.forTenant(schemaName);

    // 1. Anti-spam: verificar limites do usuário
    await this.checkSpamLimits(userId, tenantId, schemaName, prisma);

    // 2. Deduplicação por client_id (offline sync)
    if (dto.clientId) {
      const [existing] = await prisma.$queryRaw<any[]>`
        SELECT id, protocol FROM occurrences WHERE client_id = ${dto.clientId} LIMIT 1
      `;
      if (existing) return existing; // já sincronizado, retornar existente
    }

    // 3. Buscar categoria para calcular prioridade
    const [category] = await prisma.$queryRaw<any[]>`
      SELECT id, default_priority, name FROM categories WHERE id = ${dto.categoryId} AND is_active = true LIMIT 1
    `;
    if (!category) throw new NotFoundException('Categoria não encontrada');

    // 4. Calcular prioridade automática
    const reporterStats = await this.getReporterStats(userId, prisma);
    const priority = this.calculatePriority(
      category.default_priority,
      reporterStats.confirmedReports,
    );

    // 5. Gerar protocolo
    const protocol = await this.generateProtocol(schemaName, prisma);

    // 6. Calcular deadline SLA
    const slaMinutes = SLA_MINUTES[priority];

    // 7. Inserir ocorrência
    const [occurrence] = await prisma.$queryRaw<any[]>`
      INSERT INTO occurrences (
        id, protocol, category_id, description, lat, lng,
        address, region_code, priority, status,
        reporter_id, sla_deadline, client_id
      ) VALUES (
        ${uuidv4()},
        ${protocol},
        ${dto.categoryId},
        ${dto.description ?? null},
        ${dto.lat},
        ${dto.lng},
        ${dto.address ?? null},
        ${dto.regionCode ?? null},
        ${priority},
        'open',
        ${userId},
        NOW() + (${slaMinutes} * INTERVAL '1 minute'),
        ${dto.clientId ?? null}
      )
      RETURNING *
    `;

    // 8. Registrar timeline
    await prisma.$executeRaw`
      INSERT INTO occurrence_timeline (id, occurrence_id, user_id, action, to_status)
      VALUES (${uuidv4()}, ${occurrence.id}, ${userId}, 'opened', 'open')
    `;

    // 9. Atualizar contador anti-spam
    await this.incrementSpamCounter(userId, prisma);

    // 10. Invalida cache de stats
    await this.redis.del(`stats:${schemaName}:dashboard`);

    return occurrence;
  }

  async list(dto: ListOccurrencesDto, schemaName: string) {
    const prisma = await this.db.forTenant(schemaName);
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(100, dto.limit ?? 20);
    const offset = (page - 1) * limit;

    // Build dinâmico de filtros
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (dto.status) {
      conditions.push(`o.status = $${paramIndex++}`);
      params.push(dto.status);
    }
    if (dto.priority) {
      conditions.push(`o.priority = $${paramIndex++}`);
      params.push(dto.priority);
    }
    if (dto.regionCode) {
      conditions.push(`o.region_code = $${paramIndex++}`);
      params.push(dto.regionCode);
    }
    if (dto.categoryId) {
      conditions.push(`o.category_id = $${paramIndex++}`);
      params.push(dto.categoryId);
    }
    if (dto.assignedTo) {
      conditions.push(`o.assigned_to = $${paramIndex++}`);
      params.push(dto.assignedTo);
    }
    if (dto.bbox) {
      const [minLat, minLng, maxLat, maxLng] = dto.bbox;
      conditions.push(
        `o.lat BETWEEN $${paramIndex++} AND $${paramIndex++}`,
        `o.lng BETWEEN $${paramIndex++} AND $${paramIndex++}`,
      );
      params.push(minLat, maxLat, minLng, maxLng);
    }

    const whereClause = conditions.join(' AND ');
    const query = `
      SELECT
        o.*,
        c.name AS category_name,
        c.icon AS category_icon,
        c.color AS category_color,
        u.name AS reporter_name,
        a.name AS agent_name,
        (SELECT COUNT(*) FROM occurrence_media m WHERE m.occurrence_id = o.id) AS media_count
      FROM occurrences o
      JOIN categories c ON c.id = o.category_id
      JOIN users u ON u.id = o.reporter_id
      LEFT JOIN users a ON a.id = o.assigned_to
      WHERE ${whereClause}
      ORDER BY
        CASE o.priority
          WHEN 'critical' THEN 1
          WHEN 'high'     THEN 2
          WHEN 'medium'   THEN 3
          ELSE 4
        END,
        o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const occurrences = await prisma.$queryRawUnsafe(query, ...params);

    // Count para paginação
    const [{ count }] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM occurrences o WHERE ${whereClause}`,
      ...params,
    );

    return {
      data: occurrences,
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

    const [occurrence] = await prisma.$queryRaw<any[]>`
      SELECT
        o.*,
        c.name AS category_name,
        c.icon AS category_icon,
        c.color AS category_color,
        u.name AS reporter_name,
        u.avatar_url AS reporter_avatar,
        a.name AS agent_name,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', m.id,
            'url', m.url,
            'thumbnail_url', m.thumbnail_url,
            'phase', m.phase,
            'created_at', m.created_at
          )
        ) FILTER (WHERE m.id IS NOT NULL) AS media,
        json_agg(
          DISTINCT jsonb_build_object(
            'action', t.action,
            'from_status', t.from_status,
            'to_status', t.to_status,
            'note', t.note,
            'user_name', tu.name,
            'created_at', t.created_at
          ) ORDER BY t.created_at
        ) FILTER (WHERE t.id IS NOT NULL) AS timeline
      FROM occurrences o
      JOIN categories c ON c.id = o.category_id
      JOIN users u ON u.id = o.reporter_id
      LEFT JOIN users a ON a.id = o.assigned_to
      LEFT JOIN occurrence_media m ON m.occurrence_id = o.id
      LEFT JOIN occurrence_timeline t ON t.occurrence_id = o.id
      LEFT JOIN users tu ON tu.id = t.user_id
      WHERE o.id = ${id}
      GROUP BY o.id, c.name, c.icon, c.color, u.name, u.avatar_url, a.name
    `;

    if (!occurrence) throw new NotFoundException('Ocorrência não encontrada');
    return occurrence;
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    userId: string,
    userRole: string,
    schemaName: string,
  ) {
    const prisma = await this.db.forTenant(schemaName);

    const [occurrence] = await prisma.$queryRaw<any[]>`
      SELECT id, status, priority FROM occurrences WHERE id = ${id} LIMIT 1
    `;
    if (!occurrence) throw new NotFoundException('Ocorrência não encontrada');

    // Validar transição de status
    this.validateStatusTransition(occurrence.status, dto.status, userRole);

    const updates: string[] = [
      `status = '${dto.status}'`,
      `updated_at = NOW()`,
    ];

    if (dto.status === 'resolved') {
      updates.push(`resolved_at = NOW()`, `resolved_by = '${userId}'`);
      if (dto.note) updates.push(`resolution_note = '${dto.note.replace(/'/g, "''")}'`);
    }
    if (dto.status === 'rejected' && dto.rejectionReason) {
      updates.push(`rejection_reason = '${dto.rejectionReason.replace(/'/g, "''")}'`);
    }
    if (dto.status === 'assigned' && dto.assignedTo) {
      updates.push(
        `assigned_to = '${dto.assignedTo}'`,
        `assigned_at = NOW()`,
      );
    }
    if (dto.status === 'duplicate' && dto.duplicateOf) {
      updates.push(`duplicate_of = '${dto.duplicateOf}'`);
    }

    await prisma.$executeRawUnsafe(`
      UPDATE occurrences SET ${updates.join(', ')} WHERE id = '${id}'
    `);

    // Timeline
    await prisma.$executeRaw`
      INSERT INTO occurrence_timeline (id, occurrence_id, user_id, action, from_status, to_status, note)
      VALUES (
        ${uuidv4()},
        ${id},
        ${userId},
        'status_changed',
        ${occurrence.status},
        ${dto.status},
        ${dto.note ?? null}
      )
    `;

    // Atualizar stats diárias
    await this.redis.del(`stats:${schemaName}:dashboard`);

    return this.findOne(id, schemaName);
  }

  /**
   * Sync em lote para o modo offline
   */
  async syncBatch(
    items: (CreateOccurrenceDto & { clientId: string })[],
    userId: string,
    tenantId: string,
    schemaName: string,
  ) {
    const results = { synced: [], conflicts: [], errors: [] };

    for (const item of items) {
      try {
        const occurrence = await this.create(item, userId, tenantId, schemaName);
        results.synced.push({ clientId: item.clientId, id: occurrence.id, protocol: occurrence.protocol });
      } catch (err) {
        if (err.message?.includes('já cadastrado')) {
          results.conflicts.push({ clientId: item.clientId, reason: err.message });
        } else {
          results.errors.push({ clientId: item.clientId, reason: err.message });
        }
      }
    }

    return results;
  }

  // ==========================================
  // HELPERS PRIVADOS
  // ==========================================

  private calculatePriority(defaultPriority: Priority, confirmedReports: number): Priority {
    const scores: Record<Priority, number> = {
      critical: 100,
      high: 70,
      medium: 40,
      low: 10,
    };

    let score = scores[defaultPriority];

    // Boost por histórico do reporter
    if (confirmedReports > 10) score += 10;
    else if (confirmedReports > 5) score += 5;

    // Boost por horário de pico
    const hour = new Date().getHours();
    const isPeakHour = (hour >= 6 && hour <= 9) || (hour >= 17 && hour <= 20);
    if (isPeakHour) score += 5;

    if (score >= 90) return 'critical';
    if (score >= 65) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
  }

  private async generateProtocol(schemaName: string, prisma: any): Promise<string> {
    // Prefixo baseado no schema (3 primeiras letras do slug)
    const prefix = schemaName.replace('tenant_', '').substring(0, 3).toUpperCase();
    const year = new Date().getFullYear();

    const [{ count }] = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM occurrences
      WHERE created_at >= date_trunc('year', NOW())
    `;

    const seq = String(parseInt(count) + 1).padStart(5, '0');
    return `${prefix}-${year}-${seq}`;
  }

  private async checkSpamLimits(
    userId: string,
    tenantId: string,
    schemaName: string,
    prisma: any,
  ) {
    const today = new Date().toISOString().split('T')[0];

    const [activity] = await prisma.$queryRaw<any[]>`
      SELECT occurrences_today, last_occurrence_at
      FROM user_activity_limits
      WHERE user_id = ${userId} AND date = ${today}::date
    `;

    const MAX_PER_DAY = 5;
    const COOLDOWN_MINUTES = 15;

    if (activity) {
      if (activity.occurrences_today >= MAX_PER_DAY) {
        throw new BadRequestException(
          `Limite diário de ${MAX_PER_DAY} ocorrências atingido. Tente novamente amanhã.`
        );
      }

      if (activity.last_occurrence_at) {
        const lastAt = new Date(activity.last_occurrence_at);
        const diffMinutes = (Date.now() - lastAt.getTime()) / 60000;
        if (diffMinutes < COOLDOWN_MINUTES) {
          const waitMin = Math.ceil(COOLDOWN_MINUTES - diffMinutes);
          throw new BadRequestException(
            `Aguarde ${waitMin} minuto(s) antes de registrar outra ocorrência.`
          );
        }
      }
    }
  }

  private async incrementSpamCounter(userId: string, prisma: any) {
    const today = new Date().toISOString().split('T')[0];
    await prisma.$executeRaw`
      INSERT INTO user_activity_limits (user_id, date, occurrences_today, last_occurrence_at)
      VALUES (${userId}, ${today}::date, 1, NOW())
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        occurrences_today = user_activity_limits.occurrences_today + 1,
        last_occurrence_at = NOW()
    `;
  }

  private async getReporterStats(userId: string, prisma: any) {
    const [stats] = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) FILTER (WHERE status = 'resolved') as confirmed_reports
      FROM occurrences
      WHERE reporter_id = ${userId}
    `;
    return { confirmedReports: parseInt(stats?.confirmed_reports ?? '0') };
  }

  private validateStatusTransition(
    fromStatus: OccurrenceStatus,
    toStatus: OccurrenceStatus,
    userRole: string,
  ) {
    // Cidadão não pode mudar status
    if (userRole === 'citizen') {
      throw new ForbiddenException('Cidadãos não podem alterar status de ocorrências');
    }

    // Transições válidas
    const validTransitions: Record<OccurrenceStatus, OccurrenceStatus[]> = {
      open:        ['assigned', 'rejected', 'duplicate'],
      assigned:    ['in_progress', 'open', 'rejected'],
      in_progress: ['resolved', 'assigned'],
      resolved:    [],
      rejected:    ['open'],  // Pode reabrir
      duplicate:   [],
    };

    if (!validTransitions[fromStatus]?.includes(toStatus)) {
      throw new BadRequestException(
        `Transição de "${fromStatus}" para "${toStatus}" não é permitida`
      );
    }
  }

  // ==========================================
  // ASSIGN — Atribuir ocorrência
  // ==========================================

  async assign(
    id: string,
    agentId: string | undefined,
    teamId: string | undefined,
    supervisorId: string,
    schemaName: string,
  ) {
    const prisma = await this.db.forTenant(schemaName);

    const [occurrence] = await prisma.$queryRaw<any[]>`
      SELECT id, status FROM occurrences WHERE id = ${id} LIMIT 1
    `;
    if (!occurrence) throw new NotFoundException('Ocorrência não encontrada');
    if (!['open', 'assigned'].includes(occurrence.status)) {
      throw new BadRequestException(
        `Não é possível atribuir ocorrência com status "${occurrence.status}"`,
      );
    }

    const updates: string[] = [
      `status = 'assigned'`,
      `assigned_at = NOW()`,
      `updated_at = NOW()`,
    ];
    if (agentId) updates.push(`assigned_to = '${agentId}'`);
    if (teamId)  updates.push(`team_id = '${teamId}'`);

    await prisma.$executeRawUnsafe(
      `UPDATE occurrences SET ${updates.join(', ')} WHERE id = '${id}'`,
    );

    await prisma.$executeRaw`
      INSERT INTO occurrence_timeline (id, occurrence_id, user_id, action, from_status, to_status, metadata)
      VALUES (
        gen_random_uuid(), ${id}, ${supervisorId}, 'assigned', ${occurrence.status}, 'assigned',
        ${JSON.stringify({ agentId, teamId })}::jsonb
      )
    `;

    await this.redis.del(`stats:${schemaName}:dashboard`);
    return this.findOne(id, schemaName);
  }

  // ==========================================
  // ADD MEDIA — Vincular arquivo a ocorrência
  // ==========================================

  async addMedia(
    occurrenceId: string,
    uploadedBy: string,
    file: { url: string; thumbnailUrl?: string; mediaType: string; fileSizeBytes: number; mimeType: string },
    phase: string,
    schemaName: string,
  ) {
    const prisma = await this.db.forTenant(schemaName);

    const [media] = await prisma.$queryRaw<any[]>`
      INSERT INTO occurrence_media (
        id, occurrence_id, uploaded_by, url, thumbnail_url,
        media_type, phase, file_size_bytes, mime_type
      ) VALUES (
        gen_random_uuid(),
        ${occurrenceId},
        ${uploadedBy},
        ${file.url},
        ${file.thumbnailUrl ?? null},
        ${file.mediaType},
        ${phase},
        ${file.fileSizeBytes},
        ${file.mimeType}
      )
      RETURNING *
    `;

    // Registrar na timeline
    await prisma.$executeRaw`
      INSERT INTO occurrence_timeline (id, occurrence_id, user_id, action)
      VALUES (gen_random_uuid(), ${occurrenceId}, ${uploadedBy}, 'photo_added')
    `;

    return media;
  }

  // ==========================================
  // GET TIMELINE — Histórico de ações
  // ==========================================

  async getTimeline(occurrenceId: string, schemaName: string) {
    const prisma = await this.db.forTenant(schemaName);

    const [occ] = await prisma.$queryRaw<any[]>`
      SELECT id FROM occurrences WHERE id = ${occurrenceId} LIMIT 1
    `;
    if (!occ) throw new NotFoundException('Ocorrência não encontrada');

    return prisma.$queryRaw<any[]>`
      SELECT
        t.id,
        t.action,
        t.from_status,
        t.to_status,
        t.note,
        t.metadata,
        t.created_at,
        u.id   AS user_id,
        u.name AS user_name,
        u.role AS user_role,
        u.avatar_url AS user_avatar
      FROM occurrence_timeline t
      JOIN users u ON u.id = t.user_id
      WHERE t.occurrence_id = ${occurrenceId}
      ORDER BY t.created_at ASC
    `;
  }

  // ==========================================
  // GET MAP GEOJSON — Dados para mapa
  // ==========================================

  async getMapGeoJson(dto: ListOccurrencesDto, schemaName: string) {
    const prisma = await this.db.forTenant(schemaName);

    const conditions: string[] = [`o.is_public = true`];
    const params: any[] = [];
    let pi = 1;

    if (dto.status)     { conditions.push(`o.status = $${pi++}`);      params.push(dto.status); }
    if (dto.categoryId) { conditions.push(`o.category_id = $${pi++}`); params.push(dto.categoryId); }
    if (dto.priority)   { conditions.push(`o.priority = $${pi++}`);    params.push(dto.priority); }
    if (dto.regionCode) { conditions.push(`o.region_code = $${pi++}`); params.push(dto.regionCode); }
    if (dto.bbox) {
      const [minLat, minLng, maxLat, maxLng] = dto.bbox;
      conditions.push(
        `o.lat BETWEEN $${pi++} AND $${pi++}`,
        `o.lng BETWEEN $${pi++} AND $${pi++}`,
      );
      params.push(minLat, maxLat, minLng, maxLng);
    }

    const where = conditions.join(' AND ');

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        o.id,
        o.protocol,
        o.priority,
        o.status,
        o.lat::float8 AS lat,
        o.lng::float8 AS lng,
        o.address,
        o.created_at,
        c.name  AS category_name,
        c.icon  AS category_icon,
        c.color AS category_color,
        (SELECT url FROM occurrence_media m WHERE m.occurrence_id = o.id LIMIT 1) AS thumbnail
      FROM occurrences o
      JOIN categories c ON c.id = o.category_id
      WHERE ${where}
      ORDER BY o.created_at DESC
      LIMIT 500
    `, ...params);

    return {
      type: 'FeatureCollection',
      features: rows.map(r => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [r.lng, r.lat],
        },
        properties: {
          id:            r.id,
          protocol:      r.protocol,
          priority:      r.priority,
          status:        r.status,
          address:       r.address,
          categoryName:  r.category_name,
          categoryIcon:  r.category_icon,
          categoryColor: r.category_color,
          thumbnail:     r.thumbnail,
          createdAt:     r.created_at,
        },
      })),
      meta: { total: rows.length },
    };
  }
}
