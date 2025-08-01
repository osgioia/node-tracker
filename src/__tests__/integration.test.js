import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock all external dependencies
const mockDb = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  torrent: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  IPBan: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn()
  },
  invite: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  inviteTreeNode: {
    create: jest.fn()
  },
  $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
  $disconnect: jest.fn()
};

const mockBcrypt = {
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true)
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock_jwt_token'),
  verify: jest.fn().mockReturnValue({ id: 1, username: 'testuser', role: 'USER' })
};

const mockMagnet = {
  encode: jest.fn().mockReturnValue('magnet:?xt=urn:btih:test&dn=test&tr=test')
};

// Set up environment variables before importing modules
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.PORT = '3000';

// Mock modules
jest.unstable_mockModule('../utils/db.server.js', () => ({ db: mockDb }));
jest.unstable_mockModule('bcrypt', () => ({ default: mockBcrypt }));
jest.unstable_mockModule('jsonwebtoken', () => ({ default: mockJwt }));
jest.unstable_mockModule('magnet-uri', () => ({ default: mockMagnet }));
jest.unstable_mockModule('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  })),
  register: {
    contentType: 'text/plain',
    metrics: jest.fn().mockResolvedValue('# Mock metrics')
  }
}));

// Import router after mocking
const router = await import('../router.js');

