// apps/api/test/e2e/helpers/app.helper.ts
// Bootstrap da aplicação NestJS para testes E2E

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/shared/filters/http-exception.filter';
import * as request from 'supertest';

let app: INestApplication;
let moduleRef: TestingModule;

export async function bootstrapTestApp(): Promise<INestApplication> {
  moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return app;
}

export async function teardownTestApp(): Promise<void> {
  await app?.close();
}

export function getTestApp(): INestApplication {
  return app;
}

// ==========================================
// Helpers de requisição
// ==========================================

export function req(path: string) {
  return request(app.getHttpServer()).get(`/api/v1${path}`);
}

export function post(path: string, body?: any) {
  return request(app.getHttpServer()).post(`/api/v1${path}`).send(body);
}

export function patch(path: string, body?: any) {
  return request(app.getHttpServer()).patch(`/api/v1${path}`).send(body);
}

// Header de tenant para desenvolvimento
export const DEMO_TENANT_HEADERS = {
  'X-Tenant-Slug': 'demo',
  'Content-Type': 'application/json',
};

export function withTenant(r: request.Test, token?: string): request.Test {
  r = r.set('X-Tenant-Slug', 'demo');
  if (token) r = r.set('Authorization', `Bearer ${token}`);
  return r;
}
