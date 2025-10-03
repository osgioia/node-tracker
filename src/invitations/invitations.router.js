import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Counter } from 'prom-client';
import { authMiddleware } from '../middleware/auth.js';
import {
  createInvitation,
  getUserInvitations,
  getAllInvitations,
  getInvitationById,
  deleteInvitation
} from './invitations.service.js';

export const invitationsRouter = express.Router();

const createInvitationCounter = new Counter({
  name: 'create_invitations_requests',
  help: 'Count invitation creations'
});

const getInvitationCounter = new Counter({
  name: 'get_invitations_requests',
  help: 'Count get invitation requests'
});

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
  next();
};

const createInvitationValidation = [
  body('email')
    .isEmail()
    .withMessage('Invalid email'),
  body('reason')
    .notEmpty()
    .withMessage('Reason required'),
  body('expiresInDays')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Expiration days must be between 1 and 30')
];

invitationsRouter.use(authMiddleware);

invitationsRouter.get('/',
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      let result;
      if (req.user.role === 'ADMIN') {
        result = await getAllInvitations(page, limit);
      } else {
        const invitations = await getUserInvitations(req.user.id);
        result = { invitations };
      }
      
      getInvitationCounter.inc();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

invitationsRouter.post('/',
  createInvitationValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, reason, expiresInDays } = req.body;
      const expires = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;
      
      const invitation = await createInvitation({
        inviterId: req.user.id,
        email,
        reason,
        expires
      });
      
      createInvitationCounter.inc();
      res.status(201).json({
        message: 'Invitation created successfully',
        invitation: {
          id: invitation.id,
          inviteKey: invitation.inviteKey,
          email: invitation.email,
          expires: invitation.expires
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

invitationsRouter.get('/:id',
  param('id').isInt().withMessage('ID must be a number'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const invitation = await getInvitationById(req.params.id);
      
      if (req.user.role !== 'ADMIN' && invitation.inviter.id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      getInvitationCounter.inc();
      res.json(invitation);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
);

invitationsRouter.delete('/:id',
  param('id').isInt().withMessage('ID must be a number'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await deleteInvitation(req.params.id, req.user.id, req.user.role);
      res.json(result);
    } catch (error) {
      if (error.message === 'Invitation not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Access denied') {
        return res.status(403).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }
);