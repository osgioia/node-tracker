import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../utils/redis.js';
import { logMessage } from '../utils/utils.js';

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, 
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args)
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
  max: 5, 
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args)
  }),
  handler: (req, res) => {
    logMessage('warn', `Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many login attempts',
      code: 'LOGIN_RATE_LIMIT_EXCEEDED'
    });
  }
});