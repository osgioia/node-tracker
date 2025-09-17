import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Counter } from 'prom-client';
import { authMiddleware } from '../middleware/auth.js';
import {
  addTorrent,
  getTorrentById,
  getTorrentByInfoHash,
  getAllTorrents,
  updateTorrent,
  deleteTorrent
} from './torrents.service.js';

export const torrentsRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Torrents
 *   description: Gestión de torrents
 */

const getTorrentCounter = new Counter({
  name: 'get_torrents_requests',
  help: 'Count torrents retrieved'
});

const createTorrentCounter = new Counter({
  name: 'create_torrents_requests',
  help: 'Count torrents created'
});

const updateTorrentCounter = new Counter({
  name: 'update_torrents_requests',
  help: 'Count torrents updated'
});

const deleteTorrentCounter = new Counter({
  name: 'delete_torrents_requests',
  help: 'Count torrents deleted'
});

const requireOwnerOrAdmin = async (req, res, next) => {
  try {
    const torrent = await getTorrentById(req.params.id);
    if (req.user.role !== 'ADMIN' && torrent.uploadedById !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied. You can only modify your own torrents.'
      });
    }
    req.torrent = torrent;
    next();
  } catch (error) {
    res.status(404).json({ error: 'Torrent not found' });
  }
};


const createTorrentValidation = [
  body('infoHash')
    .notEmpty()
    .withMessage('InfoHash is required')
    .isLength({ min: 40, max: 40 })
    .withMessage('InfoHash must be 40 characters long'),
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  body('tags').optional().isString().withMessage('Tags must be a string'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),
  body('size')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Size must be a positive number'),
  body('anonymous')
    .optional()
    .isBoolean()
    .withMessage('Anonymous must be true or false'),
  body('freeleech')
    .optional()
    .isBoolean()
    .withMessage('Freeleech must be true or false')
];

const updateTorrentValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),
  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  body('tags').optional().isString().withMessage('Tags must be a string'),
  body('anonymous')
    .optional()
    .isBoolean()
    .withMessage('Anonymous must be true or false'),
  body('freeleech')
    .optional()
    .isBoolean()
    .withMessage('Freeleech must be true or false')
];

torrentsRouter.use(authMiddleware);

