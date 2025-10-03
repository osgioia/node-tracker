import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock dependencies
const mockAuthService = {
  loginUser: jest.fn(),
  logoutUser: jest.fn()
};

const mockAuthMiddleware = jest.fn((req, res, next) => {
  req.user = { id: 1, username: 'testuser', role: 'USER' };
  next();
});

jest.unstable_mockModule('../auth.service.js', () => mockAuthService);
jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware
}));

jest.unstable_mockModule('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  }))
}));

const { authRouter } = await import('../auth.router.js');

describe('Auth Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return token for valid credentials', async () => {
      const mockResult = {
        success: true,
        token: 'mock_jwt_token',
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          role: 'USER'
        }
      };

      mockAuthService.loginUser.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.success).toBe(true);
      expect(mockAuthService.loginUser).toHaveBeenCalledWith('test@example.com', 'testpassword');
    });

    it('should return 401 for invalid credentials', async () => {
      const mockResult = {
        success: false,
        message: 'Invalid credentials'
      };

      mockAuthService.loginUser.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Logged out successfully'
      };

      mockAuthService.logoutUser.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer mock_jwt_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAuthService.logoutUser).toHaveBeenCalledWith(1);
    });
  });
});