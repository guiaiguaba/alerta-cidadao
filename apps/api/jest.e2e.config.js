// apps/api/jest.e2e.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:   '.',
  testMatch: ['**/test/e2e/**/*.e2e.spec.ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },

  testEnvironment: 'node',
  verbose: true,

  // E2E tests podem ser lentos (banco real)
  testTimeout: 30_000,
  globalTimeout: 120_000,

  // Sem threshold de cobertura para E2E (cobertura vem dos unitários)
  collectCoverage: false,

  // Rodar em sequência (não paralelo) — banco compartilhado
  maxWorkers: 1,
  maxConcurrency: 1,

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
