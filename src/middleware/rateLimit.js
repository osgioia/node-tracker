import rateLimit from 'express-rate-limit';
import redisClient from '../utils/redis.js';
import { logMessage } from '../utils/utils.js';

const redisStore = (store) => ({
  incr: async (key, cb) => {
    const current = await redisClient.get(key) || 0;
    const newCount = parseInt(current) + 1;
    await redisClient.setEx(key, store.windowMs / 1000, newCount.toString());
    cb(null, newCount);
  },
  decrement: (key) => redisClient.decr(key),
  resetKey: (key) => redisClient.del(key)
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite por IP
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore({
    windowMs: 15 * 60 * 1000
  }),
  handler: (req, res) => {
    logMessage('warn', `Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Solo 5 intentos de login
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore({
    windowMs: 15 * 60 * 1000
  }),
  skip: (req) => req.method !== 'POST' || !req.path.includes('/auth/login'),
  handler: (req, res) => {
    logMessage('warn', `Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many login attempts',
      code: 'LOGIN_RATE_LIMIT_EXCEEDED'
    });
  }
});