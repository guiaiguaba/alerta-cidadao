// apps/api/jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:              'src',
  testRegex:            '.*\\.spec\\.ts$',
  transform:            { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom:  [
    '**/*.ts',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.dto.ts',
    '!**/*.decorator.ts',
    '!**/*.filter.ts',
    '!**/__tests__/**',
    '!**/node_modules/**',
  ],
  coverageDirectory:    '../coverage',
  coverageReporters:    ['text', 'lcov', 'json-summary'],
  coverageThresholds: {
    global: {
      branches:   70,
      functions:  70,
      lines:      70,
      statements: 70,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterFramework: [],
  verbose: true,
};
