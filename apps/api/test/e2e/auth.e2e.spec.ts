// apps/api/test/e2e/auth.e2e.spec.ts
// Testes de integração para o fluxo completo de autenticação
// Requer: PostgreSQL + Redis rodando (ver docker-compose.yml)

import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { bootstrapTestApp, teardownTestApp } from './helpers/app.helper';
import { connectTestDb, disconnectTestDb, setupTestSchema, clearTestData, createTestUser } from './helpers/db.helper';

/**
 * Estes testes requerem o banco e Redis reais.
 * Para rodar apenas unitários: npm run test
 * Para E2E: npm run test:e2e
 */
describe('Auth — E2E', () => {
  let app: INestApplication;
  let httpServer: any;

  // Headers que simulam o tenant "e2e" via subdomínio
  const headers = { 'X-Tenant-Slug': 'e2e' };

  beforeAll(async () => {
    await connectTestDb();
    await setupTestSchema();
    app = await bootstrapTestApp();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await teardownTestApp();
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  // ==========================================
  describe('POST /api/v1/auth/register', () => {
    it('deve registrar novo cidadão e retornar tokens JWT', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/register')
        .set(headers)
        .send({
          name:     'João da Silva',
          email:    'joao@e2e.test',
          password: 'senha_segura_123',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        accessToken:  expect.any(String),
        refreshToken: expect.any(String),
        expiresIn:    900,
      });
      // Token deve ser um JWT válido (3 partes separadas por ponto)
      expect(res.body.accessToken.split('.')).toHaveLength(3);
    });

    it('deve retornar 409 para e-mail duplicado', async () => {
      const payload = { name: 'Maria', email: 'maria@e2e.test', password: 'senha123' };

      await request(httpServer).post('/api/v1/auth/register').set(headers).send(payload);
      const res = await request(httpServer).post('/api/v1/auth/register').set(headers).send(payload);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
    });

    it('deve retornar 400 sem nome', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/register')
        .set(headers)
        .send({ email: 'sem@nome.test', password: 'senha123' });

      expect(res.status).toBe(400);
    });

    it('deve retornar 400 com e-mail inválido', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/register')
        .set(headers)
        .send({ name: 'Alguém', email: 'nao-e-email', password: 'senha123' });

      expect(res.status).toBe(400);
    });

    it('deve retornar 400 com senha muito curta', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/register')
        .set(headers)
        .send({ name: 'Curto', email: 'curto@test.com', password: '123' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  describe('POST /api/v1/auth/login', () => {
    it('deve autenticar com credenciais válidas', async () => {
      // Registrar primeiro
      await request(httpServer)
        .post('/api/v1/auth/register')
        .set(headers)
        .send({ name: 'Login Test', email: 'login@e2e.test', password: 'minha_senha_2026' });

      // Login
      const res = await request(httpServer)
        .post('/api/v1/auth/login')
        .set(headers)
        .send({ email: 'login@e2e.test', password: 'minha_senha_2026' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('deve retornar 401 com senha errada', async () => {
      await request(httpServer)
        .post('/api/v1/auth/register')
        .set(headers)
        .send({ name: 'Alguém', email: 'alguem@e2e.test', password: 'senha_certa' });

      const res = await request(httpServer)
        .post('/api/v1/auth/login')
        .set(headers)
        .send({ email: 'alguem@e2e.test', password: 'senha_errada' });

      expect(res.status).toBe(401);
    });

    it('deve retornar 401 para e-mail não cadastrado', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/login')
        .set(headers)
        .send({ email: 'naoexiste@e2e.test', password: 'qualquercoisa' });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  describe('POST /api/v1/auth/refresh', () => {
    it('deve renovar access token com refresh token válido', async () => {
      // Registrar e obter tokens
      const registerRes = await request(httpServer)
        .post('/api/v1/auth/register')
        .set(headers)
        .send({ name: 'Refresh Test', email: 'refresh@e2e.test', password: 'senha123' });

      const { refreshToken } = registerRes.body;

      const res = await request(httpServer)
        .post('/api/v1/auth/refresh')
        .set(headers)
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      // Novo refresh token deve ser diferente do original
      expect(res.body.refreshToken).not.toBe(refreshToken);
    });

    it('deve retornar 401 com refresh token inválido', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/refresh')
        .set(headers)
        .send({ refreshToken: 'token-invalido-qualquer' });

      expect(res.status).toBe(401);
    });

    it('deve rejeitar refresh token já usado (rotação)', async () => {
      const registerRes = await request(httpServer)
        .post('/api/v1/auth/register')
        .set(headers)
        .send({ name: 'Rotation Test', email: 'rotation@e2e.test', password: 'senha123' });

      const { refreshToken } = registerRes.body;

      // Usar o refresh token uma vez
      await request(httpServer)
        .post('/api/v1/auth/refresh')
        .set(headers)
        .send({ refreshToken });

      // Tentar usar o mesmo refresh token novamente
      const res = await request(httpServer)
        .post('/api/v1/auth/refresh')
        .set(headers)
        .send({ refreshToken });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  describe('GET /api/v1/auth/me', () => {
    it('deve retornar perfil do usuário autenticado', async () => {
      const registerRes = await request(httpServer)
        .post('/api/v1/auth/register')
        .set(headers)
        .send({ name: 'Me Test', email: 'me@e2e.test', password: 'senha123' });

      const { accessToken } = registerRes.body;

      const res = await request(httpServer)
        .get('/api/v1/auth/me')
        .set({ ...headers, Authorization: `Bearer ${accessToken}` });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('me@e2e.test');
      expect(res.body.role).toBe('citizen');
      // Nunca expor password_hash
      expect(res.body.password_hash).toBeUndefined();
    });

    it('deve retornar 401 sem token', async () => {
      const res = await request(httpServer)
        .get('/api/v1/auth/me')
        .set(headers);

      expect(res.status).toBe(401);
    });

    it('deve retornar 401 com token expirado/inválido', async () => {
      const res = await request(httpServer)
        .get('/api/v1/auth/me')
        .set({ ...headers, Authorization: 'Bearer token.invalido.mesmo' });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  describe('POST /api/v1/auth/logout', () => {
    it('deve revogar refresh token com sucesso', async () => {
      const registerRes = await request(httpServer)
        .post('/api/v1/auth/register')
        .set(headers)
        .send({ name: 'Logout Test', email: 'logout@e2e.test', password: 'senha123' });

      const { accessToken, refreshToken } = registerRes.body;

      const res = await request(httpServer)
        .post('/api/v1/auth/logout')
        .set({ ...headers, Authorization: `Bearer ${accessToken}` })
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('sucesso');

      // Agora o refresh token não deve mais funcionar
      const refreshRes = await request(httpServer)
        .post('/api/v1/auth/refresh')
        .set(headers)
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });
});
