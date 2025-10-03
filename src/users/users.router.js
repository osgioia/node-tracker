import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Counter } from 'prom-client';
import { authMiddleware } from '../middleware/auth.js';
import {
  createUser,
  getUserById,
  getAllUsers,
  updateUser,
  toggleUserBan,
  getUserStats
} from './users.service.js';

export const usersRouter = express.Router();

// Prometheus metrics
const getUserCounter = new Counter({
  name: 'get_users_requests',
  help: 'Count get user requests'
});

const createUserCounter = new Counter({
  name: 'create_users_requests',
  help: 'Count create user requests'
});

const updateUserCounter = new Counter({
  name: 'update_users_requests',
  help: 'Count update user requests'
});

// Middleware to verify admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
  next();
};

// Middleware to verify that user accesses their own data or is admin
const requireOwnerOrAdmin = (req, res, next) => {
  const targetUserId = parseInt(req.params.id);
  if (req.user.id !== targetUserId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  next();
};

// Validations
const createUserValidation = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),
  body('email')
    .isEmail()
    .withMessage('Invalid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['USER', 'ADMIN', 'MODERATOR'])
    .withMessage('Invalid role'),
  body('remainingInvites')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Remaining invitations must be a positive number')
];

const updateUserValidation = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['USER', 'ADMIN', 'MODERATOR'])
    .withMessage('Invalid role'),
  body('remainingInvites')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Remaining invitations must be a positive number'),
  body('banned')
    .optional()
    .isBoolean()
    .withMessage('Banned must be true or false')
];

usersRouter.use(authMiddleware);

// GET /api/users - List all users (admin only)
usersRouter.get('/',
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      const result = await getAllUsers(page, limit);
      
      getUserCounter.inc();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/users - Create new user (admin only)
usersRouter.post('/',
  createUserValidation,
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, role, remainingInvites } = req.body;
      const user = await createUser({ username, email, password, role, remainingInvites });
      
      createUserCounter.inc();
      res.status(201).json({
        message: 'User created successfully',
        user
      });
    } catch (error) {
      if (error.message === 'User or email already exists') {
        return res.status(409).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/users/me - Get current user profile
usersRouter.get('/me', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    const stats = await getUserStats(req.user.id);
    
    getUserCounter.inc();
    res.json({
      user,
      stats
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// GET /api/users/:id - Get user by ID (only own user or admin)
usersRouter.get('/:id', 
  param('id').isInt().withMessage('ID must be a number'),
  requireOwnerOrAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await getUserById(req.params.id);
      const stats = await getUserStats(req.params.id);
      
      getUserCounter.inc();
      res.json({
        user,
        stats
      });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
);

// PUT /api/users/:id - Update user (only own user or admin)
usersRouter.put('/:id',
  param('id').isInt().withMessage('ID must be a number'),
  updateUserValidation,
  requireOwnerOrAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Only admin can change role, invitations, and ban status
      if (req.user.role !== 'ADMIN') {
        delete req.body.role;
        delete req.body.remainingInvites;
        delete req.body.banned;
      }

      const updatedUser = await updateUser(req.params.id, req.body);
      
      updateUserCounter.inc();
      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// PATCH /api/users/:id - Partial update user (for ban/unban, role changes, etc.)
usersRouter.patch('/:id',
  param('id').isInt().withMessage('ID must be a number'),
  body('banned').optional().isBoolean().withMessage('Banned must be true or false'),
  body('role').optional().isIn(['USER', 'ADMIN', 'MODERATOR']).withMessage('Invalid role'),
  body('remainingInvites').optional().isInt({ min: 0 }).withMessage('Remaining invitations must be a positive number'),
  body('reason').optional().isString().withMessage('Reason must be text'),
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { banned, reason, ...otherUpdates } = req.body;
      
      if (banned !== undefined) {
        const updatedUser = await toggleUserBan(req.params.id, banned, reason);
        return res.json({
          message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
          user: updatedUser
        });
      }

      const updatedUser = await updateUser(req.params.id, otherUpdates);
      
      updateUserCounter.inc();
      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/users/:id/statistics - Get user statistics (admin only)
usersRouter.get('/:id/statistics',
  param('id').isInt().withMessage('ID must be a number'),
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const stats = await getUserStats(req.params.id);
      res.json(stats);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
);