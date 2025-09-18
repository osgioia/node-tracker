const request = require('supertest');
const app = require('../../router');
const { createTestUser } = require('../utils/testHelpers');

describe('Auth Router', () => {
  let testUser;

  beforeAll(async () => {
    testUser = await createTestUser();
  });

  test('POST /login returns token for valid credentials', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: testUser.email, password: 'testPassword' });
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /login returns 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: testUser.email, password: 'wrongPassword' });
    
    expect(res.statusCode).toBe(401);
  });
});