export default {
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  // Skip global setup/teardown for unit tests (no Docker required)
  setupFiles: ['dotenv/config'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
    '!src/utils/db.server.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000, // Shorter timeout for unit tests
  moduleFileExtensions: ['js', 'json'],
  testPathIgnorePatterns: [
    '/node_modules/',
    'integration.test.js', // Skip integration tests that need Docker
    'users.integration.test.js',
    'auth.integration.test.js'
  ],
  transform: {},
  maxWorkers: 1,
  verbose: true,
  preset: null,
  testEnvironmentOptions: {
    // Mock process.env for tests
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-at-least-32-characters-long-and-secure',
      DATABASE_URL: 'postgresql://testuser:testpass@localhost:5433/testdb?schema=public',
      REDIS_URL: 'redis://localhost:6380'
    }
  }
};