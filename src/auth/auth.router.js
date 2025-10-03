import express from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth.js';
import { blocklistToken } from './auth.service.js';
import { logMessage } from '../utils/utils.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

export const authRouter = express.Router();

authRouter.post('/login', authRateLimiter, async (req, res) => {
  res.status(501).json({ message: 'Login endpoint not implemented' });
});

authRouter.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { token } = req;
    const decoded = jwt.decode(token);

    if (decoded && decoded.exp) {
      await blocklistToken(token, decoded.exp);
    }

    logMessage('info', `User ${req.user.username} logged out successfully.`);
    res.status(200).json({ message: 'Successfully logged out' });
  } catch (error) {
    logMessage('error', `Error during logout: ${error.message}`);
    res.status(500).json({ error: 'An error occurred during logout' });
  }
});