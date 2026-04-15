import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './infra/database/database.module';
import { FirebaseModule } from './infra/firebase/firebase.module';
import { CacheModule } from './infra/cache/cache.module';
import { StorageModule } from './infra/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { OcorrenciasModule } from './modules/ocorrencias/ocorrencias.module';
import { NotificacoesModule } from './modules/notificacoes/notificacoes.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    DatabaseModule,
    FirebaseModule,
    CacheModule,
    StorageModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    OcorrenciasModule,
    NotificacoesModule,
    WebsocketModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
