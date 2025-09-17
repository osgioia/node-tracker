import express from 'express';
import { authMiddleware } from './middleware/auth.js';
import { usersRouter } from './users/users.router.js';
import { userBanRouter } from './users/user-ban.router.js';
import { ipBansRouter } from './ip-bans/ip-bans.router.js';
import { torrentsRouter } from './torrents/torrents.router.js';
import { invitationsRouter } from './invitations/invitations.router.js';
import { authRouter } from './auth/auth.router.js';
import { securityRouter } from './security/security.router.js';

const router = express.Router();

router.use('/api/auth', authRouter);
router.use('/api/security', securityRouter);

router.use('/api/users', usersRouter);

router.use('/api/user-bans', authMiddleware, userBanRouter);
router.use('/api/ip-bans', authMiddleware, ipBansRouter);
router.use('/api/torrents', authMiddleware, torrentsRouter);
router.use('/api/invitations', authMiddleware, invitationsRouter);

router.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method
  });
});

export default router;