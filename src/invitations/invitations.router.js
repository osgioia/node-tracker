import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Counter } from 'prom-client';
import { authMiddleware } from '../middleware/auth.js';
import {
  createInvitation,
  getUserInvitations,
  getAllInvitations,
  getInvitationById,
  deleteInvitation
} from './invitations.service.js';

export const invitationsRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Invitations
 *   description: Gestión de invitaciones
 */

// Prometheus metrics
const createInvitationCounter = new Counter({
  name: 'create_invitations_requests',
  help: 'Count invitation creations'
});

const getInvitationCounter = new Counter({
  name: 'get_invitations_requests',
  help: 'Count get invitation requests'
});

// Middleware to verify admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }
  next();
};

// Validations
const createInvitationValidation = [
  body('email')
    .isEmail()
    .withMessage('Invalid email'),
  body('reason')
    .notEmpty()
    .withMessage('Reason required'),
  body('expiresInDays')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Expiration days must be between 1 and 30')
];

// Apply authentication middleware to all routes
invitationsRouter.use(authMiddleware);

/**
 * @swagger
 * /api/invitations:
 *   get:
 *     summary: Obtener invitaciones propias o todas las invitaciones (admin)
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página (solo para admin)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Límite de resultados por página (solo para admin)
 *     responses:
 *       200:
 *         description: Lista de invitaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invitations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       inviteKey:
 *                         type: string
 *                       email:
 *                         type: string
 *                       reason:
 *                         type: string
 *                       expires:
 *                         type: string
 *                         format: date-time
 *                       used:
 *                         type: boolean
 *                       inviter:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           username:
 *                             type: string
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
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/invitations - Get user's own invitations or all invitations (admin)
invitationsRouter.get('/',
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      let result;
      if (req.user.role === 'ADMIN') {
        // Admin can see all invitations
        result = await getAllInvitations(page, limit);
      } else {
        // Regular users see only their own invitations
        const invitations = await getUserInvitations(req.user.id);
        result = { invitations };
      }
      
      getInvitationCounter.inc();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/invitations:
 *   post:
 *     summary: Crear una nueva invitación
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - reason
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email del invitado
 *               reason:
 *                 type: string
 *                 description: Razón de la invitación
 *               expiresInDays:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 30
 *                 description: Días hasta que expire la invitación (opcional, por defecto 7)
 *     responses:
 *       201:
 *         description: Invitación creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 invitation:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     inviteKey:
 *                       type: string
 *                     email:
 *                       type: string
 *                     expires:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Error de validación o usuario sin invitaciones restantes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/invitations - Create new invitation
invitationsRouter.post('/',
  createInvitationValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, reason, expiresInDays } = req.body;
      const expires = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;
      
      const invitation = await createInvitation({
        inviterId: req.user.id,
        email,
        reason,
        expires
      });
      
      createInvitationCounter.inc();
      res.status(201).json({
        message: 'Invitation created successfully',
        invitation: {
          id: invitation.id,
          inviteKey: invitation.inviteKey,
          email: invitation.email,
          expires: invitation.expires
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/invitations/{id}:
 *   get:
 *     summary: Obtener invitación por ID (solo propietario o admin)
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la invitación
 *     responses:
 *       200:
 *         description: Invitación encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 inviteKey:
 *                   type: string
 *                 email:
 *                   type: string
 *                 reason:
 *                   type: string
 *                 expires:
 *                   type: string
 *                   format: date-time
 *                 used:
 *                   type: boolean
 *                 inviter:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
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
 *         description: Invitación no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/invitations/:id - Get invitation by ID
invitationsRouter.get('/:id',
  param('id').isInt().withMessage('ID must be a number'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const invitation = await getInvitationById(req.params.id);
      
      // Only admin or invitation owner can view
      if (req.user.role !== 'ADMIN' && invitation.inviter.id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      getInvitationCounter.inc();
      res.json(invitation);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/invitations/{id}:
 *   delete:
 *     summary: Eliminar invitación (solo propietario o admin)
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la invitación
 *     responses:
 *       200:
 *         description: Invitación eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
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
 *         description: Invitación no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// DELETE /api/invitations/:id - Delete invitation
invitationsRouter.delete('/:id',
  param('id').isInt().withMessage('ID must be a number'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await deleteInvitation(req.params.id, req.user.id, req.user.role);
      res.json(result);
    } catch (error) {
      if (error.message === 'Invitation not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Access denied') {
        return res.status(403).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }
);