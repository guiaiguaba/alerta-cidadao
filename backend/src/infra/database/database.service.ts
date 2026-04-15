import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Knex, { Knex as KnexType } from 'knex';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  public knex: KnexType;

  onModuleInit() {
    this.knex = Knex({
      client: 'pg',
      connection: {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'alertacidadao',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASS,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      },
      pool: { min: 2, max: 10 },
      acquireConnectionTimeout: 10000,
    });

    this.logger.log('Database connection pool initialised');
  }

  async onModuleDestroy() {
    await this.knex.destroy();
  }
}
