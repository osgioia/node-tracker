import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock the torrents service
const mockTorrentsService = {
  addTorrent: jest.fn(),
  getTorrentById: jest.fn(),
  getTorrentByInfoHash: jest.fn(),
  getAllTorrents: jest.fn(),
  updateTorrent: jest.fn(),
  deleteTorrent: jest.fn()
};

// Mock auth middleware
const mockAuthMiddleware = jest.fn((req, res, next) => {
  req.user = { id: 1, username: 'testuser', role: 'USER' };
  next();
});

jest.unstable_mockModule('../torrents.service.js', () => mockTorrentsService);
jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware
}));

// Mock prometheus
jest.unstable_mockModule('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  }))
}));

const { torrentsRouter } = await import('../torrents.router.js');

describe('Torrents Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/torrents', torrentsRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/torrents', () => {
    it('should list all torrents with pagination', async () => {
      const mockResult = {
        torrents: [
          { id: 1, name: 'Torrent 1' },
          { id: 2, name: 'Torrent 2' }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1
        }
      };

      mockTorrentsService.getAllTorrents.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/torrents?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockTorrentsService.getAllTorrents).toHaveBeenCalledWith(1, 20, {});
    });

    it('should filter torrents by category', async () => {
      const mockResult = {
        torrents: [{ id: 1, name: 'Movie Torrent' }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 }
      };

      mockTorrentsService.getAllTorrents.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/torrents?category=Movies');

      expect(response.status).toBe(200);
      expect(mockTorrentsService.getAllTorrents).toHaveBeenCalledWith(1, 20, { category: 'Movies' });
    });

    it('should filter torrents by search term', async () => {
      const mockResult = {
        torrents: [{ id: 1, name: 'Action Movie' }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 }
      };

      mockTorrentsService.getAllTorrents.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/torrents?search=action');

      expect(response.status).toBe(200);
      expect(mockTorrentsService.getAllTorrents).toHaveBeenCalledWith(1, 20, { search: 'action' });
    });
  });

  describe('POST /api/torrents', () => {
    it('should create a new torrent successfully', async () => {
      const torrentData = {
        infoHash: 'abc123def456ghi789jkl012mno345pqr678stu9',
        name: 'Test Torrent',
        category: 'Movies',
        tags: 'action, thriller',
        description: 'A test torrent',
        size: 1024,
        anonymous: false,
        freeleech: true
      };

      const mockTorrent = {
        id: 1,
        ...torrentData,
        uploadedById: 1
      };

      mockTorrentsService.addTorrent.mockResolvedValue(mockTorrent);

      const response = await request(app)
        .post('/api/torrents')
        .send(torrentData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Torrent created successfully');
      expect(response.body).toHaveProperty('torrent', mockTorrent);
      expect(mockTorrentsService.addTorrent).toHaveBeenCalledWith({
        ...torrentData,
        uploadedById: 1
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/torrents')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle duplicate torrent error with 409 status', async () => {
      const torrentData = {
        infoHash: 'abc123def456ghi789jkl012mno345pqr678stu9',
        name: 'Test Torrent'
      };

      mockTorrentsService.addTorrent.mockRejectedValue(new Error('Torrent with this infoHash already exists'));

      const response = await request(app)
        .post('/api/torrents')
        .send(torrentData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'Torrent with this infoHash already exists');
    });
  });

  describe('GET /api/torrents/:id', () => {
    it('should get torrent by id', async () => {
      const mockTorrent = {
        id: 1,
        name: 'Test Torrent',
        infoHash: 'abc123'
      };

      mockTorrentsService.getTorrentById.mockResolvedValue(mockTorrent);

      const response = await request(app)
        .get('/api/torrents/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockTorrent);
      expect(mockTorrentsService.getTorrentById).toHaveBeenCalledWith('1');
    });

    it('should return 404 for non-existent torrent', async () => {
      mockTorrentsService.getTorrentById.mockRejectedValue(new Error('Torrent not found'));

      const response = await request(app)
        .get('/api/torrents/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Torrent not found');
    });
  });

  describe('GET /api/torrents/by-hash/:infoHash', () => {
    it('should get torrent by infoHash and return magnet URI', async () => {
      const infoHash = 'abc123def456ghi789jkl012mno345pqr678stu9';
      const magnetUri = 'magnet:?xt=urn:btih:abc123&dn=Test%20Torrent&tr=localhost:3000/announce';

      mockTorrentsService.getTorrentByInfoHash.mockResolvedValue(magnetUri);

      const response = await request(app)
        .get(`/api/torrents/by-hash/${infoHash}`)
        .set('Host', 'localhost:3000');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('magnetUri', magnetUri);
      expect(mockTorrentsService.getTorrentByInfoHash).toHaveBeenCalledWith(infoHash, 'localhost');
    });

    it('should return 404 for non-existent torrent hash', async () => {
      const nonExistentHash = '1234567890123456789012345678901234567890'; // Exactly 40 chars
      mockTorrentsService.getTorrentByInfoHash.mockRejectedValue(new Error('Torrent not found'));

      const response = await request(app)
        .get(`/api/torrents/by-hash/${nonExistentHash}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Torrent not found');
    });
  });

  describe('PUT /api/torrents/:id', () => {
    it('should update torrent (owner or admin)', async () => {
      const updateData = {
        name: 'Updated Torrent',
        category: 'TV Shows',
        tags: 'drama, comedy'
      };

      const mockUpdatedTorrent = {
        id: 1,
        name: 'Updated Torrent',
        uploadedById: 1
      };

      // Mock torrent ownership check
      mockTorrentsService.getTorrentById.mockResolvedValue({
        id: 1,
        uploadedById: 1
      });
      mockTorrentsService.updateTorrent.mockResolvedValue(mockUpdatedTorrent);

      const response = await request(app)
        .put('/api/torrents/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Torrent updated successfully');
      expect(response.body).toHaveProperty('torrent', mockUpdatedTorrent);
      expect(mockTorrentsService.updateTorrent).toHaveBeenCalledWith('1', updateData);
    });

    it('should deny access to update other users torrent for non-admin', async () => {
      // Mock torrent owned by different user
      mockTorrentsService.getTorrentById.mockResolvedValue({
        id: 1,
        uploadedById: 2 // Different user
      });

      const response = await request(app)
        .put('/api/torrents/1')
        .send({ name: 'Hacked Torrent' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied. You can only modify your own torrents.');
    });

    it('should allow admin to update any torrent', async () => {
      // Mock admin user
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const updateData = { name: 'Admin Updated Torrent' };
      const mockUpdatedTorrent = { id: 1, name: 'Admin Updated Torrent' };

      mockTorrentsService.getTorrentById.mockResolvedValue({
        id: 1,
        uploadedById: 2 // Different user
      });
      mockTorrentsService.updateTorrent.mockResolvedValue(mockUpdatedTorrent);

      const response = await request(app)
        .put('/api/torrents/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('torrent', mockUpdatedTorrent);
    });
  });

  describe('PATCH /api/torrents/:id', () => {
    it('should partially update torrent', async () => {
      const updateData = { name: 'Partially Updated Torrent' };
      const mockUpdatedTorrent = { id: 1, name: 'Partially Updated Torrent' };

      mockTorrentsService.getTorrentById.mockResolvedValue({
        id: 1,
        uploadedById: 1
      });
      mockTorrentsService.updateTorrent.mockResolvedValue(mockUpdatedTorrent);

      const response = await request(app)
        .patch('/api/torrents/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Torrent updated successfully');
      expect(mockTorrentsService.updateTorrent).toHaveBeenCalledWith('1', updateData);
    });
  });

  describe('DELETE /api/torrents/:id', () => {
    it('should delete torrent (owner or admin)', async () => {
      mockTorrentsService.getTorrentById.mockResolvedValue({
        id: 1,
        uploadedById: 1
      });
      mockTorrentsService.deleteTorrent.mockResolvedValue();

      const response = await request(app)
        .delete('/api/torrents/1');

      expect(response.status).toBe(204);
      expect(mockTorrentsService.deleteTorrent).toHaveBeenCalledWith('1');
    });

    it('should deny access to delete other users torrent for non-admin', async () => {
      // Reset to regular user (not admin)
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'testuser', role: 'USER' };
        next();
      });

      mockTorrentsService.getTorrentById.mockResolvedValue({
        id: 1,
        uploadedById: 2 // Different user
      });

      const response = await request(app)
        .delete('/api/torrents/1');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied. You can only modify your own torrents.');
    });

    it('should return 404 for non-existent torrent', async () => {
      mockTorrentsService.getTorrentById.mockRejectedValue(new Error('Torrent not found'));

      const response = await request(app)
        .delete('/api/torrents/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Torrent not found');
    });
  });
});