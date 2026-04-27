// apps/api/src/modules/auth/geo-registration.service.ts
// Controla o cadastro de cidadãos por localização geográfica

import {
  Injectable, Logger, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';

export interface GeoRegistrationResult {
  permitido:   boolean;
  distanciaKm: number;
  raioKm:      number;
  status:      'approved' | 'pending' | 'blocked';
  mensagem?:   string;
}

@Injectable()
export class GeoRegistrationService {
  private readonly logger = new Logger(GeoRegistrationService.name);

  constructor(private readonly db: TenantPrismaService) {}

  // ==========================================
  // VERIFICAR SE COORDENADA ESTÁ NO RAIO
  // Chamado ANTES de criar o usuário
  // ==========================================
  async verificarLocalizacao(
    schemaName:    string,
    userLat:       number,
    userLng:       number,
  ): Promise<GeoRegistrationResult> {
    const publicClient = this.db.getPublicClient();

    const [tenant] = await publicClient.$queryRaw<any[]>`
      SELECT center_lat, center_lng, geo_radius_km, name
      FROM tenants
      WHERE schema_name = ${schemaName}
      LIMIT 1
    `;

    if (!tenant?.center_lat || !tenant?.center_lng) {
      // Município sem coordenadas configuradas — permitir sem restrição
      return { permitido: true, distanciaKm: 0, raioKm: 0, status: 'approved' };
    }

    const distKm = this.haversineKm(
      userLat, userLng,
      parseFloat(tenant.center_lat),
      parseFloat(tenant.center_lng),
    );

    const raioKm = tenant.geo_radius_km ?? 30;

    this.logger.log(
      `Registro: distância ${distKm.toFixed(1)}km do centro de ${tenant.name} (raio: ${raioKm}km)`,
    );

    if (distKm > raioKm) {
      return {
        permitido:   false,
        distanciaKm: distKm,
        raioKm,
        status:      'blocked',
        mensagem: `Este app é exclusivo para moradores de ${tenant.name}. Você está a ${Math.round(distKm)}km do município.`,
      };
    }

    return { permitido: true, distanciaKm: distKm, raioKm, status: 'approved' };
  }

  // ==========================================
  // SALVAR LOCALIZAÇÃO DO REGISTRO
  // ==========================================
  async salvarLocalizacaoRegistro(
    schemaName: string,
    userId:     string,
    lat:        number,
    lng:        number,
    status:     'approved' | 'pending',
  ): Promise<void> {
    const prisma = await this.db.forTenant(schemaName);
    await prisma.$executeRaw`
      UPDATE users
      SET registration_lat    = ${lat},
          registration_lng    = ${lng},
          registration_status = ${status},
          updated_at          = NOW()
      WHERE id = ${userId}
    `;
  }

  // ==========================================
  // LISTAR CIDADÃOS PENDENTES DE APROVAÇÃO
  // ==========================================
  async listarPendentes(schemaName: string): Promise<any[]> {
    const prisma = await this.db.forTenant(schemaName);
    return prisma.$queryRaw`
      SELECT
        id, name, email, phone,
        registration_status AS status,
        registration_lat    AS lat,
        registration_lng    AS lng,
        created_at
      FROM users
      WHERE role = 'citizen'
        AND registration_status = 'pending'
      ORDER BY created_at DESC
    `;
  }

  // ==========================================
  // APROVAR CIDADÃO
  // ==========================================
  async aprovar(schemaName: string, userId: string): Promise<void> {
    const prisma = await this.db.forTenant(schemaName);
    await prisma.$executeRaw`
      UPDATE users
      SET registration_status = 'approved',
          is_active           = true,
          updated_at          = NOW()
      WHERE id = ${userId} AND role = 'citizen'
    `;
    this.logger.log(`Cidadão ${userId} aprovado em ${schemaName}`);
  }

  // ==========================================
  // REJEITAR / IGNORAR CIDADÃO
  // ==========================================
  async rejeitar(
    schemaName: string,
    userId:     string,
    motivo?:    string,
  ): Promise<void> {
    const prisma = await this.db.forTenant(schemaName);
    await prisma.$executeRaw`
      UPDATE users
      SET registration_status = 'rejected',
          rejection_reason    = ${motivo ?? 'Fora da área de cobertura'},
          is_active           = false,
          updated_at          = NOW()
      WHERE id = ${userId} AND role = 'citizen'
    `;
    this.logger.log(`Cidadão ${userId} rejeitado em ${schemaName}`);
  }

  // ==========================================
  // FÓRMULA DE HAVERSINE (distância em km)
  // ==========================================
  private haversineKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
  ): number {
    const R    = 6371; // raio da Terra em km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number) { return (deg * Math.PI) / 180; }
}
