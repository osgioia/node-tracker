import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import slowDown from 'express-slow-down';
import rateLimit from 'express-rate-limit';
import { Server as TrackerServer } from 'bittorrent-tracker';

import apiRouter from './src/router.js';
import { applyTrackerFilters } from './src/tracker/tracker-filter.js';
import { HttpTracker } from './src/tracker/http-strategy.js';
import { UdpTracker } from './src/tracker/udp-strategy.js';
import { WsTracker } from './src/tracker/ws-strategy.js';

import { db } from './src/utils/db.server.js';
import './src/utils/redis.js';

import {
  securityConfig,
  validateSecurityConfig
} from './src/config/security.js';
import {
  sanitizeInput,
  validateContentType,
  validateUserAgent,
  securityLogger,
  preventEnumeration
} from './src/middleware/security.js';
import { setupMorgan, logMessage } from './src/utils/utils.js';
import { apiRateLimiter, authRateLimiter } from './src/middleware/rateLimit.js';

dotenv.config();

// ----------------- Security Config -----------------
try {
  validateSecurityConfig();
  logMessage('info', 'Security configuration validated successfully');
} catch (error) {
  logMessage('error', `Security configuration validation failed: ${error.message}`);
  process.exit(1);
}

// ----------------- Express Setup -----------------
const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: securityConfig.headers.csp.directives,
      reportUri: securityConfig.headers.csp.reportUri
    },
    hsts: securityConfig.headers.hsts,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(cors(securityConfig.cors));

// Body parsers
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try { JSON.parse(buf); } 
    catch (_e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
setupMorgan(app);

// ----------------- Global Middlewares -----------------
app.use(securityLogger);
app.use(preventEnumeration);
app.use(validateUserAgent);
app.use(validateContentType);
app.use(sanitizeInput);
app.use(slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: () => 500,
  maxDelayMs: 20000,
  validate: { delayMs: false }
}));
app.use(apiRateLimiter);
app.use(authRateLimiter);

// ----------------- Trackers -----------------
const trackerServer = new TrackerServer({
  udp: process.env.UDP === 'true',
  http: false,
  ws: process.env.WS === 'true',
  interval: Number(process.env.ANNOUNCE_INTERVAL) || 300,
  stats: process.env.STATS === 'true',
  trustProxy: process.env.TRUST_PROXY === 'true',
  filter: applyTrackerFilters
});

const trackers = [new HttpTracker(trackerServer, rateLimit({
  windowMs: 60_000,
  max: 100,
  message: 'Demasiadas solicitudes, inténtalo de nuevo más tarde.'
}))];

if (process.env.UDP === 'true') {trackers.push(new UdpTracker(trackerServer, process.env.UDP_PORT || 6969));}
if (process.env.WS === 'true') {trackers.push(new WsTracker(trackerServer));}

const httpServer = http.createServer(app);
for (const tracker of trackers) {
  if (tracker instanceof WsTracker) {tracker.start(httpServer);}
  else if (tracker instanceof HttpTracker) {tracker.start(app);}
  else if (tracker instanceof UdpTracker) {tracker.start();}
}

// ----------------- Router -----------------
app.use('/', apiRouter);

// ----------------- Error handler -----------------
app.use((err, req, res) => {
  logMessage('error', `Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error.' });
});

// ----------------- Start server -----------------
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  logMessage('info', `Express + Tracker running at http://localhost:${PORT}`);
});

// ----------------- Graceful shutdown -----------------
process.on('SIGINT', async () => {
  logMessage('info', 'Shutting down server...');
  try {
    await db.$disconnect();
    logMessage('info', 'Database disconnected.');
  } catch (error) {
    logMessage('error', `Error disconnecting database: ${error.message}`);
  }
  process.exit(0);
});
