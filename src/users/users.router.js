import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Counter } from 'prom-client';
import { authMiddleware } from '../middleware/auth.js';
import {
  createUser,
  getUserById,
  getAllUsers,
  updateUser,
  toggleUserBan,
  getUserStats
} from './users.service.js';

export const usersRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Gestión de usuarios
 */

// Prometheus metrics
const getUserCounter = new Counter({
  name: 'get_users_requests',
  help: 'Count get user requests'
});

const createUserCounter = new Counter({
  name: 'create_users_requests',
  help: 'Count create user requests'
});

const updateUserCounter = new Counter({
  name: 'update_users_requests',
  help: 'Count update user requests'
});

// Middleware to verify admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
  next();
};

// Middleware to verify that user accesses their own data or is admin
const requireOwnerOrAdmin = (req, res, next) => {
  const targetUserId = parseInt(req.params.id);
  if (req.user.id !== targetUserId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  next();
};

// Validations
const createUserValidation = [
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
  body('role')
    .optional()
    .isIn(['USER', 'ADMIN', 'MODERATOR'])
    .withMessage('Invalid role'),
  body('remainingInvites')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Remaining invitations must be a positive number')
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
    .withMessage('Remaining invitations must be a positive number'),
  body('banned')
    .optional()
    .isBoolean()
    .withMessage('Banned must be true or false')
];

// Apply authentication middleware to all routes
usersRouter.use(authMiddleware);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Listar todos los usuarios (solo admin)
 *     tags: [Users]
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
 *     responses:
 *       200:
 *         description: Lista de usuarios con paginación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
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
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/users - List all users (admin only)
usersRouter.get('/',
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

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Crear un nuevo usuario (solo admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 20
 *                 pattern: '^[a-zA-Z0-9_]+$'
 *                 description: Nombre de usuario (solo letras, números y guiones bajos)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email del usuario
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Contraseña del usuario
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN, MODERATOR]
 *                 description: Rol del usuario (opcional)
 *               remainingInvites:
 *                 type: integer
 *                 minimum: 0
 *                 description: Número de invitaciones restantes (opcional)
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
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
 *       409:
 *         description: Usuario o email ya existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/users - Create new user (admin only)
usersRouter.post('/',
  createUserValidation,
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, role, remainingInvites } = req.body;
      const user = await createUser({ username, email, password, role, remainingInvites });
      
      createUserCounter.inc();
      res.status(201).json({
        message: 'User created successfully',
        user
      });
    } catch (error) {
      if (error.message === 'User or email already exists') {
        return res.status(409).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Obtener perfil del usuario actual
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario con estadísticas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     torrentsUploaded:
 *                       type: integer
 *                     totalUploaded:
 *                       type: string
 *                     totalDownloaded:
 *                       type: string
 *                     ratio:
 *                       type: number
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/users/me - Get current user profile
usersRouter.get('/me', async (req, res) => {
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

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Obtener usuario por ID (solo propio usuario o admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario con estadísticas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     torrentsUploaded:
 *                       type: integer
 *                     totalUploaded:
 *                       type: string
 *                     totalDownloaded:
 *                       type: string
 *                     ratio:
 *                       type: number
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado
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
// GET /api/users/:id - Get user by ID (only own user or admin)
usersRouter.get('/:id', 
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

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Actualizar usuario (solo propio usuario o admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 20
 *                 description: Nombre de usuario (opcional)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email del usuario (opcional)
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Nueva contraseña (opcional)
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN, MODERATOR]
 *                 description: Rol del usuario (solo admin, opcional)
 *               remainingInvites:
 *                 type: integer
 *                 minimum: 0
 *                 description: Invitaciones restantes (solo admin, opcional)
 *               banned:
 *                 type: boolean
 *                 description: Estado de ban (solo admin, opcional)
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PUT /api/users/:id - Update user (only own user or admin)
usersRouter.put('/:id',
  param('id').isInt().withMessage('ID must be a number'),
  updateUserValidation,
  requireOwnerOrAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Only admin can change role, invitations, and ban status
      if (req.user.role !== 'ADMIN') {
        delete req.body.role;
        delete req.body.remainingInvites;
        delete req.body.banned;
      }

      const updatedUser = await updateUser(req.params.id, req.body);
      
      updateUserCounter.inc();
      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Actualización parcial de usuario (ban/unban, cambio de rol, etc.) - Solo admin
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               banned:
 *                 type: boolean
 *                 description: Estado de ban del usuario (opcional)
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN, MODERATOR]
 *                 description: Nuevo rol del usuario (opcional)
 *               remainingInvites:
 *                 type: integer
 *                 minimum: 0
 *                 description: Número de invitaciones restantes (opcional)
 *               reason:
 *                 type: string
 *                 description: Razón del ban/unban (opcional)
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
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
 */
// PATCH /api/users/:id - Partial update user (for ban/unban, role changes, etc.)
usersRouter.patch('/:id',
  param('id').isInt().withMessage('ID must be a number'),
  body('banned').optional().isBoolean().withMessage('Banned must be true or false'),
  body('role').optional().isIn(['USER', 'ADMIN', 'MODERATOR']).withMessage('Invalid role'),
  body('remainingInvites').optional().isInt({ min: 0 }).withMessage('Remaining invitations must be a positive number'),
  body('reason').optional().isString().withMessage('Reason must be text'),
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { banned, reason, ...otherUpdates } = req.body;
      
      // Handle ban/unban separately if provided
      if (banned !== undefined) {
        const updatedUser = await toggleUserBan(req.params.id, banned, reason);
        return res.json({
          message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
          user: updatedUser
        });
      }

      // Handle other partial updates
      const updatedUser = await updateUser(req.params.id, otherUpdates);
      
      updateUserCounter.inc();
      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/users/{id}/statistics:
 *   get:
 *     summary: Obtener estadísticas de usuario (solo admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Estadísticas del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 torrentsUploaded:
 *                   type: integer
 *                   description: Número de torrents subidos
 *                 totalUploaded:
 *                   type: string
 *                   description: Total de datos subidos
 *                 totalDownloaded:
 *                   type: string
 *                   description: Total de datos descargados
 *                 ratio:
 *                   type: number
 *                   description: Ratio de subida/descarga
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
// GET /api/users/:id/statistics - Get user statistics (admin only)
usersRouter.get('/:id/statistics',
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