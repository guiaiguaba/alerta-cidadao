// apps/api/test/e2e/helpers/db.helper.ts
// Gerencia o banco de dados durante testes E2E

import { Client } from 'pg';

const TEST_DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://alerta:test_password@localhost:5432/alerta_test';

const TEST_SCHEMA = 'tenant_e2e_test';

let client: Client;

export async function connectTestDb(): Promise<Client> {
  client = new Client({ connectionString: TEST_DB_URL });
  await client.connect();
  return client;
}

export async function disconnectTestDb(): Promise<void> {
  await client?.end();
}

/**
 * Cria schema de teste e aplica migration.
 * Chamado uma vez antes da suite E2E.
 */
export async function setupTestSchema(): Promise<void> {
  await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
  await client.query(`CREATE SCHEMA "${TEST_SCHEMA}"`);

  // Registrar tenant de teste no schema público
  await client.query(`
    INSERT INTO public.tenants (
      id, slug, name, display_name, subdomain,
      state_code, schema_name, plan, is_active
    ) VALUES (
      'e2e-tenant-uuid-000000000000',
      'e2e-test',
      'E2E Test City',
      'E2E Test',
      'e2e',
      'XX',
      '${TEST_SCHEMA}',
      'pro',
      true
    ) ON CONFLICT (slug) DO NOTHING
  `);

  // Aplicar migration SQL
  const fs = require('fs');
  const path = require('path');
  const migrationSQL = fs.readFileSync(
    path.resolve(__dirname, '../../../prisma/migrations/001_tenant_schema.sql'),
    'utf-8',
  );

  await client.query(`SET search_path = "${TEST_SCHEMA}", public`);

  const statements = migrationSQL
    .split(/;\s*$/m)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    await client.query(stmt).catch(() => {}); // Ignorar IF NOT EXISTS
  }
}

/**
 * Limpa dados de teste entre suites (mantém schema e estrutura).
 */
export async function clearTestData(): Promise<void> {
  await client.query(`SET search_path = "${TEST_SCHEMA}", public`);
  await client.query(`
    TRUNCATE TABLE
      occurrence_timeline,
      occurrence_media,
      occurrences,
      alert_reads,
      alerts,
      notifications,
      refresh_tokens,
      team_members,
      teams,
      user_activity_limits,
      users
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Cria usuário de teste no schema E2E e retorna ID.
 */
export async function createTestUser(opts: {
  role?: string;
  email?: string;
  name?: string;
  passwordHash?: string;
} = {}): Promise<{ id: string; email: string }> {
  await client.query(`SET search_path = "${TEST_SCHEMA}", public`);

  const email = opts.email ?? `test_${Date.now()}@e2e.test`;
  const role  = opts.role  ?? 'citizen';
  const name  = opts.name  ?? `Test ${role}`;

  const { rows } = await client.query(`
    INSERT INTO users (id, name, email, password_hash, role, email_verified)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
    RETURNING id, email
  `, [name, email, opts.passwordHash ?? '$2b$12$testHashForE2ETesting000000000', role]);

  return rows[0];
}

export { TEST_SCHEMA };
