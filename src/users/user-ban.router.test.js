import request from 'supertest';
import express from 'express';
import { userBanRouter } from './user-ban.router.js';
import * as userBanService from './user-ban.service.js';
import { authMiddleware } from '../middleware/auth.js';

// Mock de los módulos. Jest interceptará estas llamadas.
jest.mock('./user-ban.service.js');
jest.mock('../middleware/auth.js', () => ({
  // Exportamos una función mock que podemos manipular en cada test
  authMiddleware: jest.fn((req, res, next) => {
    req.user = { id: 1, username: 'test-admin', role: 'ADMIN' };
    next();
  })
}));

const app = express();
app.use(express.json());
app.use('/api/user-bans', userBanRouter);

describe('User Ban Router', () => {
  // Guardamos la implementación original del mock de auth
  const originalAuthImplementation = authMiddleware.getMockImplementation();

  afterEach(() => {
    jest.clearAllMocks();
    // Restauramos la implementación original después de cada test para evitar
    // que un test afecte a otro.
    authMiddleware.mockImplementation(originalAuthImplementation);
  });

  describe('POST /api/user-bans', () => {
    it('should create a new ban when user is an admin and data is valid', async () => {
      const banData = { userId: 2, reason: 'Spamming comments' };
      const createdBan = { id: 1, ...banData, bannedBy: 'test-admin', active: true };

      userBanService.createUserBan.mockResolvedValue(createdBan);

      const response = await request(app)
        .post('/api/user-bans')
        .send(banData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User ban created successfully');
      expect(response.body.userBan).toEqual(createdBan);
      expect(userBanService.createUserBan).toHaveBeenCalledWith({
        ...banData,
        bannedBy: 'test-admin',
        expiresAt: undefined
      });
    });

    it('should return 400 if reason is too short', async () => {
      const banData = { userId: 2, reason: 'Spam' };

      const response = await request(app)
        .post('/api/user-bans')
        .send(banData);

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toBe('Reason must be between 5 and 500 characters');
      expect(userBanService.createUserBan).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not admin or moderator', async () => {
      // Sobreescribimos el mock de autenticación para este test específico
      authMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 3, username: 'test-user', role: 'USER' };
        next();
      });

      const banData = { userId: 2, reason: 'Spamming comments' };

      const response = await request(app)
        .post('/api/user-bans')
        .send(banData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. Administrator or Moderator role required.');
      expect(userBanService.createUserBan).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/user-bans/:id', () => {
    it('should return a ban by ID if user is authorized', async () => {
        const ban = { id: 1, userId: 2, reason: 'Test ban', bannedBy: 'admin' };
        userBanService.getUserBanById.mockResolvedValue(ban);

        const response = await request(app).get('/api/user-bans/1');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(ban);
        expect(userBanService.getUserBanById).toHaveBeenCalledWith('1');
    });

    it('should return 404 if ban is not found', async () => {
        userBanService.getUserBanById.mockRejectedValue(new Error('User ban not found'));

        const response = await request(app).get('/api/user-bans/999');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('User ban not found');
    });
  });

  describe('GET /api/user-bans', () => {
    it('should return a paginated list of bans', async () => {
      const mockResult = {
        users: [{ id: 1, userId: 2, reason: 'Test' }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 }
      };
      userBanService.getAllUserBans.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/user-bans?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(userBanService.getAllUserBans).toHaveBeenCalledWith(1, 20, {});
    });

    it('should handle filters correctly', async () => {
      const mockResult = {
        users: [{ id: 2, userId: 3, reason: 'Another Test', active: true }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 }
      };
      userBanService.getAllUserBans.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/user-bans?active=true&userId=3');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(userBanService.getAllUserBans).toHaveBeenCalledWith(1, 20, { active: true, userId: 3 });
    });
  });

  describe('PATCH /api/user-bans/:id/deactivate', () => {
    it('should deactivate a ban successfully', async () => {
      const updatedBan = { id: 1, active: false, unbannedBy: 'test-admin' };
      userBanService.deactivateUserBan.mockResolvedValue(updatedBan);

      const response = await request(app)
        .patch('/api/user-bans/1/deactivate');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User ban deactivated successfully');
      expect(response.body.userBan).toEqual(updatedBan);
      expect(userBanService.deactivateUserBan).toHaveBeenCalledWith('1', 'test-admin');
    });

    it('should return 400 if deactivating fails (e.g., ban not found)', async () => {
      userBanService.deactivateUserBan.mockRejectedValue(new Error('Ban not found'));

      const response = await request(app)
        .patch('/api/user-bans/1/deactivate');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Ban not found');
    });
  });

  describe('POST /api/user-bans/quick/permanent', () => {
    it('should create a permanent ban if user is ADMIN', async () => {
      const banData = { userId: 5, reason: 'Severe violation' };
      const createdBan = { id: 3, ...banData, bannedBy: 'test-admin', expiresAt: null };
      userBanService.banUserPermanently.mockResolvedValue(createdBan);

      const response = await request(app)
        .post('/api/user-bans/quick/permanent')
        .send(banData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User banned permanently');
      expect(userBanService.banUserPermanently).toHaveBeenCalledWith(5, 'Severe violation', 'test-admin');
    });

    it('should return 403 if user is MODERATOR (requires ADMIN)', async () => {
      authMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 4, username: 'test-mod', role: 'MODERATOR' };
        next();
      });

      const banData = { userId: 5, reason: 'Severe violation' };
      const response = await request(app)
        .post('/api/user-bans/quick/permanent')
        .send(banData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied. Administrator role required.');
      expect(userBanService.banUserPermanently).not.toHaveBeenCalled();
    });
  });
});