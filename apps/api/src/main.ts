// apps/api/src/main.ts
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { AuditLogInterceptor } from './shared/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const logger = new Logger('Bootstrap');

  // Prefixo global da API
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'internal/(.*)'],
  });

  // CORS
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? /\.alertacidadao\.com$/
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
  });

  // Validação global (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,               // Remove campos não declarados
      forbidNonWhitelisted: false,   // Não rejeitar (apenas ignorar) campos extras
      transform: true,               // Converte tipos automaticamente (string → number)
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Guards globais
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));

  // Filtro de exceções global
  app.useGlobalFilters(new HttpExceptionFilter());

  // Interceptor de audit (apenas se não for teste)
  if (process.env.NODE_ENV !== 'test') {
    // app.useGlobalInterceptors(new AuditLogInterceptor(app.get(TenantPrismaService)));
    // Nota: injeção de dependência em guards/interceptors globais requer useContainer
    // Ver NestJS docs: https://docs.nestjs.com/faq/global-prefix#middleware
  }

  // Swagger (desabilitado em produção)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('🚨 Alerta Cidadão API')
      .setDescription('Plataforma SaaS de Defesa Civil — Documentação da API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey(
        { type: 'apiKey', name: 'X-Tenant-Slug', in: 'header' },
        'tenant-slug',
      )
      .addTag('Auth', 'Autenticação e autorização')
      .addTag('Occurrences', 'Registro e gestão de ocorrências')
      .addTag('Alerts', 'Alertas massivos para a população')
      .addTag('Analytics', 'Dashboards e relatórios')
      .addTag('Users', 'Gestão de usuários')
      .addTag('Teams', 'Gestão de equipes')
      .addTag('Admin', 'Configurações administrativas')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log('📚 Swagger disponível em: http://localhost:3000/docs');
  }

  // Health check endpoint
  const appRef = app.getHttpAdapter();
  appRef.get('/health', (req: any, res: any) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚨 Alerta Cidadão API rodando na porta ${port}`);
  logger.log(`🌎 Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
