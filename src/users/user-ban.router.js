import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Counter } from 'prom-client';
import { authMiddleware } from '../middleware/auth.js';
import {
  createUserBan,
  banUserForDays,
  banUserFor7Days,
  banUserFor15Days,
  banUserFor30Days,
  banUserPermanently,
  getUserBanById,
  getUserBans,
  getActiveUserBan,
  getAllUserBans,
  deactivateUserBan,
  isUserBanned,
  cleanupExpiredBans
} from './user-ban.service.js';

export const userBanRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: UserBans
 *   description: Gestión de baneos de usuarios
 */

const createBanCounter = new Counter({
  name: 'create_user_ban_requests',
  help: 'Count create user ban requests'
});

const getBanCounter = new Counter({
  name: 'get_user_ban_requests',
  help: 'Count get user ban requests'
});

const deactivateBanCounter = new Counter({
  name: 'deactivate_user_ban_requests',
  help: 'Count deactivate user ban requests'
});

const requireAdminOrModerator = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR') {
    return res.status(403).json({ error: 'Access denied. Administrator or Moderator role required.' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
  next();
};

const createBanValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('reason')
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Expires at must be a valid date')
];

const banForDaysValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('reason')
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters'),
  body('days')
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];

const quickBanValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('reason')
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be between 5 and 500 characters')
];

userBanRouter.use(authMiddleware);

/**
 * @swagger
 * /api/user-bans:
 *   get:
 *     summary: Listar todos los baneos de usuarios
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Límite de resultados por página
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filtrar por baneos activos
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filtrar por ID de usuario
 *       - in: query
 *         name: bannedBy
 *         schema:
 *           type: string
 *         description: Filtrar por quien aplicó el ban
 *     responses:
 *       200:
 *         description: Lista de baneos con paginación
 *       403:
 *         description: Acceso denegado
 *       500:
 *         description: Error interno del servidor
 */
