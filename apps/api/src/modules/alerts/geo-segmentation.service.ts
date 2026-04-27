// apps/api/src/modules/alerts/geo-segmentation.service.ts
// Segmentação geográfica de alertas usando PostGIS

import { Injectable, Logger } from '@nestjs/common';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';

export interface GeoTarget {
  type: 'radius' | 'polygon' | 'regions';
  // Raio: centro + metros
  centerLat?:    number;
  centerLng?:    number;
  radiusMeters?: number;
  // Polígono: array de [lng, lat] pairs (GeoJSON)
  polygon?:      [number, number][];
  // Regiões: lista de códigos
  regionCodes?:  string[];
}

export interface SegmentedUser {
  id:         string;
  fcmTokens:  string[];
  homeLat?:   number;
  homeLng?:   number;
  regionCode?: string;
}

@Injectable()
export class GeoSegmentationService {
  private readonly logger = new Logger(GeoSegmentationService.name);

  constructor(private readonly db: TenantPrismaService) {}

  /**
   * Retorna usuários dentro de um raio (em metros) do ponto central.
   * Usa ST_DWithin do PostGIS para busca eficiente com índice espacial.
   */
  async getUsersInRadius(
    schemaName: string,
    centerLat: number,
    centerLng: number,
    radiusMeters: number,
  ): Promise<SegmentedUser[]> {
    const prisma = await this.db.forTenant(schemaName);

    return prisma.$queryRaw<SegmentedUser[]>`
      SELECT
        id,
        fcm_tokens   AS "fcmTokens",
        home_lat     AS "homeLat",
        home_lng     AS "homeLng"
      FROM users
      WHERE
        is_active = true
        AND array_length(fcm_tokens, 1) > 0
        AND home_lat IS NOT NULL
        AND home_lng IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(home_lng::float8, home_lat::float8), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${centerLng}, ${centerLat}), 4326)::geography,
          ${radiusMeters}
        )
    `;
  }

  /**
   * Retorna usuários dentro de um polígono GeoJSON.
   * Útil para alertas por bairro ou zona com forma irregular.
   */
  async getUsersInPolygon(
    schemaName: string,
    polygon: [number, number][],
  ): Promise<SegmentedUser[]> {
    const prisma = await this.db.forTenant(schemaName);

    // Converter array de coordenadas para WKT polygon
    const coords = polygon.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
    const firstPt = polygon[0];
    const wkt = `POLYGON((${coords}, ${firstPt[0]} ${firstPt[1]}))`;

    return prisma.$queryRawUnsafe<SegmentedUser[]>(`
      SELECT
        id,
        fcm_tokens   AS "fcmTokens",
        home_lat     AS "homeLat",
        home_lng     AS "homeLng"
      FROM users
      WHERE
        is_active = true
        AND array_length(fcm_tokens, 1) > 0
        AND home_lat IS NOT NULL
        AND home_lng IS NOT NULL
        AND ST_Within(
          ST_SetSRID(ST_MakePoint(home_lng::float8, home_lat::float8), 4326),
          ST_GeomFromText('${wkt}', 4326)
        )
    `);
  }

  /**
   * Retorna usuários associados a regiões específicas.
   * Combina home_lat/home_lng com polígonos armazenados na tabela regions.
   */
  async getUsersInRegions(
    schemaName: string,
    regionCodes: string[],
  ): Promise<SegmentedUser[]> {
    const prisma = await this.db.forTenant(schemaName);

    // Abordagem 1: Usuários com region_code explícito (simplificada)
    const byCode = await prisma.$queryRaw<SegmentedUser[]>`
      SELECT DISTINCT
        u.id,
        u.fcm_tokens AS "fcmTokens",
        u.home_lat   AS "homeLat",
        u.home_lng   AS "homeLng"
      FROM users u
      WHERE
        u.is_active = true
        AND array_length(u.fcm_tokens, 1) > 0
        -- Usuários que registraram ocorrências nessas regiões (proxy para localização)
        AND u.id IN (
          SELECT DISTINCT reporter_id
          FROM occurrences
          WHERE region_code = ANY(${regionCodes}::text[])
            AND created_at >= NOW() - INTERVAL '30 days'
        )
    `;

    // Abordagem 2 (PostGIS): Cruzar home_lat/home_lng com polígonos das regiões
    let byPolygon: SegmentedUser[] = [];
    try {
      byPolygon = await prisma.$queryRaw<SegmentedUser[]>`
        SELECT DISTINCT
          u.id,
          u.fcm_tokens AS "fcmTokens",
          u.home_lat   AS "homeLat",
          u.home_lng   AS "homeLng"
        FROM users u
        JOIN regions r ON r.code = ANY(${regionCodes}::text[])
        WHERE
          u.is_active = true
          AND array_length(u.fcm_tokens, 1) > 0
          AND u.home_lat IS NOT NULL
          AND u.home_lng IS NOT NULL
          AND r.boundary IS NOT NULL
          AND ST_Within(
            ST_SetSRID(ST_MakePoint(u.home_lng::float8, u.home_lat::float8), 4326),
            ST_SetSRID(
              ST_GeomFromGeoJSON(r.boundary::text),
              4326
            )
          )
      `;
    } catch (err) {
      // PostGIS não disponível ou polígonos não cadastrados — usar apenas byCode
      this.logger.warn(`[GeoSeg] PostGIS polygon query falhou: ${err.message}`);
    }

    // Mesclar e deduplicar por ID
    const seen = new Set<string>();
    const all  = [...byCode, ...byPolygon].filter(u => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });

    this.logger.log(
      `[GeoSeg] Regiões ${regionCodes.join(',')} → ${all.length} usuários (${byCode.length} por código, ${byPolygon.length} por polígono)`,
    );

    return all;
  }

  /**
   * Ponto de entrada unificado: resolve target → lista de usuários.
   */
  async resolveTarget(
    schemaName: string,
    target: GeoTarget,
  ): Promise<SegmentedUser[]> {
    switch (target.type) {
      case 'radius':
        if (!target.centerLat || !target.centerLng || !target.radiusMeters) return [];
        return this.getUsersInRadius(
          schemaName,
          target.centerLat,
          target.centerLng,
          target.radiusMeters,
        );

      case 'polygon':
        if (!target.polygon?.length) return [];
        return this.getUsersInPolygon(schemaName, target.polygon);

      case 'regions':
        if (!target.regionCodes?.length) return [];
        return this.getUsersInRegions(schemaName, target.regionCodes);

      default:
        return [];
    }
  }

  /**
   * Contagem estimada de destinatários antes de enviar (preview no painel).
   */
  async estimateRecipients(
    schemaName: string,
    target: GeoTarget,
  ): Promise<{ estimated: number; withLocation: number; total: number }> {
    const prisma = await this.db.forTenant(schemaName);

    const [total] = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true AND array_length(fcm_tokens, 1) > 0)                   AS total,
        COUNT(*) FILTER (WHERE is_active = true AND home_lat IS NOT NULL AND home_lng IS NOT NULL)      AS with_location
      FROM users
    `;

    const users = await this.resolveTarget(schemaName, target);

    return {
      estimated:    users.length,
      withLocation: parseInt(total.with_location),
      total:        parseInt(total.total),
    };
  }
}