/**
 * @swagger
 * /api/torrents:
 *   get:
 *     summary: Listar todos los torrents con paginación y filtros
 *     tags: [Torrents]
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
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por categoría
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar en nombre y descripción
 *     responses:
 *       200:
 *         description: Lista de torrents con paginación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 torrents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Torrent'
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
torrentsRouter.get(
  '/',
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive number'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  query('search').optional().isString().withMessage('Search must be a string'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const { category, search } = req.query;

      const result = await getAllTorrents(page, limit, { category, search });

      getTorrentCounter.inc();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/torrents:
 *   post:
 *     summary: Crear un nuevo torrent
 *     tags: [Torrents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - infoHash
 *               - name
 *             properties:
 *               infoHash:
 *                 type: string
 *                 minLength: 40
 *                 maxLength: 40
 *                 description: Hash único del torrent (40 caracteres)
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Nombre del torrent
 *               category:
 *                 type: string
 *                 description: Categoría del torrent (opcional)
 *               tags:
 *                 type: string
 *                 description: Tags del torrent separados por comas (opcional)
 *               description:
 *                 type: string
 *                 description: Descripción del torrent (opcional)
 *               size:
 *                 type: integer
 *                 minimum: 0
 *                 description: Tamaño en bytes (opcional)
 *               anonymous:
 *                 type: boolean
 *                 description: Si el torrent es anónimo (opcional)
 *               freeleech:
 *                 type: boolean
 *                 description: Si el torrent es freeleech (opcional)
 *     responses:
 *       201:
 *         description: Torrent creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 torrent:
 *                   $ref: '#/components/schemas/Torrent'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Torrent ya existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
torrentsRouter.post('/', createTorrentValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      infoHash,
      name,
      category,
      tags,
      description,
      size,
      anonymous,
      freeleech
    } = req.body;

    const torrent = await addTorrent({
      infoHash,
      name,
      category,
      tags,
      description,
      size,
      anonymous,
      freeleech,
      uploadedById: req.user.id
    });

    createTorrentCounter.inc();
    res.status(201).json({
      message: 'Torrent created successfully',
      torrent
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/torrents/{id}:
 *   get:
 *     summary: Obtener torrent por ID
 *     tags: [Torrents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del torrent
 *     responses:
 *       200:
 *         description: Torrent encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Torrent'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Torrent no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
torrentsRouter.get(
  '/:id',
  param('id').isInt().withMessage('ID must be a number'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const torrent = await getTorrentById(req.params.id);

      getTorrentCounter.inc();
      res.json(torrent);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/torrents/by-hash/{infoHash}:
 *   get:
 *     summary: Obtener torrent por infoHash (compatibilidad con tracker)
 *     tags: [Torrents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: infoHash
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 40
 *           maxLength: 40
 *         description: InfoHash del torrent (40 caracteres)
 *     responses:
 *       200:
 *         description: Magnet URI del torrent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 magnetUri:
 *                   type: string
 *                   description: URI magnético del torrent
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Torrent no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
torrentsRouter.get(
  '/by-hash/:infoHash',
  param('infoHash')
    .isLength({ min: 40, max: 40 })
    .withMessage('InfoHash must be 40 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const torrent = await getTorrentByInfoHash(
        req.params.infoHash,
        req.hostname
      );

      getTorrentCounter.inc();
      res.json({ magnetUri: torrent });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/torrents/{id}:
 *   put:
 *     summary: Actualizar torrent completo (solo propietario o admin)
 *     tags: [Torrents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del torrent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Nombre del torrent (opcional)
 *               description:
 *                 type: string
 *                 description: Descripción del torrent (opcional)
 *               category:
 *                 type: string
 *                 description: Categoría del torrent (opcional)
 *               tags:
 *                 type: string
 *                 description: Tags del torrent (opcional)
 *               anonymous:
 *                 type: boolean
 *                 description: Si el torrent es anónimo (opcional)
 *               freeleech:
 *                 type: boolean
 *                 description: Si el torrent es freeleech (opcional)
 *     responses:
 *       200:
 *         description: Torrent actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 torrent:
 *                   $ref: '#/components/schemas/Torrent'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Solo propietario o admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Torrent no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
torrentsRouter.put(
  '/:id',
  param('id').isInt().withMessage('ID must be a number'),
  updateTorrentValidation,
  requireOwnerOrAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updatedTorrent = await updateTorrent(req.params.id, req.body);

      updateTorrentCounter.inc();
      res.json({
        message: 'Torrent updated successfully',
        torrent: updatedTorrent
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/torrents/{id}:
 *   patch:
 *     summary: Actualización parcial de torrent (solo propietario o admin)
 *     tags: [Torrents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del torrent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Nombre del torrent (opcional)
 *               description:
 *                 type: string
 *                 description: Descripción del torrent (opcional)
 *               category:
 *                 type: string
 *                 description: Categoría del torrent (opcional)
 *               tags:
 *                 type: string
 *                 description: Tags del torrent (opcional)
 *               anonymous:
 *                 type: boolean
 *                 description: Si el torrent es anónimo (opcional)
 *               freeleech:
 *                 type: boolean
 *                 description: Si el torrent es freeleech (opcional)
 *     responses:
 *       200:
 *         description: Torrent actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 torrent:
 *                   $ref: '#/components/schemas/Torrent'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Solo propietario o admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Torrent no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
torrentsRouter.patch(
  '/:id',
  param('id').isInt().withMessage('ID must be a number'),
  updateTorrentValidation,
  requireOwnerOrAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updatedTorrent = await updateTorrent(req.params.id, req.body);

      updateTorrentCounter.inc();
      res.json({
        message: 'Torrent updated successfully',
        torrent: updatedTorrent
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /api/torrents/{id}:
 *   delete:
 *     summary: Eliminar torrent (solo propietario o admin)
 *     tags: [Torrents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del torrent
 *     responses:
 *       204:
 *         description: Torrent eliminado exitosamente
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado - Solo propietario o admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Torrent no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
torrentsRouter.delete(
  '/:id',
  param('id').isInt().withMessage('ID must be a number'),
  requireOwnerOrAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      await deleteTorrent(req.params.id);

      deleteTorrentCounter.inc();
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);