userBanRouter.get('/',
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('active').optional().isBoolean().withMessage('Active must be true or false'),
  query('userId').optional().isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  query('bannedBy').optional().isString().withMessage('Banned by must be a string'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = {};
      
      if (req.query.active !== undefined) {
        filters.active = req.query.active === 'true';
      }
      if (req.query.userId) {
        filters.userId = parseInt(req.query.userId);
      }
      if (req.query.bannedBy) {
        filters.bannedBy = req.query.bannedBy;
      }
      
      const result = await getAllUserBans(page, limit, filters);
      
      getBanCounter.inc();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans:
 *   post:
 *     summary: Crear un nuevo baneo de usuario
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserBanRequest'
 *     responses:
 *       201:
 *         description: Baneo creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'User ban created successfully'
 *                 userBan:
 *                   $ref: '#/components/schemas/UserBan'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador o moderador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.post('/',
  createBanValidation,
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason, expiresAt } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await createUserBan({
        userId,
        reason,
        bannedBy,
        expiresAt
      });
      
      createBanCounter.inc();
      res.status(201).json({
        message: 'User ban created successfully',
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/quick/7-days:
 *   post:
 *     summary: Banear usuario por 7 días
 *     description: Aplica un ban temporal de 7 días a un usuario específico
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuickBanRequest'
 *     responses:
 *       201:
 *         description: Usuario baneado por 7 días exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'User banned for 7 days successfully'
 *                 userBan:
 *                   $ref: '#/components/schemas/UserBan'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador o moderador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.post('/quick/7-days',
  quickBanValidation,
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await banUserFor7Days(userId, reason, bannedBy);
      
      createBanCounter.inc();
      res.status(201).json({
        message: 'User banned for 7 days successfully',
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/quick/15-days:
 *   post:
 *     summary: Banear usuario por 15 días
 *     description: Aplica un ban temporal de 15 días a un usuario específico
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuickBanRequest'
 *     responses:
 *       201:
 *         description: Usuario baneado por 15 días exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'User banned for 15 days successfully'
 *                 userBan:
 *                   $ref: '#/components/schemas/UserBan'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador o moderador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.post('/quick/15-days',
  quickBanValidation,
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await banUserFor15Days(userId, reason, bannedBy);
      
      createBanCounter.inc();
      res.status(201).json({
        message: 'User banned for 15 days successfully',
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/quick/30-days:
 *   post:
 *     summary: Banear usuario por 30 días
 *     description: Aplica un ban temporal de 30 días a un usuario específico
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuickBanRequest'
 *     responses:
 *       201:
 *         description: Usuario baneado por 30 días exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'User banned for 30 days successfully'
 *                 userBan:
 *                   $ref: '#/components/schemas/UserBan'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador o moderador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.post('/quick/30-days',
  quickBanValidation,
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await banUserFor30Days(userId, reason, bannedBy);
      
      createBanCounter.inc();
      res.status(201).json({
        message: 'User banned for 30 days successfully',
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/quick/permanent:
 *   post:
 *     summary: Banear usuario permanentemente
 *     description: Aplica un ban permanente a un usuario específico (solo administradores)
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuickBanRequest'
 *     responses:
 *       201:
 *         description: Usuario baneado permanentemente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'User banned permanently'
 *                 userBan:
 *                   $ref: '#/components/schemas/UserBan'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.post('/quick/permanent',
  quickBanValidation,
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await banUserPermanently(userId, reason, bannedBy);
      
      createBanCounter.inc();
      res.status(201).json({
        message: 'User banned permanently',
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/custom:
 *   post:
 *     summary: Banear usuario por número personalizado de días
 *     description: Aplica un ban temporal por un número específico de días (1-365)
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomBanRequest'
 *     responses:
 *       201:
 *         description: Usuario baneado por número personalizado de días
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'User banned for 5 days successfully'
 *                 userBan:
 *                   $ref: '#/components/schemas/UserBan'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador o moderador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.post('/custom',
  banForDaysValidation,
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, reason, days } = req.body;
      const bannedBy = req.user.username;
      
      const userBan = await banUserForDays(userId, reason, bannedBy, days);
      
      createBanCounter.inc();
      res.status(201).json({
        message: `User banned for ${days} days successfully`,
        userBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/{id}:
 *   get:
 *     summary: Obtener baneo por ID
 *     description: Obtiene los detalles de un baneo específico por su ID
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del baneo
 *     responses:
 *       200:
 *         description: Detalles del baneo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserBan'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador o moderador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Baneo no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userBan = await getUserBanById(req.params.id);
      
      getBanCounter.inc();
      res.json(userBan);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/{id}/deactivate:
 *   patch:
 *     summary: Desactivar baneo (desbanear usuario)
 *     description: Desactiva un baneo específico, desbaneando al usuario si no tiene otros bans activos
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del baneo a desactivar
 *     responses:
 *       200:
 *         description: Baneo desactivado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'User ban deactivated successfully'
 *                 userBan:
 *                   $ref: '#/components/schemas/UserBan'
 *       400:
 *         description: Error de validación o baneo ya inactivo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador o moderador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Baneo no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.patch('/:id/deactivate',
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const unbannedBy = req.user.username;
      const updatedBan = await deactivateUserBan(req.params.id, unbannedBy);
      
      deactivateBanCounter.inc();
      res.json({
        message: 'User ban deactivated successfully',
        userBan: updatedBan
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/user/{userId}:
 *   get:
 *     summary: Obtener todos los baneos de un usuario específico
 *     description: Obtiene el historial completo de baneos de un usuario específico
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de baneos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserBan'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador o moderador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.get('/user/:userId',
  param('userId').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userBans = await getUserBans(req.params.userId);
      
      getBanCounter.inc();
      res.json(userBans);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/user/{userId}/active:
 *   get:
 *     summary: Obtener baneo activo de un usuario
 *     description: Obtiene el baneo activo actual de un usuario específico (si existe)
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Baneo activo del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserBan'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador o moderador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No se encontró baneo activo para este usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 'No active ban found for this user'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.get('/user/:userId/active',
  param('userId').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const activeBan = await getActiveUserBan(req.params.userId);
      
      getBanCounter.inc();
      if (activeBan) {
        res.json(activeBan);
      } else {
        res.status(404).json({ message: 'No active ban found for this user' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/user/{userId}/status:
 *   get:
 *     summary: Verificar si un usuario está baneado
 *     description: Verifica el estado de ban de un usuario específico
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Estado de ban del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserBanStatus'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador o moderador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.get('/user/:userId/status',
  param('userId').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  requireAdminOrModerator,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const isBanned = await isUserBanned(req.params.userId);
      
      getBanCounter.inc();
      res.json({
        userId: parseInt(req.params.userId),
        isBanned
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/user-bans/cleanup:
 *   post:
 *     summary: Limpiar baneos expirados (solo admin)
 *     description: Limpia automáticamente todos los baneos expirados y desbanea usuarios si no tienen otros bans activos
 *     tags: [UserBans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Limpieza de baneos completada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CleanupResult'
 *       403:
 *         description: Acceso denegado - Se requiere rol de administrador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
userBanRouter.post('/cleanup',
  requireAdmin,
  async (req, res) => {
    try {
      const result = await cleanupExpiredBans();
      
      res.json({
        message: 'Expired bans cleanup completed',
        cleaned: result.cleaned
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);