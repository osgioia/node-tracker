import express from "express";
import { body, param, query, validationResult } from "express-validator";
import { Counter } from "prom-client";
import { authMiddleware } from "../middleware/auth.js";
import {
  addTorrent,
  getTorrentById,
  getTorrentByInfoHash,
  getAllTorrents,
  updateTorrent,
  deleteTorrent
} from "./torrents.service.js";

export const torrentsRouter = express.Router();

// Prometheus metrics
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

// Middleware to verify ownership or admin role
const requireOwnerOrAdmin = async (req, res, next) => {
  try {
    const torrent = await getTorrentById(req.params.id);
    if (req.user.role !== 'ADMIN' && torrent.uploadedById !== req.user.id) {
      return res.status(403).json({ error: "Access denied. You can only modify your own torrents." });
    }
    req.torrent = torrent; // Store for later use
    next();
  } catch (error) {
    res.status(404).json({ error: "Torrent not found" });
  }
};

// Validations
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
  body('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a string'),
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
  body('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a string'),
  body('anonymous')
    .optional()
    .isBoolean()
    .withMessage('Anonymous must be true or false'),
  body('freeleech')
    .optional()
    .isBoolean()
    .withMessage('Freeleech must be true or false')
];

// Apply authentication middleware to all routes
torrentsRouter.use(authMiddleware);

// GET /api/torrents - List all torrents with pagination and filters
torrentsRouter.get("/",
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isString().withMessage('Category must be a string'),
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

// POST /api/torrents - Create new torrent
torrentsRouter.post("/",
  createTorrentValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { infoHash, name, category, tags, description, size, anonymous, freeleech } = req.body;
      
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
        message: "Torrent created successfully",
        torrent
      });
    } catch (error) {
      if (error.message.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/torrents/:id - Get torrent by ID
torrentsRouter.get("/:id",
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

// GET /api/torrents/by-hash/:infoHash - Get torrent by infoHash (for tracker compatibility)
torrentsRouter.get("/by-hash/:infoHash",
  param('infoHash').isLength({ min: 40, max: 40 }).withMessage('InfoHash must be 40 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const torrent = await getTorrentByInfoHash(req.params.infoHash, req.hostname);
      
      getTorrentCounter.inc();
      res.json({ magnetUri: torrent });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
);

// PUT /api/torrents/:id - Update torrent (full update)
torrentsRouter.put("/:id",
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
        message: "Torrent updated successfully",
        torrent: updatedTorrent
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// PATCH /api/torrents/:id - Partial update torrent
torrentsRouter.patch("/:id",
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
        message: "Torrent updated successfully",
        torrent: updatedTorrent
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// DELETE /api/torrents/:id - Delete torrent
torrentsRouter.delete("/:id",
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
      res.status(204).send(); // No content for successful deletion
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);