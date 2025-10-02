import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import cors from 'cors';
import { Server as TrackerServer } from 'bittorrent-tracker';
import { HttpTracker } from './src/tracker/http-strategy.js';
import { UdpTracker } from './src/tracker/udp-strategy.js';
import { WsTracker } from './src/tracker/ws-strategy.js';
import { applyTrackerFilters } from './src/tracker/tracker-filter.js';
import rateLimit from 'express-rate-limit';
import { register } from 'prom-client';
import apiRouter from './src/router.js';
import { specs, swaggerUi } from './src/config/swagger.js';
import { db } from './src/utils/db.server.js';
import { apiRateLimiter, authRateLimiter } from './src/middleware/rateLimit.js';
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

dotenv.config();

try {
  validateSecurityConfig();
  logMessage('info', 'Security configuration validated successfully');
} catch (error) {
  logMessage('error', `Security configuration validation failed: ${error.message}`);
  process.exit(1);
}

const app = express();

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

app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

setupMorgan(app);

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: () => 500,
  maxDelayMs: 20000,
  validate: { delayMs: false }
});

const trackerRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  message: 'Demasiadas solicitudes, inténtalo de nuevo más tarde.'
});

const trackerServer = new TrackerServer({
  udp: process.env.UDP === 'true',
  http: false,  
  ws: process.env.WS === 'true',
  interval: Number(process.env.ANNOUNCE_INTERVAL) || 300,
  stats: process.env.STATS === 'true',
  trustProxy: process.env.TRUST_PROXY === 'true',
  filter: applyTrackerFilters
});

const trackers = [];

trackers.push(new HttpTracker(trackerServer, trackerRateLimiter));
if (process.env.UDP === 'true') {
  trackers.push(new UdpTracker({ server: trackerServer }));
}
if (process.env.WS === 'true') {
  trackers.push(new WsTracker({ server: trackerServer }));
}

const httpServer = http.createServer(app);

for (const tracker of trackers) {
  if (tracker instanceof WsTracker) tracker.start(httpServer);
  else if (tracker instanceof HttpTracker) tracker.start(app);
  else if (tracker instanceof UdpTracker) tracker.start();
}

app.use(securityLogger);
app.use(preventEnumeration);
app.use(validateUserAgent);
app.use(validateContentType);
app.use(sanitizeInput);

app.use(speedLimiter);
app.use(apiRateLimiter);
app.use(authRateLimiter);

app.use('/api-docs', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests to API documentation' }
}), swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Node Tracker API Documentation'
}));


app.get('/health', async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.status(200).send('OK');
  } catch (err) {
    logMessage('error', `Error en health check: ${err.message}`);
    res.status(500).send('Database Error');
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/', apiRouter);

app.use((err, req, res, next) => {
  logMessage('error', `Error no manejado: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error.' });
});


const expressPort = process.env.PORT || 3000;
httpServer.listen(expressPort, () => {
  logMessage('info', `Express + Tracker running at http://localhost:${expressPort}`);
});

process.on('SIGINT', async () => {
  logMessage('info', 'Cerrando servidor...');
  try {
    await db.$disconnect();
    logMessage('info', 'Base de datos desconectada.');
  } catch (error) {
    logMessage('error', `Error al desconectar la base de datos: ${error.message}`);
  }
  process.exit(0);
});
