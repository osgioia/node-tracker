import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockInvitationsService = {
  getAllInvitations: jest.fn(),
  getUserInvitations: jest.fn(),
  createInvitation: jest.fn(),
  getInvitationById: jest.fn(),
  deleteInvitation: jest.fn()
};

const mockAuthMiddleware = jest.fn((req, res, next) => {
  req.user = { id: 1, username: 'testuser', role: 'USER' };
  next();
});

jest.unstable_mockModule('../invitations.service.js', () => mockInvitationsService);
jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware
}));

jest.unstable_mockModule('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  }))
}));

const { invitationsRouter } = await import('../invitations.router.js');

describe('Invitations Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/invitations', invitationsRouter);
    jest.clearAllMocks();
    mockAuthMiddleware.mockImplementation((req, res, next) => {
      req.user = { id: 1, username: 'testuser', role: 'USER' };
      next();
    });
  });

  describe('GET /api/invitations', () => {
    it('should list all invitations for admin', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockResult = {
        invitations: [
          { id: 1, inviteKey: 'key1', inviterId: 1, used: false },
          { id: 2, inviteKey: 'key2', inviterId: 1, used: true }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1
        }
      };

      mockInvitationsService.getAllInvitations.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/invitations?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockInvitationsService.getAllInvitations).toHaveBeenCalledWith(1, 20);
    });

    it('should list only own invitations for regular user', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 2, username: 'user', role: 'USER' };
        next();
      });

      const mockInvitations = [
        { id: 1, inviteKey: 'key1', inviterId: 2, used: false }
      ];

      mockInvitationsService.getUserInvitations.mockResolvedValue(mockInvitations);

      const response = await request(app)
        .get('/api/invitations');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ invitations: mockInvitations });
      expect(mockInvitationsService.getUserInvitations).toHaveBeenCalledWith(2);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/invitations?page=0&limit=101');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle service errors', async () => {
      mockInvitationsService.getUserInvitations.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/invitations');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Service error');
    });
  });

  describe('POST /api/invitations', () => {
    it('should create invitation successfully', async () => {
      const invitationData = {
        email: 'test@example.com',
        reason: 'Friend invitation',
        expiresInDays: 7
      };

      const mockCreatedInvitation = {
        id: 1,
        inviteKey: 'inv_123_abc',
        email: 'test@example.com',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      mockInvitationsService.createInvitation.mockResolvedValue(mockCreatedInvitation);

      const response = await request(app)
        .post('/api/invitations')
        .send(invitationData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Invitation created successfully');
      expect(response.body).toHaveProperty('invitation');
      expect(mockInvitationsService.createInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          inviterId: 1,
          email: 'test@example.com',
          reason: 'Friend invitation',
          expires: expect.any(Date)
        })
      );
    });

    it('should create invitation without expiration date', async () => {
      const invitationData = {
        email: 'test@example.com',
        reason: 'Friend invitation'
      };

      const mockCreatedInvitation = {
        id: 1,
        inviteKey: 'inv_123_abc',
        email: 'test@example.com',
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      mockInvitationsService.createInvitation.mockResolvedValue(mockCreatedInvitation);

      const response = await request(app)
        .post('/api/invitations')
        .send(invitationData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('invitation');
      expect(mockInvitationsService.createInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          inviterId: 1,
          email: 'test@example.com',
          reason: 'Friend invitation',
          expires: null
        })
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/invitations')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should validate expiration date format', async () => {
      const invalidData = {
        email: 'test@example.com',
        reason: 'Friend invitation',
        expiresInDays: 50
      };

      const response = await request(app)
        .post('/api/invitations')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should not allow past expiration dates', async () => {
      const invalidData = {
        email: 'test@example.com',
        reason: 'Friend invitation',
        expiresInDays: 0
      };

      const response = await request(app)
        .post('/api/invitations')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle creation errors', async () => {
      const invitationData = {
        email: 'test@example.com',
        reason: 'Friend invitation'
      };

      mockInvitationsService.createInvitation.mockRejectedValue(new Error('Creation failed'));

      const response = await request(app)
        .post('/api/invitations')
        .send(invitationData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Creation failed');
    });
  });

  describe('GET /api/invitations/:id', () => {
    it('should get invitation by id (owner or admin)', async () => {
      const mockInvitation = {
        id: 1,
        inviteKey: 'key1',
        email: 'test@example.com',
        inviter: { id: 1, username: 'testuser' }
      };

      mockInvitationsService.getInvitationById.mockResolvedValue(mockInvitation);

      const response = await request(app)
        .get('/api/invitations/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockInvitation);
      expect(mockInvitationsService.getInvitationById).toHaveBeenCalledWith('1');
    });

    it('should deny access to other users invitations for non-admin', async () => {
      const mockInvitation = {
        id: 1,
        inviteKey: 'key1',
        email: 'test@example.com',
        inviter: { id: 2, username: 'otheruser' }
      };

      mockInvitationsService.getInvitationById.mockResolvedValue(mockInvitation);

      const response = await request(app)
        .get('/api/invitations/1');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied');
    });

    it('should allow admin to access any invitation', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      const mockInvitation = {
        id: 1,
        inviteKey: 'key1',
        email: 'test@example.com',
        inviter: { id: 2, username: 'otheruser' }
      };

      mockInvitationsService.getInvitationById.mockResolvedValue(mockInvitation);

      const response = await request(app)
        .get('/api/invitations/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockInvitation);
    });

    it('should return 404 for non-existent invitation', async () => {
      mockInvitationsService.getInvitationById.mockRejectedValue(new Error('Invitation not found'));

      const response = await request(app)
        .get('/api/invitations/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Invitation not found');
    });

    it('should validate ID parameter', async () => {
      const response = await request(app)
        .get('/api/invitations/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('DELETE /api/invitations/:id', () => {
    it('should delete invitation (owner or admin)', async () => {
      mockInvitationsService.deleteInvitation.mockResolvedValue({ message: 'Invitation deleted' });

      const response = await request(app)
        .delete('/api/invitations/1');

      expect(response.status).toBe(200);
      expect(mockInvitationsService.deleteInvitation).toHaveBeenCalledWith('1', 1, 'USER');
    });

    it('should deny access to delete other users invitations for non-admin', async () => {
      mockInvitationsService.deleteInvitation.mockRejectedValue(new Error('Access denied'));

      const response = await request(app)
        .delete('/api/invitations/1');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Access denied');
    });

    it('should allow admin to delete any invitation', async () => {
      mockAuthMiddleware.mockImplementation((req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'ADMIN' };
        next();
      });

      mockInvitationsService.deleteInvitation.mockResolvedValue({ message: 'Invitation deleted' });

      const response = await request(app)
        .delete('/api/invitations/1');

      expect(response.status).toBe(200);
      expect(mockInvitationsService.deleteInvitation).toHaveBeenCalledWith('1', 1, 'ADMIN');
    });

    it('should return 404 for non-existent invitation', async () => {
      mockInvitationsService.deleteInvitation.mockRejectedValue(new Error('Invitation not found'));

      const response = await request(app)
        .delete('/api/invitations/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Invitation not found');
    });

    it('should validate ID parameter', async () => {
      const response = await request(app)
        .delete('/api/invitations/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });
});