import request from 'supertest';
import express from 'express';
import { db } from '../utils/db.server.js';
import redisClient from '../config/redis-client.js';
import { createUser } from '../users/users.service.js';
import { generateToken } from '../utils/utils.js';
import { authRouter } from './auth.router.js';
import { authMiddleware } from '../middleware/auth.js';

const app = express();
app.use(express.json());
app.get('/api/me', authMiddleware, (req, res) => res.json(req.user));
app.use('/api/auth', authRouter);

describe('Auth Router (Integration)', () => {
  let testUser;
  let token;

  beforeEach(async () => {
    await db.user.deleteMany();
    await redisClient.flushDb();

    const createdUser = await createUser({
      username: 'logout-test',
      email: 'logout@test.com',
      password: 'password123'
    });
    testUser = await db.user.findUnique({ where: { id: createdUser.id } });
    token = generateToken(testUser);
  });

  afterAll(async () => {
    await db.$disconnect();
    await redisClient.quit();
  });

  it('should allow access to a protected route with a valid token', async () => {
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.username).toBe('logout-test');
  });

  it('should invalidate a token on logout and block subsequent requests', async () => {
    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.message).toBe('Successfully logged out');

    const isBlocked = await redisClient.get(`blacklist:${token}`);
    expect(isBlocked).toBe('blocked');

    const blockedResponse = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    expect(blockedResponse.status).toBe(401);
    expect(blockedResponse.body.error).toBe('Token has been invalidated. Please log in again.');
  });
});