describe('Integration Tests', () => {
  let app;
  let authToken;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/', router.default);
    
    // Mock a valid auth token
    authToken = 'Bearer mock_jwt_token';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Authentication Flow', () => {
    it('should complete full user registration and login flow', async () => {
      // 1. Register user
      mockDb.user.findFirst.mockResolvedValue(null); // No existing user
      mockDb.user.create.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      });

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.message).toBe('User created successfully');

      // 2. Login user
      mockDb.user.findFirst.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed_password',
        banned: false,
        role: 'USER',
        emailVerified: true
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.message).toBe('Login successful');
      expect(loginResponse.body.token).toBeDefined();

      // 3. Access protected profile
      mockDb.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        torrents: [],
        bookmarks: [],
        _count: {
          torrents: 0,
          bookmarks: 0
        },
        Progress: []
      });

      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', authToken);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      mockDb.user.findFirst.mockResolvedValue({
        id: 1,
        username: 'testuser',
        password: 'hashed_password',
        banned: false
      });
      mockBcrypt.compare.mockResolvedValue(false); // Invalid password

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Incorrect password');
    });
  });

  describe('Torrent Management Flow', () => {
    it('should complete full torrent lifecycle', async () => {
      // 1. Add torrent
      const mockTorrent = {
        id: 1,
        infoHash: 'abc123def456',
        name: 'Test Torrent',
        uploadedById: 1,
        category: { name: 'Movies' },
        tags: [{ name: 'action' }],
        uploadedBy: { id: 1, username: 'testuser' }
      };

      mockDb.torrent.create.mockResolvedValue(mockTorrent);

      const addResponse = await request(app)
        .post('/api/torrents')
        .set('Authorization', authToken)
        .send({
          infoHash: 'abc123def456',
          name: 'Test Torrent',
          category: 'Movies',
          tags: 'action'
        });

      expect(addResponse.status).toBe(201);
      expect(addResponse.body.message).toBe('Torrent added successfully');
      expect(addResponse.body.torrent).toBeDefined();

      // 2. Get torrent
      mockDb.torrent.findFirst.mockResolvedValue(mockTorrent);

      const getResponse = await request(app)
        .get('/api/torrents/abc123def456')
        .set('Authorization', authToken);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.magnetUri).toBeDefined();

      // 3. Update torrent
      const updatedTorrent = { ...mockTorrent, name: 'Updated Torrent' };
      mockDb.torrent.update.mockResolvedValue(updatedTorrent);

      const updateResponse = await request(app)
        .put('/api/torrents/1')
        .set('Authorization', authToken)
        .send({
          name: 'Updated Torrent'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.message).toBe('Torrent updated successfully');

      // 4. Delete torrent
      mockDb.torrent.delete.mockResolvedValue(mockTorrent);

      const deleteResponse = await request(app)
        .delete('/api/torrents/1')
        .set('Authorization', authToken);

      expect(deleteResponse.status).toBe(200);
    });

    it('should require authentication for torrent operations', async () => {
      const response = await request(app)
        .post('/api/torrents')
        .send({
          infoHash: 'abc123',
          name: 'Test Torrent'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('IP Ban Management Flow', () => {
    it('should complete full IP ban lifecycle', async () => {
      // 1. List IP bans
      const mockBans = [
        {
          id: 1,
          fromIP: '192.168.1.1',
          toIP: '192.168.1.255',
          reason: 'Spam'
        }
      ];

      mockDb.IPBan.findMany.mockResolvedValue(mockBans);

      mockDb.IPBan.count.mockResolvedValue(1);

      const listResponse = await request(app)
        .get('/api/ip-bans')
        .set('Authorization', authToken);

      expect(listResponse.status).toBe(200);
      expect(Array.isArray(listResponse.body)).toBe(true);

      // 2. Create IP ban
      const newBan = {
        id: 2,
        fromIP: '10.0.0.1',
        toIP: '10.255.255.255',
        reason: 'Malicious activity'
      };

      mockDb.IPBan.create.mockResolvedValue(newBan);

      const createResponse = await request(app)
        .post('/api/ip-bans')
        .set('Authorization', authToken)
        .send({
          fromIP: '10.0.0.1',
          toIP: '10.255.255.255',
          reason: 'Malicious activity'
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toHaveProperty('id');

      // 3. Update IP ban
      const updatedBan = { ...newBan, reason: 'Updated reason' };
      mockDb.IPBan.update.mockResolvedValue(updatedBan);

      const updateResponse = await request(app)
        .put('/api/ip-bans/2')
        .set('Authorization', authToken)
        .send({
          fromIP: '10.0.0.1',
          toIP: '10.255.255.255',
          reason: 'Updated reason'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toHaveProperty('id');

      // 4. Delete IP ban
      mockDb.IPBan.delete.mockResolvedValue(newBan);

      const deleteResponse = await request(app)
        .delete('/api/ip-bans/2')
        .set('Authorization', authToken);

      expect(deleteResponse.status).toBe(204);
    });

    it('should handle bulk IP ban creation', async () => {
      const bulkData = [
        {
          fromIP: '192.168.1.1',
          toIP: '192.168.1.255',
          reason: 'Spam network'
        },
        {
          fromIP: '10.0.0.1',
          toIP: '10.255.255.255',
          reason: 'Corporate network'
        }
      ];

      mockDb.IPBan.createMany.mockResolvedValue({ count: 2 });

      const response = await request(app)
        .post('/api/ip-bans/bulk')
        .set('Authorization', authToken)
        .send(bulkData);

      expect(response.status).toBe(201);
      expect(response.body.count).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors properly', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab', // Too short
          email: 'invalid-email',
          password: '123' // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeInstanceOf(Array);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.user.findFirst.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Database connection failed');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/torrents')
        .set('Authorization', authToken)
        .send({
          // Missing infoHash and name
          category: 'Movies'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Authorization and Access Control', () => {
    it('should allow users to access their own data', async () => {
      mockDb.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        torrents: [],
        bookmarks: [],
        _count: {
          torrents: 0,
          bookmarks: 0
        },
        Progress: []
      });

      const response = await request(app)
        .get('/api/users/1')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
    });

    it('should deny access to other users data for non-admin', async () => {
      const response = await request(app)
        .get('/api/users/2')
        .set('Authorization', authToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied.');
    });

    it('should allow admin access to all user data', async () => {
      // Mock admin token
      mockJwt.verify.mockReturnValue({ id: 1, username: 'admin', role: 'ADMIN' });

      mockDb.user.findUnique.mockResolvedValue({
        id: 2,
        username: 'otheruser',
        email: 'other@example.com',
        torrents: [],
        bookmarks: [],
        _count: {
          torrents: 0,
          bookmarks: 0
        },
        Progress: []
      });

      const response = await request(app)
        .get('/api/users/2')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should reject requests without proper authentication', async () => {
      const endpoints = [
        { method: 'get', path: '/api/users/profile' },
        { method: 'post', path: '/api/torrents' },
        { method: 'get', path: '/api/ip-bans' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });

    it('should handle malformed JWT tokens', async () => {
      // Mock JWT to throw error for invalid token
      mockJwt.verify.mockImplementation((token) => {
        if (token === 'invalid.jwt.token') {
          throw new Error('Invalid token');
        }
        return { id: 1, username: 'testuser', role: 'USER' };
      });

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token invalid or expired');
    });
  });
});