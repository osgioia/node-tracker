import express from "express";
import { body, param, query, validationResult } from "express-validator";
import { Counter } from "prom-client";
import { authMiddleware } from "../middleware/auth.js";
import {
  createUser,
  authenticateUser,
  getUserById,
  getAllUsers,
  updateUser,
  toggleUserBan,
  createInvite,
  getUserStats
} from "./user.service.js";

export const userRouter = express.Router();

// Prometheus metrics
const registerCounter = new Counter({
  name: 'user_register_requests',
  help: 'Count user registrations'
});

const loginCounter = new Counter({
  name: 'user_login_requests',
  help: 'Count user logins'
});

const getUserCounter = new Counter({
  name: 'get_user_requests',
  help: 'Count get user requests'
});

const updateUserCounter = new Counter({
  name: 'update_user_requests',
  help: 'Count update user requests'
});

const inviteCounter = new Counter({
  name: 'create_invite_requests',
  help: 'Count invite creations'
});

// Middleware to verify admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: "Access denied. Administrator role required." });
  }
  next();
};

// Middleware to verify that user accesses their own data or is admin
const requireOwnerOrAdmin = (req, res, next) => {
  const targetUserId = parseInt(req.params.id);
  if (req.user.id !== targetUserId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: "Access denied." });
  }
  next();
};

// Validations
const registerValidation = [
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
  body('inviteKey')
    .optional()
    .isString()
    .withMessage('Invalid invitation key')
];

const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username or email required'),
  body('password')
    .notEmpty()
    .withMessage('Password required')
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
    .withMessage('Remaining invitations must be a positive number')
];

const createInviteValidation = [
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

// Public routes (no authentication required)

// User registration
userRouter.post("/register", registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, inviteKey } = req.body;
    const user = await createUser({ username, email, password, inviteKey });
    
    registerCounter.inc();
    res.status(201).json({
      message: "User created successfully",
      user
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// User login
userRouter.post("/login", loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    const result = await authenticateUser(username, password);
    
    loginCounter.inc();
    res.json({
      message: "Login successful",
      ...result
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Apply authentication middleware to protected routes
userRouter.use(authMiddleware);

// Protected routes (require authentication)

// Get current user profile
userRouter.get("/profile", async (req, res) => {
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

// Get user by ID (only own user or admin)
userRouter.get("/:id", 
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

// Update user (only own user or admin)
userRouter.put("/:id",
  param('id').isInt().withMessage('ID must be a number'),
  updateUserValidation,
  requireOwnerOrAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Only admin can change role and invitations
      if (req.user.role !== 'ADMIN') {
        delete req.body.role;
        delete req.body.remainingInvites;
        delete req.body.banned;
      }

      const updatedUser = await updateUser(req.params.id, req.body);
      
      updateUserCounter.inc();
      res.json({
        message: "User updated successfully",
        user: updatedUser
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Create invitation
userRouter.post("/invite",
  createInviteValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, reason, expiresInDays } = req.body;
      const invite = await createInvite(req.user.id, email, reason, expiresInDays);
      
      inviteCounter.inc();
      res.status(201).json({
        message: "Invitation created successfully",
        invite: {
          id: invite.id,
          inviteKey: invite.inviteKey,
          email: invite.email,
          expires: invite.expires
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Administrator routes

// List all users (admin only)
userRouter.get("/",
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

// Ban/unban user (admin only)
userRouter.patch("/:id/ban",
  param('id').isInt().withMessage('ID must be a number'),
  body('banned').isBoolean().withMessage('Banned must be true or false'),
  body('reason').optional().isString().withMessage('Reason must be text'),
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { banned, reason } = req.body;
      const updatedUser = await toggleUserBan(req.params.id, banned, reason);
      
      res.json({
        message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
        user: updatedUser
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Get specific user statistics (admin only)
userRouter.get("/:id/stats",
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