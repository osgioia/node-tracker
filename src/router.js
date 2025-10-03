import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import { usersRouter } from './users/users.router.js';
import { userBanRouter } from './users/user-ban.router.js';
import { ipBansRouter } from './ip-bans/ip-bans.router.js';
import { torrentsRouter } from './torrents/torrents.router.js';
import { invitationsRouter } from './invitations/invitations.router.js';
import { authRouter } from './auth/auth.router.js';
import { securityRouter } from './security/security.router.js';
import { register } from 'prom-client';
import { specs, swaggerUi } from './config/swagger.js';
import { db } from './utils/db.server.js';
import rateLimit from 'express-rate-limit';
import { logMessage } from './utils/utils.js';

const router = express.Router();

// Auth & security
router.use('/api/auth', authRouter);
router.use('/api/security', securityRouter);

// Users & bans
router.use('/api/users', usersRouter);
router.use('/api/user-bans', authMiddleware, userBanRouter);
router.use('/api/ip-bans', authMiddleware, ipBansRouter);

// Torrents & invitations
router.use('/api/torrents', authMiddleware, torrentsRouter);
router.use('/api/invitations', authMiddleware, invitationsRouter);

// Health check
router.get('/health', async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.status(200).send("OK");
  } catch (err) {
    logMessage("error", `Health check error: ${err.message}`);
    res.status(500).send("Database Error");
  }
});

// Metrics
router.get('/metrics', authMiddleware, async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Swagger docs
router.use(
  '/api-docs', authMiddleware,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { error: "Too many requests to API documentation" },
  }),
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Node Tracker API Documentation",
  })
);

// Not found
router.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method
  });
});

export default router;
