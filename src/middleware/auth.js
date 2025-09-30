import jwt from 'jsonwebtoken';
import { getUserById } from '../users/users.service.js';
import { isTokenBlocklisted } from '../auth/auth.service.js';
import { logMessage } from '../utils/utils.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    if (await isTokenBlocklisted(token)) {
      logMessage('warn', `Attempt to use a blocklisted token from IP: ${req.ip}`);
      return res.status(401).json({ error: 'Token has been invalidated. Please log in again.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await getUserById(decoded.id);
    if (!user || user.banned) {
      return res.status(401).json({ error: 'User not found or is banned' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    logMessage('warn', `Invalid token provided: ${error.message}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};