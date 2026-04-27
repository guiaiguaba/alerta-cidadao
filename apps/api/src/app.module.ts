// apps/api/src/app.module.ts
import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MulterModule } from '@nestjs/platform-express';
import { APP_GUARD } from '@nestjs/core';
import { RedisModule } from '@nestjs-modules/ioredis';
import * as multer from 'multer';

import { TenantPrismaService } from './shared/database/tenant-prisma.service';
import { TenantMiddleware } from './modules/tenants/tenant.middleware';
import { OccurrencesGateway } from './gateways/occurrences.gateway';

import { AuthService } from './modules/auth/auth.service';
import { OtpService } from './modules/auth/otp.service';
import { JwtStrategy } from './modules/auth/jwt.strategy';
import { AuthController } from './modules/auth/auth.controller';

import { OccurrencesService } from './modules/occurrences/occurrences.service';
import { OccurrencesController } from './modules/occurrences/occurrences.controller';

import { AlertsService } from './modules/alerts/alerts.service';
import { AlertsController } from './modules/alerts/alerts.controller';

import { NotificationsService } from './modules/notifications/notifications.service';
import { FilesService } from './modules/files/files.service';

import { AnalyticsService } from './modules/analytics/analytics.service';
import { AnalyticsController } from './modules/analytics/analytics.controller';

import { SlaCronService } from './modules/sla/sla-cron.service';

import { TenantProvisioningService } from './modules/tenants/tenant-provisioning.service';
import { TenantsController, AdminController } from './modules/tenants/tenants.controller';

import { UsersController } from './modules/users/users.controller';
import { TeamsController } from './modules/teams/teams.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      global: true,
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRY', '15m') },
      }),
      inject: [ConfigService],
    }),

    RedisModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        retryAttempts: 5,
        retryDelay: 1000,
      }),
      inject: [ConfigService],
    }),

    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 60000, limit: 10 },
    ]),

    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024, files: 5 },
    }),
  ],

  controllers: [
    AuthController,
    OccurrencesController,
    AlertsController,
    AnalyticsController,
    UsersController,
    TeamsController,
    TenantsController,
    AdminController,
  ],

  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Shared
    TenantPrismaService,
    NotificationsService,
    FilesService,

    // Auth
    AuthService,
    OtpService,
    JwtStrategy,

    // Features
    OccurrencesService,
    AlertsService,
    AnalyticsService,
    SlaCronService,
    TenantProvisioningService,

    // Gateway
    OccurrencesGateway,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'internal/(.*)', method: RequestMethod.ALL },
        { path: 'docs', method: RequestMethod.GET },
        { path: 'docs/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
