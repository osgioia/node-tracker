import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock the user-ban service
const mockUserBanService = {
  createUserBan: jest.fn(),
  banUserForDays: jest.fn(),
  banUserFor7Days: jest.fn(),
  banUserFor15Days: jest.fn(),
  banUserFor30Days: jest.fn(),
  banUserPermanently: jest.fn(),
  getUserBanById: jest.fn(),
  getUserBans: jest.fn(),
  getActiveUserBan: jest.fn(),
  getAllUserBans: jest.fn(),
  deactivateUserBan: jest.fn(),
  isUserBanned: jest.fn(),
  cleanupExpiredBans: jest.fn()
};

// Mock auth middleware
const mockAuthMiddleware = jest.fn((req, res, next) => {
  req.user = { id: 1, username: 'testuser', role: 'USER' };
  next();
});

jest.unstable_mockModule('../user-ban.service.js', () => mockUserBanService);
jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware
}));

// Mock prometheus
jest.unstable_mockModule('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  }))
}));

const { userBanRouter } = await import('../user-ban.router.js');

describe('UserBan Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/user-bans', userBanRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/user-bans', () => {
    it('should list all user bans for admin', async () => {
      // Mock admin user
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockBans = {
        userBans: [
          {
            id: 1,
            userId: 1,
            reason: 'Test ban',
            bannedBy: 'admin',
            active: true,
            user: { id: 1, username: 'testuser', email: 'test@example.com' }
          }
        ],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 }
      };

      mockUserBanService.getAllUserBans.mockResolvedValue(mockBans);

      const response = await request(app)
        .get('/api/user-bans')
        .expect(200);

      expect(response.body).toEqual(mockBans);
      expect(mockUserBanService.getAllUserBans).toHaveBeenCalledWith(1, 20, {});
    });

    it('should deny access for regular users', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'user', role: 'USER' };
        next();
      });

      await request(app)
        .get('/api/user-bans')
        .expect(403);
    });

    it('should allow access for moderators', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'moderator', role: 'MODERATOR' };
        next();
      });

      const mockBans = {
        userBans: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 }
      };

      mockUserBanService.getAllUserBans.mockResolvedValue(mockBans);

      await request(app)
        .get('/api/user-bans')
        .expect(200);
    });

    it('should apply filters correctly', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockBans = {
        userBans: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 }
      };

      mockUserBanService.getAllUserBans.mockResolvedValue(mockBans);

      await request(app)
        .get('/api/user-bans?active=true&userId=1&bannedBy=admin')
        .expect(200);

      expect(mockUserBanService.getAllUserBans).toHaveBeenCalledWith(1, 20, {
        active: true,
        userId: 1,
        bannedBy: 'admin'
      });
    });
  });

  describe('POST /api/user-bans', () => {
    it('should create a new user ban for admin', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockUserBan = {
        id: 1,
        userId: 2,
        reason: 'Spam in chat repeatedly',
        bannedBy: 'admin',
        active: true,
        user: { id: 2, username: 'spammer' }
      };

      mockUserBanService.createUserBan.mockResolvedValue(mockUserBan);

      const banData = {
        userId: 2,
        reason: 'Spam in chat repeatedly',
        expiresAt: '2024-12-31T23:59:59.000Z'
      };

      const response = await request(app)
        .post('/api/user-bans')
        .send(banData)
        .expect(201);

      expect(response.body.message).toBe('User ban created successfully');
      expect(response.body.userBan).toEqual(mockUserBan);
      expect(mockUserBanService.createUserBan).toHaveBeenCalledWith({
        userId: 2,
        reason: 'Spam in chat repeatedly',
        bannedBy: 'admin',
        expiresAt: '2024-12-31T23:59:59.000Z'
      });
    });

    it('should validate required fields', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      await request(app)
        .post('/api/user-bans')
        .send({})
        .expect(400);
    });

    it('should validate reason length', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      await request(app)
        .post('/api/user-bans')
        .send({
          userId: 1,
          reason: 'abc' // Too short
        })
        .expect(400);
    });
  });

  describe('POST /api/user-bans/quick/7-days', () => {
    it('should ban user for 7 days', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockUserBan = {
        id: 1,
        userId: 2,
        reason: 'Spam',
        bannedBy: 'admin',
        active: true,
        user: { id: 2, username: 'spammer' }
      };

      mockUserBanService.banUserFor7Days.mockResolvedValue(mockUserBan);

      const response = await request(app)
        .post('/api/user-bans/quick/7-days')
        .send({
          userId: 2,
          reason: 'Spam in chat'
        })
        .expect(201);

      expect(response.body.message).toBe('User banned for 7 days successfully');
      expect(mockUserBanService.banUserFor7Days).toHaveBeenCalledWith(2, 'Spam in chat', 'admin');
    });
  });

  describe('POST /api/user-bans/quick/15-days', () => {
    it('should ban user for 15 days', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'moderator', role: 'MODERATOR' };
        next();
      });

      const mockUserBan = {
        id: 1,
        userId: 2,
        reason: 'Toxic behavior',
        bannedBy: 'moderator',
        active: true,
        user: { id: 2, username: 'toxicuser' }
      };

      mockUserBanService.banUserFor15Days.mockResolvedValue(mockUserBan);

      const response = await request(app)
        .post('/api/user-bans/quick/15-days')
        .send({
          userId: 2,
          reason: 'Toxic behavior'
        })
        .expect(201);

      expect(response.body.message).toBe('User banned for 15 days successfully');
      expect(mockUserBanService.banUserFor15Days).toHaveBeenCalledWith(2, 'Toxic behavior', 'moderator');
    });
  });

  describe('POST /api/user-bans/quick/30-days', () => {
    it('should ban user for 30 days', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockUserBan = {
        id: 1,
        userId: 2,
        reason: 'Repeated violations',
        bannedBy: 'admin',
        active: true,
        user: { id: 2, username: 'violator' }
      };

      mockUserBanService.banUserFor30Days.mockResolvedValue(mockUserBan);

      const response = await request(app)
        .post('/api/user-bans/quick/30-days')
        .send({
          userId: 2,
          reason: 'Repeated violations'
        })
        .expect(201);

      expect(response.body.message).toBe('User banned for 30 days successfully');
      expect(mockUserBanService.banUserFor30Days).toHaveBeenCalledWith(2, 'Repeated violations', 'admin');
    });
  });

  describe('POST /api/user-bans/quick/permanent', () => {
    it('should ban user permanently (admin only)', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockUserBan = {
        id: 1,
        userId: 2,
        reason: 'Severe violation',
        bannedBy: 'admin',
        active: true,
        expiresAt: null,
        user: { id: 2, username: 'baduser' }
      };

      mockUserBanService.banUserPermanently.mockResolvedValue(mockUserBan);

      const response = await request(app)
        .post('/api/user-bans/quick/permanent')
        .send({
          userId: 2,
          reason: 'Severe violation of terms'
        })
        .expect(201);

      expect(response.body.message).toBe('User banned permanently');
      expect(mockUserBanService.banUserPermanently).toHaveBeenCalledWith(2, 'Severe violation of terms', 'admin');
    });

    it('should deny access for moderators', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'moderator', role: 'MODERATOR' };
        next();
      });

      await request(app)
        .post('/api/user-bans/quick/permanent')
        .send({
          userId: 2,
          reason: 'Severe violation'
        })
        .expect(403);
    });
  });

  describe('POST /api/user-bans/custom', () => {
    it('should ban user for custom number of days', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockUserBan = {
        id: 1,
        userId: 2,
        reason: 'Custom ban',
        bannedBy: 'admin',
        active: true,
        user: { id: 2, username: 'user' }
      };

      mockUserBanService.banUserForDays.mockResolvedValue(mockUserBan);

      const response = await request(app)
        .post('/api/user-bans/custom')
        .send({
          userId: 2,
          reason: 'Custom ban reason',
          days: 5
        })
        .expect(201);

      expect(response.body.message).toBe('User banned for 5 days successfully');
      expect(mockUserBanService.banUserForDays).toHaveBeenCalledWith(2, 'Custom ban reason', 'admin', 5);
    });

    it('should validate days range', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      await request(app)
        .post('/api/user-bans/custom')
        .send({
          userId: 2,
          reason: 'Custom ban reason',
          days: 500 // Too many days
        })
        .expect(400);
    });
  });

  describe('GET /api/user-bans/:id', () => {
    it('should get user ban by ID', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockUserBan = {
        id: 1,
        userId: 2,
        reason: 'Test ban',
        bannedBy: 'admin',
        active: true,
        user: { id: 2, username: 'testuser', email: 'test@example.com' }
      };

      mockUserBanService.getUserBanById.mockResolvedValue(mockUserBan);

      const response = await request(app)
        .get('/api/user-bans/1')
        .expect(200);

      expect(response.body).toEqual(mockUserBan);
      expect(mockUserBanService.getUserBanById).toHaveBeenCalledWith('1');
    });

    it('should return 404 if ban not found', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      mockUserBanService.getUserBanById.mockRejectedValue(new Error('User ban not found'));

      await request(app)
        .get('/api/user-bans/999')
        .expect(404);
    });
  });

  describe('PATCH /api/user-bans/:id/deactivate', () => {
    it('should deactivate user ban', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockUpdatedBan = {
        id: 1,
        userId: 2,
        active: false
      };

      mockUserBanService.deactivateUserBan.mockResolvedValue(mockUpdatedBan);

      const response = await request(app)
        .patch('/api/user-bans/1/deactivate')
        .expect(200);

      expect(response.body.message).toBe('User ban deactivated successfully');
      expect(mockUserBanService.deactivateUserBan).toHaveBeenCalledWith('1', 'admin');
    });
  });

  describe('GET /api/user-bans/user/:userId', () => {
    it('should get all bans for a specific user', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockUserBans = [
        {
          id: 1,
          userId: 2,
          reason: 'First ban',
          active: false
        },
        {
          id: 2,
          userId: 2,
          reason: 'Second ban',
          active: true
        }
      ];

      mockUserBanService.getUserBans.mockResolvedValue(mockUserBans);

      const response = await request(app)
        .get('/api/user-bans/user/2')
        .expect(200);

      expect(response.body).toEqual(mockUserBans);
      expect(mockUserBanService.getUserBans).toHaveBeenCalledWith('2');
    });
  });

  describe('GET /api/user-bans/user/:userId/active', () => {
    it('should get active ban for a user', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockActiveBan = {
        id: 1,
        userId: 2,
        reason: 'Active ban',
        active: true
      };

      mockUserBanService.getActiveUserBan.mockResolvedValue(mockActiveBan);

      const response = await request(app)
        .get('/api/user-bans/user/2/active')
        .expect(200);

      expect(response.body).toEqual(mockActiveBan);
    });

    it('should return 404 if no active ban', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      mockUserBanService.getActiveUserBan.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/user-bans/user/2/active')
        .expect(404);

      expect(response.body.message).toBe('No active ban found for this user');
    });
  });

  describe('GET /api/user-bans/user/:userId/status', () => {
    it('should check if user is banned', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      mockUserBanService.isUserBanned.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/user-bans/user/2/status')
        .expect(200);

      expect(response.body).toEqual({
        userId: 2,
        isBanned: true
      });
    });
  });

  describe('POST /api/user-bans/cleanup', () => {
    it('should cleanup expired bans (admin only)', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      mockUserBanService.cleanupExpiredBans.mockResolvedValue({ cleaned: 3 });

      const response = await request(app)
        .post('/api/user-bans/cleanup')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Expired bans cleanup completed',
        cleaned: 3
      });
    });

    it('should deny access for moderators', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'moderator', role: 'MODERATOR' };
        next();
      });

      await request(app)
        .post('/api/user-bans/cleanup')
        .expect(403);
    });
  });
});