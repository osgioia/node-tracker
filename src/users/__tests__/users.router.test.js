import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockUsersService = {
  createUser: jest.fn(),
  getUserById: jest.fn(),
  getAllUsers: jest.fn(),
  updateUser: jest.fn(),
  toggleUserBan: jest.fn(),
  getUserStats: jest.fn()
};

const mockAuthMiddleware = jest.fn((req, res, next) => {
  req.user = { id: 1, username: 'testuser', role: 'USER' };
  next();
});

jest.unstable_mockModule('../users.service.js', () => mockUsersService);
jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware
}));

jest.unstable_mockModule('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  }))
}));

const { usersRouter } = await import('../users.router.js');

describe('Users Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', usersRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('should list all users for admin with ratio data', async () => {
      
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockResult = {
        users: [
          { 
            id: 1, 
            username: 'user1',
            email: 'user1@example.com',
            uploaded: 5368709120,
            downloaded: 2684354560,
            seedtime: 86400,
            ratio: 2.0
          },
          { 
            id: 2, 
            username: 'user2',
            email: 'user2@example.com',
            uploaded: 1073741824,
            downloaded: 2147483648,
            seedtime: 43200,
            ratio: 0.5
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1
        }
      };

      mockUsersService.getAllUsers.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/users?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockUsersService.getAllUsers).toHaveBeenCalledWith(1, 20);
    });

    it('should deny access for non-admin users', async () => {
      
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'user', role: 'USER' };
        next();
      });

      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied. Administrator role required.');
    });
  });

  describe('POST /api/users', () => {
    it('should create user for admin', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123'
      };

      mockUsersService.createUser.mockResolvedValue({
        id: 2,
        username: 'newuser',
        email: 'new@example.com'
      });

      const response = await request(app)
        .post('/api/users')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(mockUsersService.createUser).toHaveBeenCalledWith(userData);
    });

    it('should validate required fields', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const response = await request(app)
        .post('/api/users')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/users/me', () => {
    it('should get current user profile with ratio data', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        uploaded: 5368709120,
        downloaded: 2684354560,
        seedtime: 86400,
        ratio: 2.0
      };

      const mockStats = {
        torrentsUploaded: 5,
        bookmarks: 3,
        totalUploaded: 5368709120,
        totalDownloaded: 2684354560,
        seedtime: 86400,
        ratio: 2.0
      };

      mockUsersService.getUserById.mockResolvedValue(mockUser);
      mockUsersService.getUserStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/users/me');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user', mockUser);
      expect(response.body).toHaveProperty('stats', mockStats);
      expect(response.body.user).toHaveProperty('ratio', 2.0);
      expect(mockUsersService.getUserById).toHaveBeenCalledWith(1);
      expect(mockUsersService.getUserStats).toHaveBeenCalledWith(1);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should get user by id', async () => {
      const mockUser = {
        id: 2,
        username: 'otheruser',
        email: 'other@example.com'
      };

      mockUsersService.getUserById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/users/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user', mockUser);
      expect(mockUsersService.getUserById).toHaveBeenCalledWith('2');
    });

    it('should return 404 for non-existent user', async () => {
      mockUsersService.getUserById.mockRejectedValue(new Error('User not found'));

      const response = await request(app)
        .get('/api/users/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user (admin or own profile)', async () => {
      const updateData = {
        username: 'updateduser',
        email: 'updated@example.com'
      };

      const mockUpdatedUser = {
        id: 1,
        username: 'updateduser',
        email: 'updated@example.com'
      };

      mockUsersService.updateUser.mockResolvedValue(mockUpdatedUser);

      const response = await request(app)
        .put('/api/users/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'User updated successfully');
      expect(response.body).toHaveProperty('user', mockUpdatedUser);
      expect(mockUsersService.updateUser).toHaveBeenCalledWith('1', updateData);
    });

    it('should deny access to update other users profile for non-admin', async () => {
      
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'testuser', role: 'USER' };
        next();
      });

      const response = await request(app)
        .put('/api/users/2')
        .send({ username: 'hacker' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied.');
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should ban user for admin', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockBannedUser = {
        id: 2,
        username: 'banneduser',
        banned: true
      };

      mockUsersService.toggleUserBan.mockResolvedValue(mockBannedUser);

      const response = await request(app)
        .patch('/api/users/2')
        .send({ banned: true, reason: 'Violation' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'User banned successfully');
      expect(mockUsersService.toggleUserBan).toHaveBeenCalledWith('2', true, 'Violation');
    });

    it('should deny access for non-admin', async () => {
      
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'testuser', role: 'USER' };
        next();
      });

      const response = await request(app)
        .patch('/api/users/2')
        .send({ banned: true });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/users/:id/statistics', () => {
    it('should get user statistics for admin', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockStats = {
        torrentsUploaded: 5,
        bookmarks: 3,
        totalUploaded: 1000,
        totalDownloaded: 500,
        ratio: 2.0
      };

      mockUsersService.getUserStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/users/2/statistics');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
      expect(mockUsersService.getUserStats).toHaveBeenCalledWith('2');
    });

    it('should deny access for non-admin', async () => {
      
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'testuser', role: 'USER' };
        next();
      });

      const response = await request(app)
        .get('/api/users/2/statistics');

      expect(response.status).toBe(403);
    });
  });
});