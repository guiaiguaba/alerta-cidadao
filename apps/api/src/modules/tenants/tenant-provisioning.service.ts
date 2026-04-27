// apps/api/src/modules/tenants/tenant-provisioning.service.ts
// Provisiona schema completo para nova prefeitura (onboarding)

import {
  Injectable,
  Logger,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ProvisionTenantDto {
  slug: string;
  name: string;
  displayName: string;
  subdomain: string;
  stateCode: string;
  cityIbgeCode?: string;
  centerLat?: number;
  centerLng?: number;
  adminEmail: string;
  adminName: string;
  adminPassword?: string; // se omitido, gera senha aleatória
  primaryColor?: string;
  secondaryColor?: string;
}

@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(
    private readonly db: TenantPrismaService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async provision(dto: ProvisionTenantDto): Promise<{
    tenantId: string;
    schemaName: string;
    adminCredentials: { email: string; tempPassword: string };
  }> {
    const schemaName = `tenant_${dto.slug.replace(/-/g, '_')}`;
    const publicClient = this.db.getPublicClient();

    // 1. Verificar se tenant já existe
    const [existing] = await publicClient.$queryRaw<any[]>`
      SELECT id FROM tenants WHERE slug = ${dto.slug} OR subdomain = ${dto.subdomain} LIMIT 1
    `;
    if (existing) {
      throw new ConflictException(
        `Tenant com slug "${dto.slug}" ou subdomínio "${dto.subdomain}" já existe`,
      );
    }

    this.logger.log(`Iniciando provisionamento do tenant: ${dto.slug}`);

    // 2. Registrar tenant no schema público
    const tenantId = uuidv4();
    await publicClient.$executeRaw`
      INSERT INTO tenants (
        id, slug, name, display_name, subdomain,
        state_code, city_ibge_code,
        center_lat, center_lng,
        primary_color, secondary_color,
        schema_name, is_active
      ) VALUES (
        ${tenantId},
        ${dto.slug},
        ${dto.name},
        ${dto.displayName},
        ${dto.subdomain},
        ${dto.stateCode},
        ${dto.cityIbgeCode ?? null},
        ${dto.centerLat ?? null},
        ${dto.centerLng ?? null},
        ${dto.primaryColor ?? '#1565C0'},
        ${dto.secondaryColor ?? '#FF6F00'},
        ${schemaName},
        true
      )
    `;

    try {
      // 3. Criar schema PostgreSQL
      await this.createSchema(schemaName);

      // 4. Executar migration SQL no novo schema
      await this.runMigrations(schemaName);

      // 5. Criar configurações padrão
      await this.seedTenantSettings(schemaName);

      // 6. Criar regiões padrão
      await this.seedDefaultRegions(schemaName);

      // 7. Criar usuário administrador
      const tempPassword = dto.adminPassword ?? this.generatePassword();
      const adminId = await this.createAdminUser(
        schemaName,
        dto.adminEmail,
        dto.adminName,
        tempPassword,
      );

      this.logger.log(`✅ Tenant ${dto.slug} provisionado com sucesso. Admin: ${adminId}`);

      // 8. Invalidar cache de tenants
      await this.redis.del(`tenant:${dto.subdomain}`);

      return {
        tenantId,
        schemaName,
        adminCredentials: {
          email: dto.adminEmail,
          tempPassword,
        },
      };
    } catch (err) {
      // Rollback: remover tenant do schema público se algo falhar
      this.logger.error(`Falha ao provisionar ${dto.slug}: ${err.message}`);
      await publicClient.$executeRaw`DELETE FROM tenants WHERE id = ${tenantId}`;

      // Tentar dropar schema criado
      try {
        const rawPrisma = await this.db.forTenant(schemaName);
        await rawPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } catch { /* ignorar */ }

      throw new InternalServerErrorException(
        `Falha ao provisionar prefeitura: ${err.message}`,
      );
    }
  }

  async deprovision(tenantId: string): Promise<void> {
    const publicClient = this.db.getPublicClient();

    const [tenant] = await publicClient.$queryRaw<any[]>`
      SELECT schema_name, subdomain FROM tenants WHERE id = ${tenantId} LIMIT 1
    `;

    if (!tenant) return;

    this.logger.warn(`⚠️ Desprovisionando tenant ${tenantId} (${tenant.schema_name})`);

    // Desativar primeiro (não deletar imediatamente — dar período de carência)
    await publicClient.$executeRaw`
      UPDATE tenants SET is_active = false, updated_at = NOW()
      WHERE id = ${tenantId}
    `;

    // Invalidar cache
    await this.redis.del(`tenant:${tenant.subdomain}`);
  }

  async dropSchema(tenantId: string): Promise<void> {
    // CUIDADO: operação irreversível — apenas super_admin pode chamar
    const publicClient = this.db.getPublicClient();

    const [tenant] = await publicClient.$queryRaw<any[]>`
      SELECT schema_name FROM tenants WHERE id = ${tenantId} AND is_active = false LIMIT 1
    `;

    if (!tenant) {
      throw new ConflictException('Tenant não encontrado ou ainda ativo');
    }

    const prisma = await this.db.forTenant(tenant.schema_name);
    await prisma.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${tenant.schema_name}" CASCADE`,
    );

    await publicClient.$executeRaw`
      DELETE FROM tenants WHERE id = ${tenantId}
    `;

    this.logger.log(`Schema ${tenant.schema_name} removido`);
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private async createSchema(schemaName: string): Promise<void> {
    // Conectar ao banco usando o public client para criar o schema
    const publicClient = this.db.getPublicClient();
    await publicClient.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
    );
    this.logger.log(`Schema "${schemaName}" criado`);
  }

  private async runMigrations(schemaName: string): Promise<void> {
    const migrationPath = path.resolve(
      __dirname,
      '../../..',
      'prisma/migrations/001_tenant_schema.sql',
    );

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration SQL não encontrada: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Executar com search_path do schema correto
    const prisma = await this.db.forTenant(schemaName);
    await prisma.$executeRawUnsafe(`SET search_path = "${schemaName}", public`);

    // Executar cada statement separadamente (split por ';' com cuidado)
    const statements = sql
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err) {
        // Ignorar erros de IF NOT EXISTS, ON CONFLICT, etc.
        if (!err.message?.includes('already exists') &&
            !err.message?.includes('duplicate key')) {
          this.logger.warn(`Migration stmt warning: ${err.message}`);
        }
      }
    }

    this.logger.log(`Migrations executadas para ${schemaName}`);
  }

  private async seedTenantSettings(schemaName: string): Promise<void> {
    const prisma = await this.db.forTenant(schemaName);

    // Nota: tenant_settings fica no schema público, não no schema do tenant
    const publicClient = this.db.getPublicClient();
    const [tenant] = await publicClient.$queryRaw<any[]>`
      SELECT id FROM tenants WHERE schema_name = ${schemaName} LIMIT 1
    `;

    if (tenant) {
      await publicClient.$executeRaw`
        INSERT INTO tenant_settings (tenant_id)
        VALUES (${tenant.id})
        ON CONFLICT DO NOTHING
      `.catch(() => {});
    }
  }

  private async seedDefaultRegions(schemaName: string): Promise<void> {
    const prisma = await this.db.forTenant(schemaName);

    // Regiões genéricas padrão — admin pode personalizar depois
    const regions = [
      { code: 'centro', name: 'Centro' },
      { code: 'norte', name: 'Zona Norte' },
      { code: 'sul', name: 'Zona Sul' },
      { code: 'leste', name: 'Zona Leste' },
      { code: 'oeste', name: 'Zona Oeste' },
    ];

    for (const r of regions) {
      await prisma.$executeRaw`
        INSERT INTO regions (code, name)
        VALUES (${r.code}, ${r.name})
        ON CONFLICT DO NOTHING
      `;
    }

    this.logger.log(`Regiões padrão criadas para ${schemaName}`);
  }

  private async createAdminUser(
    schemaName: string,
    email: string,
    name: string,
    password: string,
  ): Promise<string> {
    const prisma = await this.db.forTenant(schemaName);
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await prisma.$executeRaw`
      INSERT INTO users (id, name, email, password_hash, role, email_verified)
      VALUES (${userId}, ${name}, ${email}, ${passwordHash}, 'admin', true)
    `;

    return userId;
  }

  private generatePassword(length = 16): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
  }
}
