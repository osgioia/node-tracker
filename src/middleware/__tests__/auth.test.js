import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock modules
const mockJwt = {
  verify: jest.fn()
};

const mockLogMessage = jest.fn();

jest.unstable_mockModule('jsonwebtoken', () => ({ default: mockJwt }));
jest.unstable_mockModule('../../utils/utils.js', () => ({ logMessage: mockLogMessage }));

// Set up environment variables
process.env.JWT_SECRET = 'test-secret';

// Import after mocking
const { authMiddleware } = await import('../auth.js');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authMiddleware', () => {
    it('should authenticate valid token successfully', () => {
      const mockDecodedToken = {
        id: 1,
        username: 'testuser'
      };

      req.headers.authorization = 'Bearer valid_jwt_token';
      mockJwt.verify.mockReturnValue(mockDecodedToken);

      authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith('valid_jwt_token', 'test-secret');
      expect(req.user).toEqual(mockDecodedToken);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', () => {
      authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith('warn', 'Access without token');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', () => {
      req.headers.authorization = 'InvalidFormat token';

      authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith('warn', 'Access without token');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with authorization header not starting with Bearer', () => {
      req.headers.authorization = 'Basic dGVzdDp0ZXN0';

      authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith('warn', 'Access without token');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with only Bearer in authorization header', () => {
      req.headers.authorization = 'Bearer';

      authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith('warn', 'Access without token');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
      req.headers.authorization = 'Bearer invalid_token';
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith('invalid_token', 'test-secret');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error in auth: Invalid token');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token invalid or expired' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with expired token', () => {
      req.headers.authorization = 'Bearer expired_token';
      mockJwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith('expired_token', 'test-secret');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error in auth: Token expired');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token invalid or expired' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle JWT verification errors gracefully', () => {
      req.headers.authorization = 'Bearer malformed_token';
      mockJwt.verify.mockImplementation(() => {
        const error = new Error('Malformed token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error in auth: Malformed token');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token invalid or expired' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should extract token correctly from Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      req.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockReturnValue({ id: 1, username: 'testuser' });

      authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-secret');
      expect(next).toHaveBeenCalled();
    });

    it('should handle case-sensitive authorization header', () => {
      req.headers.Authorization = 'Bearer valid_token'; // Capital A
      mockJwt.verify.mockReturnValue({ id: 1, username: 'testuser' });

      authMiddleware(req, res, next);

      // Should fail because we check for lowercase 'authorization'
      expect(mockLogMessage).toHaveBeenCalledWith('warn', 'Access without token');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should set user object on request after successful authentication', () => {
      const mockUser = {
        id: 123,
        username: 'testuser',
        role: 'USER'
      };

      req.headers.authorization = 'Bearer valid_token';
      mockJwt.verify.mockReturnValue(mockUser);

      authMiddleware(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(req.user.id).toBe(123);
      expect(req.user.username).toBe('testuser');
      expect(req.user.role).toBe('USER');
      expect(next).toHaveBeenCalled();
    });
  });
});