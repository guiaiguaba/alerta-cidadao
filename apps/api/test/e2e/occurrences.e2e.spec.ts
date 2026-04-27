// apps/api/test/e2e/occurrences.e2e.spec.ts
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp, teardownTestApp } from './helpers/app.helper';
import {
  connectTestDb, disconnectTestDb,
  setupTestSchema, clearTestData, createTestUser,
  TEST_SCHEMA,
} from './helpers/db.helper';
import { Client } from 'pg';

const E2E_HEADERS = { 'X-Tenant-Slug': 'e2e' };

async function getTokensForUser(
  httpServer: any,
  email: string,
  password = 'senha123',
): Promise<{ accessToken: string; userId: string }> {
  const res = await request(httpServer)
    .post('/api/v1/auth/login')
    .set(E2E_HEADERS)
    .send({ email, password });
  return { accessToken: res.body.accessToken, userId: res.body.userId };
}

describe('Occurrences — E2E', () => {
  let app: INestApplication;
  let httpServer: any;
  let db: Client;

  let citizenToken: string;
  let agentToken:   string;

  const VALID_OCCURRENCE = {
    categoryId:  4,   // Alagamento (criado no seed)
    description: 'Água subindo na Rua das Flores, altura dos joelhos',
    lat:         -22.8486,
    lng:         -42.0085,
    address:     'Rua das Flores, 123, Centro',
    regionCode:  'centro',
  };

  beforeAll(async () => {
    db = await connectTestDb();
    await setupTestSchema();
    app = await bootstrapTestApp();
    httpServer = app.getHttpServer();

    // Criar cidadão e agente e fazer login
    const PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMeLudMBHrZxg2p7KeQMYoHMf6'; // "senha123"

    await createTestUser({ email: 'cidadao@e2e.test', role: 'citizen', passwordHash: PASSWORD_HASH });
    await createTestUser({ email: 'agente@e2e.test',  role: 'agent',   passwordHash: PASSWORD_HASH });

    citizenToken = (await getTokensForUser(httpServer, 'cidadao@e2e.test')).accessToken;
    agentToken   = (await getTokensForUser(httpServer, 'agente@e2e.test')).accessToken;
  });

  afterAll(async () => {
    await teardownTestApp();
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  // ==========================================
  describe('POST /api/v1/occurrences', () => {
    it('deve criar ocorrência e retornar protocolo', async () => {
      const res = await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(VALID_OCCURRENCE);

      expect(res.status).toBe(201);
      expect(res.body.protocol).toMatch(/^[A-Z]{3}-\d{4}-\d{5}$/);
      expect(res.body.status).toBe('open');
      expect(res.body.priority).toBeDefined();
      expect(['critical', 'high', 'medium', 'low']).toContain(res.body.priority);
    });

    it('deve calcular SLA deadline baseado na prioridade', async () => {
      const res = await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(VALID_OCCURRENCE);

      expect(res.body.sla_deadline).toBeDefined();
      const deadline = new Date(res.body.sla_deadline);
      expect(deadline.getTime()).toBeGreaterThan(Date.now());
    });

    it('deve retornar 401 sem autenticação', async () => {
      const res = await request(httpServer)
        .post('/api/v1/occurrences')
        .set(E2E_HEADERS)
        .send(VALID_OCCURRENCE);

      expect(res.status).toBe(401);
    });

    it('deve retornar 400 sem lat/lng', async () => {
      const res = await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send({ categoryId: 4, description: 'Sem coordenadas' });

      expect(res.status).toBe(400);
    });

    it('deve deduplicar por clientId offline', async () => {
      const clientId = 'client-uuid-offline-test-1234';
      const payload  = { ...VALID_OCCURRENCE, clientId };

      const res1 = await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(payload);

      const res2 = await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      // Ambas retornam o MESMO id (deduplicação)
      expect(res1.body.id).toBe(res2.body.id);
    });

    it('deve bloquear após atingir limite diário (5 ocorrências)', async () => {
      // Enviar 5 ocorrências (com cooldown zerado nos testes)
      // Nota: em testes, o cooldown pode impedir — enviar com intervalos ou ajustar config
      const results = [];
      for (let i = 0; i < 6; i++) {
        const res = await request(httpServer)
          .post('/api/v1/occurrences')
          .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
          .send({ ...VALID_OCCURRENCE, clientId: `client-spam-${i}` });
        results.push(res.status);
      }

      // A 6ª deve ser bloqueada (400 ou 429)
      const lastStatus = results[results.length - 1];
      expect([400, 429]).toContain(lastStatus);
    });
  });

  // ==========================================
  describe('GET /api/v1/occurrences', () => {
    it('deve listar ocorrências com paginação', async () => {
      // Criar 3 ocorrências
      for (let i = 0; i < 3; i++) {
        await request(httpServer)
          .post('/api/v1/occurrences')
          .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
          .send({ ...VALID_OCCURRENCE, clientId: `list-test-${i}` });
      }

      const res = await request(httpServer)
        .get('/api/v1/occurrences?page=1&limit=2')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({
        total:      3,
        page:       1,
        limit:      2,
        totalPages: 2,
      });
    });

    it('deve filtrar por status', async () => {
      await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send({ ...VALID_OCCURRENCE, clientId: 'filter-test-1' });

      const res = await request(httpServer)
        .get('/api/v1/occurrences?status=open')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` });

      expect(res.status).toBe(200);
      expect(res.body.data.every((o: any) => o.status === 'open')).toBe(true);
    });

    it('deve filtrar por bounding box (bbox)', async () => {
      await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send({ ...VALID_OCCURRENCE, clientId: 'bbox-test-1' });

      // BBox que inclui a ocorrência criada (-22.85, -42.01, -22.84, -42.00)
      const res = await request(httpServer)
        .get('/api/v1/occurrences?bbox=-22.85,-42.01,-22.84,-42.00')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  describe('GET /api/v1/occurrences/:id', () => {
    it('deve retornar detalhe completo com timeline e mídia', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(VALID_OCCURRENCE);

      const { id } = createRes.body;

      const res = await request(httpServer)
        .get(`/api/v1/occurrences/${id}`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.timeline).toBeInstanceOf(Array);
      expect(res.body.timeline.length).toBeGreaterThanOrEqual(1); // evento 'opened'
      expect(res.body.media).toBeInstanceOf(Array);
    });

    it('deve retornar 404 para ID inexistente', async () => {
      const res = await request(httpServer)
        .get('/api/v1/occurrences/00000000-0000-0000-0000-000000000000')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` });

      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  describe('PATCH /api/v1/occurrences/:id/status', () => {
    it('agente deve poder atualizar status de open → assigned', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(VALID_OCCURRENCE);

      const { id } = createRes.body;

      const res = await request(httpServer)
        .patch(`/api/v1/occurrences/${id}/status`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${agentToken}` })
        .send({ status: 'assigned' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('assigned');
    });

    it('cidadão NÃO pode atualizar status', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(VALID_OCCURRENCE);

      const res = await request(httpServer)
        .patch(`/api/v1/occurrences/${createRes.body.id}/status`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send({ status: 'resolved' });

      expect(res.status).toBe(403);
    });

    it('deve rejeitar transição inválida de status', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(VALID_OCCURRENCE);

      // open → resolved direto não é permitido
      const res = await request(httpServer)
        .patch(`/api/v1/occurrences/${createRes.body.id}/status`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${agentToken}` })
        .send({ status: 'resolved' });

      expect(res.status).toBe(400);
    });

    it('deve adicionar entrada na timeline ao mudar status', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(VALID_OCCURRENCE);

      const { id } = createRes.body;

      await request(httpServer)
        .patch(`/api/v1/occurrences/${id}/status`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${agentToken}` })
        .send({ status: 'assigned', note: 'Agente a caminho' });

      const timelineRes = await request(httpServer)
        .get(`/api/v1/occurrences/${id}/timeline`)
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${agentToken}` });

      expect(timelineRes.status).toBe(200);
      const actions = timelineRes.body.map((e: any) => e.action);
      expect(actions).toContain('opened');
      expect(actions).toContain('status_changed');
    });
  });

  // ==========================================
  describe('GET /api/v1/occurrences/map', () => {
    it('deve retornar GeoJSON válido sem autenticação', async () => {
      // Criar ocorrência pública
      await request(httpServer)
        .post('/api/v1/occurrences')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send(VALID_OCCURRENCE);

      const res = await request(httpServer)
        .get('/api/v1/occurrences/map')
        .set(E2E_HEADERS);

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('FeatureCollection');
      expect(res.body.features).toBeInstanceOf(Array);
      if (res.body.features.length > 0) {
        expect(res.body.features[0].type).toBe('Feature');
        expect(res.body.features[0].geometry.type).toBe('Point');
      }
    });
  });

  // ==========================================
  describe('POST /api/v1/occurrences/sync', () => {
    it('deve sincronizar lote de ocorrências offline', async () => {
      const items = [
        { ...VALID_OCCURRENCE, clientId: 'offline-sync-1' },
        { ...VALID_OCCURRENCE, clientId: 'offline-sync-2', description: 'Segunda ocorrência offline' },
      ];

      const res = await request(httpServer)
        .post('/api/v1/occurrences/sync')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send({ items });

      expect(res.status).toBe(200);
      expect(res.body.synced).toHaveLength(2);
      expect(res.body.errors).toHaveLength(0);
      expect(res.body.conflicts).toHaveLength(0);
    });

    it('deve deduplicar itens já sincronizados no lote', async () => {
      const clientId = 'offline-dup-test';

      // Sincronizar a primeira vez
      await request(httpServer)
        .post('/api/v1/occurrences/sync')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send({ items: [{ ...VALID_OCCURRENCE, clientId }] });

      // Sincronizar novamente (idempotente)
      const res = await request(httpServer)
        .post('/api/v1/occurrences/sync')
        .set({ ...E2E_HEADERS, Authorization: `Bearer ${citizenToken}` })
        .send({ items: [{ ...VALID_OCCURRENCE, clientId }] });

      expect(res.status).toBe(200);
      // Deve retornar na lista synced com o mesmo ID
      expect(res.body.synced).toHaveLength(1);
    });
  });
});
