// apps/api/src/shared/database/tenant-prisma.service.ts
// Gerencia conexões com schema switching por tenant

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TenantPrismaService implements OnModuleDestroy {
  // Pool de clientes por schema (evita criar conexão a cada request)
  private readonly clients = new Map<string, PrismaClient>();

  constructor(private readonly config: ConfigService) {}

  /**
   * Retorna um PrismaClient com search_path configurado para o tenant.
   * Reutiliza conexões existentes do pool.
   */
  async forTenant(schemaName: string): Promise<PrismaClient> {
    if (this.clients.has(schemaName)) {
      return this.clients.get(schemaName)!;
    }

    const client = new PrismaClient({
      datasources: {
        db: { url: this.config.get<string>('DATABASE_URL') },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    });

    // Middleware que seta search_path antes de cada query
    client.$use(async (params, next) => {
      await client.$executeRawUnsafe(
        `SET search_path = "${schemaName}", public`
      );
      return next(params);
    });

    await client.$connect();
    this.clients.set(schemaName, client);

    return client;
  }

  /**
   * Cliente para o schema público (tenants, super_admin)
   */
  getPublicClient(): PrismaClient {
    const key = 'public';
    if (!this.clients.has(key)) {
      const client = new PrismaClient({
        datasources: {
          db: { url: this.config.get<string>('DATABASE_URL') },
        },
      });
      this.clients.set(key, client);
    }
    return this.clients.get(key)!;
  }

  async onModuleDestroy() {
    const disconnects = Array.from(this.clients.values()).map(c => c.$disconnect());
    await Promise.all(disconnects);
  }
}
