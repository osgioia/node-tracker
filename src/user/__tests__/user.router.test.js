import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock the user service
const mockUserService = {
  createUser: jest.fn(),
  authenticateUser: jest.fn(),
  getUserById: jest.fn(),
  getAllUsers: jest.fn(),
  updateUser: jest.fn(),
  toggleUserBan: jest.fn(),
  createInvite: jest.fn(),
  getUserStats: jest.fn()
};

// Mock auth middleware
const mockAuthMiddleware = jest.fn((req, res, next) => {
  req.user = { id: 1, username: 'testuser', role: 'USER' };
  next();
});

jest.unstable_mockModule('../user.service.js', () => mockUserService);
jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware
}));

// Mock prometheus
jest.unstable_mockModule('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  }))
}));

const { userRouter } = await import('../user.router.js');

describe('User Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/user', userRouter);
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      mockUserService.createUser.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      });

      const response = await request(app)
        .post('/api/user/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).toHaveProperty('user');
      expect(mockUserService.createUser).toHaveBeenCalledWith(userData);
    });

    it('should return validation errors for invalid data', async () => {
      const invalidData = {
        username: 'ab', // Too short
        email: 'invalid-email',
        password: '123' // Too short
      };

      const response = await request(app)
        .post('/api/user/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toBeInstanceOf(Array);
    });

    it('should handle service errors', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      mockUserService.createUser.mockRejectedValue(new Error('User already exists'));

      const response = await request(app)
        .post('/api/user/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'User already exists');
    });
  });

  describe('POST /login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        username: 'testuser',
        password: 'password123'
      };

      mockUserService.authenticateUser.mockResolvedValue({
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          role: 'USER'
        },
        token: 'jwt_token'
      });

      const response = await request(app)
        .post('/api/user/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(mockUserService.authenticateUser).toHaveBeenCalledWith('testuser', 'password123');
    });

    it('should return validation errors for missing data', async () => {
      const response = await request(app)
        .post('/api/user/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle authentication errors', async () => {
      const loginData = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      mockUserService.authenticateUser.mockRejectedValue(new Error('Incorrect password'));

      const response = await request(app)
        .post('/api/user/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Incorrect password');
    });
  });

  describe('GET /profile', () => {
    it('should get user profile successfully', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };
      const mockStats = {
        torrentsUploaded: 5,
        totalUploaded: 1000,
        ratio: 1.5
      };

      mockUserService.getUserById.mockResolvedValue(mockUser);
      mockUserService.getUserStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/user/profile');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user', mockUser);
      expect(response.body).toHaveProperty('stats', mockStats);
      expect(mockUserService.getUserById).toHaveBeenCalledWith(1);
      expect(mockUserService.getUserStats).toHaveBeenCalledWith(1);
    });

    it('should handle user not found', async () => {
      mockUserService.getUserById.mockRejectedValue(new Error('User not found'));

      const response = await request(app)
        .get('/api/user/profile');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('GET /:id', () => {
    it('should get user by id for own profile', async () => {
      const mockUser = { id: 1, username: 'testuser' };
      const mockStats = { torrentsUploaded: 5 };

      mockUserService.getUserById.mockResolvedValue(mockUser);
      mockUserService.getUserStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/user/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user', mockUser);
      expect(response.body).toHaveProperty('stats', mockStats);
    });

    it('should deny access to other user profile for non-admin', async () => {
      const response = await request(app)
        .get('/api/user/2');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied.');
    });

    it('should allow admin to access any user profile', async () => {
      // Mock admin user
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockUser = { id: 2, username: 'otheruser' };
      const mockStats = { torrentsUploaded: 3 };

      mockUserService.getUserById.mockResolvedValue(mockUser);
      mockUserService.getUserStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/user/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user', mockUser);
    });
  });

  describe('PUT /:id', () => {
    it('should update user successfully', async () => {
      const updateData = { username: 'newusername' };
      const mockUpdatedUser = { id: 1, username: 'newusername' };

      mockUserService.updateUser.mockResolvedValue(mockUpdatedUser);

      const response = await request(app)
        .put('/api/user/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'User updated successfully');
      expect(response.body).toHaveProperty('user', mockUpdatedUser);
      expect(mockUserService.updateUser).toHaveBeenCalledWith('1', updateData);
    });

    it('should remove admin-only fields for non-admin users', async () => {
      // Ensure the auth middleware returns a regular user, not admin
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'testuser', role: 'USER' }; // Regular user
        next();
      });

      const updateData = {
        username: 'newusername',
        role: 'ADMIN', // Should be removed
        remainingInvites: 10, // Should be removed
        banned: true // Should be removed
      };

      mockUserService.updateUser.mockResolvedValue({ id: 1, username: 'newusername' });

      const response = await request(app)
        .put('/api/user/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(mockUserService.updateUser).toHaveBeenCalledWith('1', { username: 'newusername' });
    });
  });

  describe('POST /invite', () => {
    it('should create invite successfully', async () => {
      const inviteData = {
        email: 'invite@example.com',
        reason: 'Friend',
        expiresInDays: 7
      };

      const mockInvite = {
        id: 1,
        inviteKey: 'inv_123_abc',
        email: 'invite@example.com',
        expires: new Date()
      };

      mockUserService.createInvite.mockResolvedValue(mockInvite);

      const response = await request(app)
        .post('/api/user/invite')
        .send(inviteData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Invitation created successfully');
      expect(response.body).toHaveProperty('invite');
      expect(mockUserService.createInvite).toHaveBeenCalledWith(1, 'invite@example.com', 'Friend', 7);
    });

    it('should return validation errors for invalid invite data', async () => {
      const invalidData = {
        email: 'invalid-email',
        reason: '', // Empty reason
        expiresInDays: 50 // Too many days
      };

      const response = await request(app)
        .post('/api/user/invite')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET / (admin only)', () => {
    beforeEach(() => {
      // Mock admin user
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });
    });

    it('should list all users for admin', async () => {
      const mockResult = {
        users: [
          { id: 1, username: 'user1' },
          { id: 2, username: 'user2' }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1
        }
      };

      mockUserService.getAllUsers.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/user?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockUserService.getAllUsers).toHaveBeenCalledWith(1, 20);
    });

    it('should deny access for non-admin users', async () => {
      // Mock regular user
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'user', role: 'USER' };
        next();
      });

      const response = await request(app)
        .get('/api/user');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /:id/ban (admin only)', () => {
    beforeEach(() => {
      // Mock admin user
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });
    });

    it('should ban user successfully', async () => {
      const banData = {
        banned: true,
        reason: 'Violation of rules'
      };

      const mockBannedUser = {
        id: 2,
        username: 'banneduser',
        banned: true
      };

      mockUserService.toggleUserBan.mockResolvedValue(mockBannedUser);

      const response = await request(app)
        .patch('/api/user/2/ban')
        .send(banData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'User banned successfully');
      expect(response.body).toHaveProperty('user', mockBannedUser);
      expect(mockUserService.toggleUserBan).toHaveBeenCalledWith('2', true, 'Violation of rules');
    });

    it('should unban user successfully', async () => {
      const unbanData = {
        banned: false
      };

      const mockUnbannedUser = {
        id: 2,
        username: 'unbanneduser',
        banned: false
      };

      mockUserService.toggleUserBan.mockResolvedValue(mockUnbannedUser);

      const response = await request(app)
        .patch('/api/user/2/ban')
        .send(unbanData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'User unbanned successfully');
      expect(mockUserService.toggleUserBan).toHaveBeenCalledWith('2', false, undefined);
    });
  });

  describe('GET /:id/stats (admin only)', () => {
    beforeEach(() => {
      // Mock admin user
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });
    });

    it('should get user stats for admin', async () => {
      const mockStats = {
        torrentsUploaded: 10,
        totalUploaded: 5000,
        totalDownloaded: 3000,
        ratio: 1.67
      };

      mockUserService.getUserStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/user/2/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
      expect(mockUserService.getUserStats).toHaveBeenCalledWith('2');
    });
  });
});