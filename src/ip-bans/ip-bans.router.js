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

ipBansRouter.get('/', async (req, res) => {
  getRequestCounter.inc();
  try {
    const ipBans = await listAllIPBans(req.query);
    res.status(200).json(ipBans);
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving IP bans' });
  }
});

ipBansRouter.post('/', async (req, res) => {
  postRequestCounter.inc();
  try {
    const newIPBan = await createIPBan(req.body);
    res.status(201).json(newIPBan);
  } catch (error) {
    res.status(400).json({ error: 'Error creating IP ban.' });
  }
});

ipBansRouter.post('/bulk', async (req, res) => {
  postRequestCounter.inc();
  try {
    const result = await bulkCreateIPBans(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: 'Error creating bulk IP bans.' });
  }
});

ipBansRouter.put('/:id', async (req, res) => {
  putRequestCounter.inc();
  try {
    const updatedIPBan = await updateIPBan(req.params.id, req.body);
    res.status(200).json(updatedIPBan);
  } catch (error) {
    res.status(400).json({ error: 'Error updating IP ban.' });
  }
});

ipBansRouter.delete('/:id', async (req, res) => {
  deleteRequestCounter.inc();
  try {
    await deleteIPBan(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'Error deleting IP ban.' }); 
  }
});
