// apps/api/test/e2e/alerts.e2e.spec.ts
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp, teardownTestApp } from './helpers/app.helper';
import {
  connectTestDb, disconnectTestDb,
  setupTestSchema, clearTestData, createTestUser,
} from './helpers/db.helper';

const E2E_HEADERS = { 'X-Tenant-Slug': 'e2e' };
const HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMeLudMBHrZxg2p7KeQMYoHMf6'; // "senha123"

describe('Alerts — E2E', () => {
  let app: INestApplication;
  let httpServer: any;
  let adminToken: string;
  let citizenToken: string;

  const VALID_ALERT = {
    title:       '⚠️ Alerta de Alagamento',
    message:     'Nível da Lagoa de Araruama em elevação. Evite a Rua da Praia e adjacências.',
    alertType:   'flood_warning',
    severity:    'high',
    targetScope: 'all',
  };

  beforeAll(async () => {
    await connectTestDb();
    await setupTestSchema();
    app = await bootstrapTestApp();
    httpServer = app.getHttpServer();

    await createTestUser({ email: 'admin@e2e.test',   role: 'admin',   passwordHash: HASH });
    await createTestUser({ email: 'cidadao2@e2e.test', role: 'citizen', passwordHash: HASH });

    const adminRes = await request(httpServer)
      .post('/api/v1/auth/login').set(E2E_HEADERS)
      .send({ email: 'admin@e2e.test', password: 'senha123' });
    adminToken = adminRes.body.accessToken;

    const citizenRes = await request(httpServer)
      .post('/api/v1/auth/login').set(E2E_HEADERS)
      .send({ email: 'cidadao2@e2e.test', password: 'senha123' });
    citizenToken = citizenRes.body.accessToken;
  });

  afterAll(async () => {
    await teardownTestApp();
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  // ==========================================
  describe('POST /api/v1/alerts', () => {
    it('admin deve criar alerta como rascunho', async () => {
      const res = await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` })
        .send(VALID_ALERT);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('draft');
      expect(res.body.title).toBe(VALID_ALERT.title);
      expect(res.body.recipients_count).toBe(0); // ainda não enviado
    });

    it('cidadão NÃO pode criar alerta', async () => {
      const res = await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(VALID_ALERT);

      expect(res.status).toBe(403);
    });

    it('deve validar scope=regions exige targetRegions', async () => {
      const res = await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` })
        .send({ ...VALID_ALERT, targetScope: 'regions', targetRegions: [] });

      expect(res.status).toBe(400);
    });

    it('deve validar scope=radius exige coordenadas e raio', async () => {
      const res = await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` })
        .send({ ...VALID_ALERT, targetScope: 'radius' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  describe('POST /api/v1/alerts/:id/send', () => {
    it('deve disparar alerta e mudar status para sent', async () => {
      // Criar rascunho
      const createRes = await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` })
        .send(VALID_ALERT);

      const alertId = createRes.body.id;

      // Enviar
      const sendRes = await request(httpServer)
        .post(`/api/v1/alerts/${alertId}/send`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.status).toBe('sent');
      expect(sendRes.body.sent_at).toBeDefined();
    });

    it('deve retornar 400 ao tentar enviar alerta já enviado', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` })
        .send(VALID_ALERT);

      const alertId = createRes.body.id;

      await request(httpServer)
        .post(`/api/v1/alerts/${alertId}/send`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      const res = await request(httpServer)
        .post(`/api/v1/alerts/${alertId}/send`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  describe('GET /api/v1/alerts', () => {
    it('cidadão deve ver apenas alertas enviados e não expirados', async () => {
      // Criar e enviar alerta
      const createRes = await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` })
        .send(VALID_ALERT);

      await request(httpServer)
        .post(`/api/v1/alerts/${createRes.body.id}/send`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      // Criar rascunho (NÃO deve aparecer para cidadão)
      await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` })
        .send({ ...VALID_ALERT, title: 'Rascunho' });

      const res = await request(httpServer)
        .get('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` });

      expect(res.status).toBe(200);
      expect(res.body.data.every((a: any) => a.status === 'sent')).toBe(true);
    });

    it('admin deve ver todos os alertas incluindo rascunhos', async () => {
      await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` })
        .send(VALID_ALERT);

      const res = await request(httpServer)
        .get('/api/v1/alerts/admin')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  describe('PATCH /api/v1/alerts/:id/cancel', () => {
    it('deve cancelar alerta em rascunho', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` })
        .send(VALID_ALERT);

      const res = await request(httpServer)
        .patch(`/api/v1/alerts/${createRes.body.id}/cancel`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });
  });

  // ==========================================
  describe('POST /api/v1/alerts/:id/read', () => {
    it('cidadão deve marcar alerta como lido', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/alerts')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` })
        .send(VALID_ALERT);

      const alertId = createRes.body.id;

      await request(httpServer)
        .post(`/api/v1/alerts/${alertId}/send`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      const res = await request(httpServer)
        .post(`/api/v1/alerts/${alertId}/read`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` });

      expect(res.status).toBe(200);
      expect(res.body.marked).toBe(true);
    });
  });
});

// ==========================================
// ANALYTICS E2E
// ==========================================
describe('Analytics — E2E', () => {
  let app: INestApplication;
  let httpServer: any;
  let adminToken: string;
  let citizenToken: string;

  beforeAll(async () => {
    await connectTestDb();
    await setupTestSchema();
    app = await bootstrapTestApp();
    httpServer = app.getHttpServer();

    await createTestUser({ email: 'analytic-admin@e2e.test', role: 'admin',   passwordHash: HASH });
    await createTestUser({ email: 'analytic-cit@e2e.test',   role: 'citizen', passwordHash: HASH });

    const a = await request(httpServer).post('/api/v1/auth/login').set(E2E_HEADERS)
      .send({ email: 'analytic-admin@e2e.test', password: 'senha123' });
    adminToken = a.body.accessToken;

    const c = await request(httpServer).post('/api/v1/auth/login').set(E2E_HEADERS)
      .send({ email: 'analytic-cit@e2e.test', password: 'senha123' });
    citizenToken = c.body.accessToken;
  });

  afterAll(async () => {
    await teardownTestApp();
    await disconnectTestDb();
  });

  describe('GET /api/v1/analytics/dashboard', () => {
    it('admin deve receber dashboard com todas as seções', async () => {
      const res = await request(httpServer)
        .get('/api/v1/analytics/dashboard')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        overview:     expect.any(Object),
        byStatus:     expect.any(Array),
        byPriority:   expect.any(Array),
        sla:          expect.any(Object),
        today:        expect.any(Object),
        topAgents:    expect.any(Array),
        generatedAt:  expect.any(String),
      });
    });

    it('cidadão NÃO pode acessar analytics', async () => {
      const res = await request(httpServer)
        .get('/api/v1/analytics/dashboard')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/analytics/heatmap', () => {
    it('deve retornar GeoJSON FeatureCollection', async () => {
      const res = await request(httpServer)
        .get('/api/v1/analytics/heatmap?days=30')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(res.body.features).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/analytics/export', () => {
    it('deve exportar CSV com BOM UTF-8', async () => {
      const res = await request(httpServer)
        .get('/api/v1/analytics/export?format=csv&type=sla&from=2026-01-01&to=2026-12-31')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      // BOM UTF-8 no início do CSV (para Excel)
      expect(res.text.charCodeAt(0)).toBe(0xFEFF);
    });

    it('deve exportar JSON quando format=json', async () => {
      const res = await request(httpServer)
        .get('/api/v1/analytics/export?format=json&type=agents')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${adminToken}` });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('exportedAt');
    });
  });
});
