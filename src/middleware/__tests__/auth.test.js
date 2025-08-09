import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock modules
const mockJwt = {
  verify: jest.fn()
};

const mockLogMessage = jest.fn();

const mockDb = {
  user: {
    findUnique: jest.fn()
  }
};

jest.unstable_mockModule('jsonwebtoken', () => ({ default: mockJwt }));
jest.unstable_mockModule('../../utils/utils.js', () => ({
  logMessage: mockLogMessage
}));
jest.unstable_mockModule('../../utils/db.server.js', () => ({
  db: mockDb
}));

// Set up environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-at-least-32-characters-long-and-secure';

// Import after mocking
const { authMiddleware } = await import('../auth.js');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authMiddleware', () => {
    it('should authenticate valid token successfully', async () => {
      const mockDecodedToken = {
        id: 1,
        username: 'testuser'
      };

      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'USER',
        banned: false,
        emailVerified: true
      };

      req.headers.authorization = 'Bearer valid_jwt_token';
      mockJwt.verify.mockReturnValue(mockDecodedToken);
      mockDb.user.findUnique.mockResolvedValue(mockUser);

      await authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'valid_jwt_token',
        process.env.JWT_SECRET
      );
      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          banned: true,
          emailVerified: true
        }
      });
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      await authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith(
        'warn',
        `Access without token from IP: ${req.ip}`
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Access denied',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      req.headers.authorization = 'InvalidFormat token';

      await authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith(
        'warn',
        `Access without token from IP: ${req.ip}`
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Access denied',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with authorization header not starting with Bearer', async () => {
      req.headers.authorization = 'Basic dGVzdDp0ZXN0';

      await authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith(
        'warn',
        `Access without token from IP: ${req.ip}`
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Access denied',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with only Bearer in authorization header', async () => {
      req.headers.authorization = 'Bearer';

      await authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith(
        'warn',
        `Access without token from IP: ${req.ip}`
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Access denied',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      req.headers.authorization = 'Bearer invalid_token';
      mockJwt.verify.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'invalid_token',
        process.env.JWT_SECRET
      );
      expect(mockLogMessage).toHaveBeenCalledWith(
        'warn',
        `Invalid token from IP: ${req.ip}`
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with expired token', async () => {
      req.headers.authorization = 'Bearer expired_token';
      mockJwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'expired_token',
        process.env.JWT_SECRET
      );
      expect(mockLogMessage).toHaveBeenCalledWith(
        'warn',
        `Expired token from IP: ${req.ip}`
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle JWT verification errors gracefully', async () => {
      req.headers.authorization = 'Bearer malformed_token';
      mockJwt.verify.mockImplementation(() => {
        const error = new Error('Malformed token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith(
        'warn',
        `Invalid token from IP: ${req.ip}`
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should extract token correctly from Bearer header', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      const mockDecodedToken = { id: 1, username: 'testuser' };
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'USER',
        banned: false,
        emailVerified: true
      };

      req.headers.authorization = `Bearer ${token}`;
      mockJwt.verify.mockReturnValue(mockDecodedToken);
      mockDb.user.findUnique.mockResolvedValue(mockUser);

      await authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(next).toHaveBeenCalled();
    });

    it('should handle case-sensitive authorization header', async () => {
      req.headers.Authorization = 'Bearer valid_token'; // Capital A
      mockJwt.verify.mockReturnValue({ id: 1, username: 'testuser' });

      await authMiddleware(req, res, next);

      // Should fail because we check for lowercase 'authorization'
      expect(mockLogMessage).toHaveBeenCalledWith(
        'warn',
        `Access without token from IP: ${req.ip}`
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ 
        error: 'Access denied',
        code: 'NO_TOKEN'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should set user object on request after successful authentication', async () => {
      const mockDecodedToken = {
        id: 123,
        username: 'testuser'
      };

      const mockUser = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        role: 'USER',
        banned: false,
        emailVerified: true
      };

      req.headers.authorization = 'Bearer valid_token';
      mockJwt.verify.mockReturnValue(mockDecodedToken);
      mockDb.user.findUnique.mockResolvedValue(mockUser);

      await authMiddleware(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(req.user.id).toBe(123);
      expect(req.user.username).toBe('testuser');
      expect(req.user.role).toBe('USER');
      expect(next).toHaveBeenCalled();
    });

    it('should reject request when user not found in database', async () => {
      const mockDecodedToken = {
        id: 999,
        username: 'nonexistent'
      };

      req.headers.authorization = 'Bearer valid_token';
      mockJwt.verify.mockReturnValue(mockDecodedToken);
      mockDb.user.findUnique.mockResolvedValue(null);

      await authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith(
        'warn',
        `Token for non-existent user: ${mockDecodedToken.id} from IP: ${req.ip}`
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request when user is banned', async () => {
      const mockDecodedToken = {
        id: 1,
        username: 'banneduser'
      };

      const mockBannedUser = {
        id: 1,
        username: 'banneduser',
        email: 'banned@example.com',
        role: 'USER',
        banned: true,
        emailVerified: true
      };

      req.headers.authorization = 'Bearer valid_token';
      mockJwt.verify.mockReturnValue(mockDecodedToken);
      mockDb.user.findUnique.mockResolvedValue(mockBannedUser);

      await authMiddleware(req, res, next);

      expect(mockLogMessage).toHaveBeenCalledWith(
        'warn',
        `Banned user attempted access: ${mockBannedUser.username} from IP: ${req.ip}`
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User account is banned',
        code: 'USER_BANNED'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
