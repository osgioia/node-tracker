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
// Ruta protegida de ejemplo para verificar el token
app.get('/api/me', authMiddleware, (req, res) => res.json(req.user));
app.use('/api/auth', authRouter);

describe('Auth Router (Integration)', () => {
  let testUser;
  let token;

  beforeEach(async () => {
    // Limpiar la base de datos y Redis antes de cada test
    await db.user.deleteMany();
    await redisClient.flushDb();

    // Crear un usuario de prueba y generar un token
    const createdUser = await createUser({
      username: 'logout-test',
      email: 'logout@test.com',
      password: 'password123',
    });
    testUser = await db.user.findUnique({ where: { id: createdUser.id } });
    token = generateToken(testUser);
  });

  afterAll(async () => {
    // Desconectar clientes al final de todos los tests
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
    // 1. Hacer logout para invalidar el token
    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.message).toBe('Successfully logged out');

    // 2. Verificar que el token está en la denylist de Redis
    const isBlocked = await redisClient.get(`blacklist:${token}`);
    expect(isBlocked).toBe('blocked');

    // 3. Intentar acceder a la ruta protegida de nuevo con el mismo token
    const blockedResponse = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);

    // 4. Esperar un error de autorización
    expect(blockedResponse.status).toBe(401);
    expect(blockedResponse.body.error).toBe('Token has been invalidated. Please log in again.');
  });
});