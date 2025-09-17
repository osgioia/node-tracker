import express from 'express';
import {
  listAllIPBans,
  createIPBan,
  updateIPBan,
  deleteIPBan,
  bulkCreateIPBans
} from './ip-bans.service.js';

import { Counter } from 'prom-client';

export const ipBansRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: IP Bans
 *   description: Gestión de IPs baneadas
 */

const getRequestCounter = new Counter({
  name: 'get_ipban_requests',
  help: 'Count get IPBans'
});

const postRequestCounter = new Counter({
  name: 'create_ipban_requests',
  help: 'Count create IPBan'
});

const putRequestCounter = new Counter({
  name: 'update_ipban_requests',
  help: 'Count update IPBan'
});

const deleteRequestCounter = new Counter({
  name: 'delete_ipban_requests',
  help: 'Count delete IPBan'
});


/**
 * @swagger
 * /api/ip-bans:
 *   get:
 *     summary: Listar todas las IPs baneadas
 *     tags: [IP Bans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Límite de resultados por página
 *     responses:
 *       200:
 *         description: Lista de IPs baneadas con paginación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ipBans:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/IPBan'
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
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
ipBansRouter.get('/', async (req, res) => {
  getRequestCounter.inc();
  try {
    const ipBans = await listAllIPBans(req.query);
    res.status(200).json(ipBans);
  } catch (error) {
    res.status(500).json({ error: 'Error to get ips' });
  }
});

/**
 * @swagger
 * /api/ip-bans:
 *   post:
 *     summary: Crear un nuevo ban de IP
 *     tags: [IP Bans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IPBanRequest'
 *     responses:
 *       201:
 *         description: IP ban creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IPBan'
 *       400:
 *         description: Error en la solicitud
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
ipBansRouter.post('/', async (req, res) => {
  postRequestCounter.inc();
  try {
    const newIPBan = await createIPBan(req.body);
    res.status(201).json(newIPBan);
  } catch (error) {
    res.status(400).json({ error: 'Error to create ip to ban.' });
  }
});

/**
 * @swagger
 * /api/ip-bans/bulk:
 *   post:
 *     summary: Crear múltiples bans de IP en lote
 *     tags: [IP Bans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/IPBanRequest'
 *     responses:
 *       201:
 *         description: IP bans creados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Número de registros creados
 *       400:
 *         description: Error en la solicitud
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
ipBansRouter.post('/bulk', async (req, res) => {
  postRequestCounter.inc();
  try {
    const result = await bulkCreateIPBans(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: 'Error to create bulk ip to ban.' });
  }
});

/**
 * @swagger
 * /api/ip-bans/{id}:
 *   put:
 *     summary: Actualizar un ban de IP existente
 *     tags: [IP Bans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ban de IP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IPBanRequest'
 *     responses:
 *       200:
 *         description: IP ban actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IPBan'
 *       400:
 *         description: Error en la solicitud
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: IP ban no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
ipBansRouter.put('/:id', async (req, res) => {
  putRequestCounter.inc();
  try {
    const updatedIPBan = await updateIPBan(req.params.id, req.body);
    res.status(200).json(updatedIPBan);
  } catch (error) {
    res.status(400).json({ error: 'Error al update ip to ban.' });
  }
});

/**
 * @swagger
 * /api/ip-bans/{id}:
 *   delete:
 *     summary: Eliminar un ban de IP
 *     tags: [IP Bans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ban de IP
 *     responses:
 *       204:
 *         description: IP ban eliminado exitosamente
 *       400:
 *         description: Error en la solicitud
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: IP ban no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
ipBansRouter.delete('/:id', async (req, res) => {
  deleteRequestCounter.inc();
  try {
    await deleteIPBan(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Error to delete ip.' }); 
  }
});
