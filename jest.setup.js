process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-at-least-32-characters-long-and-secure';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_tracker';
process.env.NODE_ENV = 'test';
process.env.JWT_EXPIRES_IN = '1h';
process.env.PORT = '3000';