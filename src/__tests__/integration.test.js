process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-at-least-32-characters-long-and-secure';
process.env.NODE_ENV = 'test';

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockDb = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  torrent: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  category: {
    findFirst: jest.fn(),
    create: jest.fn()
  },
  tag: {
    findMany: jest.fn(),
    create: jest.fn()
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
  compare: jest.fn().mockResolvedValue(true),
  hashSync: jest.fn().mockReturnValue('hashed_password'),
  compareSync: jest.fn().mockReturnValue(true)
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock_jwt_token'),
  verify: jest.fn().mockReturnValue({ id: 1, username: 'testuser', role: 'USER' })
};

const mockMagnet = {
  encode: jest.fn().mockReturnValue('magnet:?xt=urn:btih:test&dn=test&tr=test')
};

process.env.JWT_EXPIRES_IN = '1h';
process.env.PORT = '3000';

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

describe('Integration Tests', () => {
  let app;
  let authToken;

  beforeAll(async () => {
    const router = await import('../router.js');
    
    app = express();
    app.use(express.json());
    app.use('/', router.default);
    
    authToken = 'Bearer mock_jwt_token';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb.user.findUnique.mockResolvedValue({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'USER',
      banned: false,
      emailVerified: true
    });
  });

  describe('User Authentication Flow', () => {
    it('should complete full user registration and login flow', async () => {
      mockDb.user.findFirst.mockResolvedValue(null);
      mockDb.user.count.mockResolvedValue(0); 
      mockDb.user.create.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed_password'
      });
      
      mockBcrypt.hash.mockResolvedValue('hashed_password');

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123!'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.message).toBe('User registered successfully');

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
          password: 'Password123!'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.message).toBe('Login successful');
      expect(loginResponse.body.token).toBeDefined();

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
        .get('/api/users/me')
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
      mockBcrypt.compare.mockResolvedValue(false); 

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('Torrent Management Flow', () => {
    it('should complete full torrent lifecycle', async () => {
      const mockTorrent = {
        id: 1,
        infoHash: 'abc123def456789012345678901234567890abcd',
        name: 'Test Torrent',
        uploadedById: 1,
        category: { name: 'Movies' },
        tags: [{ name: 'action' }],
        uploadedBy: { id: 1, username: 'testuser' }
      };

      mockDb.torrent.findFirst.mockResolvedValueOnce(null);
      mockDb.category.findFirst.mockResolvedValue({ id: 1, name: 'Movies' });
      mockDb.tag.findMany.mockResolvedValue([{ id: 1, name: 'action' }]);
      mockDb.torrent.create.mockResolvedValue(mockTorrent);

      const addResponse = await request(app)
        .post('/api/torrents')
        .set('Authorization', authToken)
        .send({
          infoHash: 'abc123def456789012345678901234567890abcd',
          name: 'Test Torrent',
          category: 'Movies',
          tags: 'action'
        });

      if (addResponse.status !== 201) {
        console.log('Torrent creation failed:', addResponse.body);
      }
      expect(addResponse.status).toBe(201);
      expect(addResponse.body.message).toBe('Torrent created successfully');
      expect(addResponse.body.torrent).toBeDefined();

      mockDb.torrent.findFirst.mockResolvedValue(mockTorrent);

      const getResponse = await request(app)
        .get('/api/torrents/by-hash/abc123def456789012345678901234567890abcd')
        .set('Authorization', authToken);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.magnetUri).toBeDefined();

      const updatedTorrent = { ...mockTorrent, name: 'Updated Torrent' };
      mockDb.torrent.findUnique.mockResolvedValue(mockTorrent);
      mockDb.torrent.update.mockResolvedValue(updatedTorrent);

      const updateResponse = await request(app)
        .put('/api/torrents/1')
        .set('Authorization', authToken)
        .send({
          name: 'Updated Torrent'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.message).toBe('Torrent updated successfully');

      mockDb.torrent.delete.mockResolvedValue(mockTorrent);

      const deleteResponse = await request(app)
        .delete('/api/torrents/1')
        .set('Authorization', authToken);

      expect(deleteResponse.status).toBe(204);
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
      expect(listResponse.body).toHaveProperty('ipBans');
      expect(Array.isArray(listResponse.body.ipBans)).toBe(true);

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

      mockDb.IPBan.delete.mockResolvedValue(newBan);

      const deleteResponse = await request(app)
        .delete('/api/ip-bans/2')
        .set('Authorization', authToken);

      expect(deleteResponse.status).toBe(204);
    });

    it('should handle IPv6 addresses in IP bans', async () => {
      const newBan = {
        id: 3,
        fromIP: '2001:db8::1',
        toIP: '2001:db8::ff',
        reason: 'IPv6 spam'
      };

      mockDb.IPBan.create.mockResolvedValue(newBan);

      const createResponse = await request(app)
        .post('/api/ip-bans')
        .set('Authorization', authToken)
        .send(newBan);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toHaveProperty('id');

      const updatedBan = { ...newBan, reason: 'Updated IPv6 reason' };
      mockDb.IPBan.update.mockResolvedValue(updatedBan);

      const updateResponse = await request(app)
        .put('/api/ip-bans/3')
        .set('Authorization', authToken)
        .send(updatedBan);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toHaveProperty('id');

      mockDb.IPBan.delete.mockResolvedValue(newBan);

      const deleteResponse = await request(app)
        .delete('/api/ip-bans/3')
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
          username: 'ab', 
          email: 'invalid-email',
          password: '123' 
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
          category: 'Movies'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toBeInstanceOf(Array);
      expect(response.body.errors.length).toBeGreaterThan(0);
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
      expect(response.body.error).toBe('Authentication failed');
    });
  });
});