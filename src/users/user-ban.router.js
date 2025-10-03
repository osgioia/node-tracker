import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Counter } from 'prom-client';
import { authMiddleware } from '../middleware/auth.js';
import {
  createUserBan,
  banUserForDays,
  banUserFor7Days,
  banUserFor15Days,
  banUserFor30Days,
  banUserPermanently,
  getUserBanById,
  getUserBans,
  getActiveUserBan,
  getAllUserBans,
  deactivateUserBan,
  isUserBanned,
  cleanupExpiredBans
} from './user-ban.service.js';

export const userBanRouter = express.Router();

const createBanCounter = new Counter({
  name: 'create_user_ban_requests',
  help: 'Count create user ban requests'
});

const getBanCounter = new Counter({
  name: 'get_user_ban_requests',
  help: 'Count get user ban requests'
});

const deactivateBanCounter = new Counter({
  name: 'deactivate_user_ban_requests',
  help: 'Count deactivate user ban requests'
});

const requireAdminOrModerator = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR') {
    return res.status(403).json({ error: 'Access denied. Administrator or Moderator role required.' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
  next();
};

const createBanValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('reason')
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expires at must be a valid date')
];

const banForDaysValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('reason')
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters'),
  body('days')
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];

const quickBanValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('reason')
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters')
];

userBanRouter.use(authMiddleware);

userBanRouter.get('/',
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('active').optional().isBoolean().withMessage('Active must be true or false'),
  query('userId').optional().isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  query('bannedBy').optional().isString().withMessage('Banned by must be a string'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = {};
      
      if (req.query.active !== undefined) {
        filters.active = req.query.active === 'true';
      }
      if (req.query.userId) {
        filters.userId = parseInt(req.query.userId);
      }
      if (req.query.bannedBy) {
        filters.bannedBy = req.query.bannedBy;
      }
      
      const result = await getAllUserBans(page, limit, filters);
      
      getBanCounter.inc();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

userBanRouter.post('/',
  createBanValidation,
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason, expiresAt } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await createUserBan({
        userId,
        reason,
        bannedBy,
        expiresAt
      });
      
      createBanCounter.inc();
      res.status(201).json({
        message: 'User ban created successfully',
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

userBanRouter.post('/quick/7-days',
  quickBanValidation,
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await banUserFor7Days(userId, reason, bannedBy);
      
      createBanCounter.inc();
      res.status(201).json({
        message: 'User banned for 7 days successfully',
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

userBanRouter.post('/quick/15-days',
  quickBanValidation,
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await banUserFor15Days(userId, reason, bannedBy);
      
      createBanCounter.inc();
      res.status(201).json({
        message: 'User banned for 15 days successfully',
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

userBanRouter.post('/quick/30-days',
  quickBanValidation,
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await banUserFor30Days(userId, reason, bannedBy);
      
      createBanCounter.inc();
      res.status(201).json({
        message: 'User banned for 30 days successfully',
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

userBanRouter.post('/quick/permanent',
  quickBanValidation,
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await banUserPermanently(userId, reason, bannedBy);
      
      createBanCounter.inc();
      res.status(201).json({
        message: 'User banned permanently',
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

userBanRouter.post('/custom',
  banForDaysValidation,
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason, days } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await banUserForDays(userId, reason, bannedBy, days);
      
      createBanCounter.inc();
      res.status(201).json({
        message: `User banned for ${days} days successfully`,
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

userBanRouter.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userBan = await getUserBanById(req.params.id);
      
      getBanCounter.inc();
      res.json(userBan);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
);

userBanRouter.patch('/:id/deactivate',
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const unbannedBy = req.user.username;
      const updatedBan = await deactivateUserBan(req.params.id, unbannedBy);
      
      deactivateBanCounter.inc();
      res.json({
        message: 'User ban deactivated successfully',
        userBan: updatedBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

userBanRouter.get('/user/:userId',
  param('userId').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userBans = await getUserBans(req.params.userId);
      
      getBanCounter.inc();
      res.json(userBans);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

userBanRouter.get('/user/:userId/active',
  param('userId').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const activeBan = await getActiveUserBan(req.params.userId);
      
      getBanCounter.inc();
      if (activeBan) {
        res.json(activeBan);
      } else {
        res.status(404).json({ message: 'No active ban found for this user' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

userBanRouter.get('/user/:userId/status',
  param('userId').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const isBanned = await isUserBanned(req.params.userId);
      
      getBanCounter.inc();
      res.json({
        userId: parseInt(req.params.userId),
        isBanned
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

userBanRouter.post('/cleanup',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await cleanupExpiredBans();
      
      res.json({
        message: 'Expired bans cleanup completed',
        cleaned: result.cleaned
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);