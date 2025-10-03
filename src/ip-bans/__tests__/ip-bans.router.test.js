import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockIPBansService = {
  listAllIPBans: jest.fn(),
  createIPBan: jest.fn(),
  updateIPBan: jest.fn(),
  deleteIPBan: jest.fn(),
  bulkCreateIPBans: jest.fn()
};

const mockPrometheus = {
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  }))
};

jest.unstable_mockModule('../ip-bans.service.js', () => mockIPBansService);
jest.unstable_mockModule('prom-client', () => mockPrometheus);

const { ipBansRouter } = await import('../ip-bans.router.js');

describe('IP Bans Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/ip-bans', ipBansRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/ip-bans', () => {
    it('should list all IP bans', async () => {
      const mockBans = {
        ipBans: [
          { id: 1, fromIP: '3232235777', toIP: '3232235777', reason: 'Spam' },
          { id: 2, fromIP: '167772161', toIP: '167772415', reason: 'Abuse' }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1
        }
      };

      mockIPBansService.listAllIPBans.mockResolvedValue(mockBans);

      const response = await request(app)
        .get('/api/ip-bans');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBans);
      expect(mockIPBansService.listAllIPBans).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockIPBansService.listAllIPBans.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/ip-bans');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Error retrieving IP bans');
    });
  });

  describe('POST /api/ip-bans', () => {
    it('should create single IP ban successfully', async () => {
      const ipBanData = {
        fromIP: '3232235777',
        toIP: '3232235777',
        reason: 'Spam activity'
      };

      const mockCreatedIPBan = {
        id: 1,
        ...ipBanData,
        created: new Date().toISOString()
      };

      mockIPBansService.createIPBan.mockResolvedValue(mockCreatedIPBan);

      const response = await request(app)
        .post('/api/ip-bans')
        .send(ipBanData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockCreatedIPBan);
      expect(mockIPBansService.createIPBan).toHaveBeenCalledWith(ipBanData);
    });

    it('should handle creation errors', async () => {
      const ipBanData = {
        fromIP: '3232235777',
        toIP: '3232235777',
        reason: 'Spam activity'
      };

      mockIPBansService.createIPBan.mockRejectedValue(new Error('Creation failed'));

      const response = await request(app)
        .post('/api/ip-bans')
        .send(ipBanData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Error creating IP ban.');
    });
  });

  describe('POST /api/ip-bans/bulk', () => {
    it('should create bulk IP bans successfully', async () => {
      const ipBansData = [
        { fromIP: '3232235777', toIP: '3232236031', reason: 'Spam network' },
        { fromIP: '167772161', toIP: '184549375', reason: 'Corporate network' }
      ];

      const mockResult = { count: 2 };

      mockIPBansService.bulkCreateIPBans.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/ip-bans/bulk')
        .send(ipBansData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockResult);
      expect(mockIPBansService.bulkCreateIPBans).toHaveBeenCalledWith(ipBansData);
    });

    it('should handle bulk creation errors', async () => {
      const ipBansData = [
        { fromIP: '3232235777', toIP: '3232236031', reason: 'Spam network' }
      ];

      mockIPBansService.bulkCreateIPBans.mockRejectedValue(new Error('Bulk creation failed'));

      const response = await request(app)
        .post('/api/ip-bans/bulk')
        .send(ipBansData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Error creating bulk IP bans.');
    });
  });

  describe('PUT /api/ip-bans/:id', () => {
    it('should update IP ban successfully', async () => {
      const updateData = {
        fromIP: '3232235778',
        toIP: '3232235778',
        reason: 'Updated reason'
      };

      const mockUpdatedIPBan = {
        id: 1,
        ...updateData
      };

      mockIPBansService.updateIPBan.mockResolvedValue(mockUpdatedIPBan);

      const response = await request(app)
        .put('/api/ip-bans/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUpdatedIPBan);
      expect(mockIPBansService.updateIPBan).toHaveBeenCalledWith('1', updateData);
    });

    it('should handle update errors', async () => {
      const updateData = {
        fromIP: '3232235778',
        toIP: '3232235778',
        reason: 'Updated reason'
      };

      mockIPBansService.updateIPBan.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put('/api/ip-bans/1')
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Error updating IP ban.');
    });
  });

  describe('DELETE /api/ip-bans/:id', () => {
    it('should delete IP ban successfully', async () => {
      mockIPBansService.deleteIPBan.mockResolvedValue();

      const response = await request(app)
        .delete('/api/ip-bans/1');

      expect(response.status).toBe(204);
      expect(mockIPBansService.deleteIPBan).toHaveBeenCalledWith('1');
    });

    it('should handle deletion errors', async () => {
      mockIPBansService.deleteIPBan.mockRejectedValue(new Error('Deletion failed'));

      const response = await request(app)
        .delete('/api/ip-bans/1');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Error deleting IP ban.');
    });
  });
});