import express from "express";
import { searchTorrent as getTorrent, addTorrent, deleteTorrent, updateTorrent  } from "./torrent.service.js";
import { Counter } from "prom-client";

export const torrentRouter = express.Router();

const getRequestCounter = new Counter({
  name: 'get_torrents_requests',
  help: 'Count torrents downloaded'
})

const postRequestCounter = new Counter({
  name: 'create_torrents_requests',
  help: 'Count create torrent'
})

const putRequestCounter = new Counter({
  name: 'update_torrents_requests',
  help: 'Count update torrent'
})

const deleteRequestCounter = new Counter({
  name: 'deleted_torrents_requests',
  help: 'Count deleted torrents'
})

torrentRouter.get("/:infoHash", async (req, res) => {
  try {
    const { infoHash } = req.params;
    const torrent = await getTorrent(infoHash, req.hostname);
    getRequestCounter.inc();
    res.json({ magnetUri: torrent });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

torrentRouter.post("/", async (req, res) => {
  try {
    const { infoHash, name, category, tags } = req.body;
    
    // Validar campos requeridos
    if (!infoHash || !name) {
      return res.status(400).json({ error: "infoHash and name are required" });
    }
    
    const torrent = await addTorrent(infoHash, name, category, tags, req.user.id);
    postRequestCounter.inc();
    res.status(201).json({ 
      message: "Torrent added successfully",
      torrent 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

torrentRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    await updateTorrent(parseInt(id), updateData);
    putRequestCounter.inc();
    res.json({ message: "Torrent updated successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

torrentRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await deleteTorrent(parseInt(id));
    deleteRequestCounter.inc();
    res.json({ message: "Torrent deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
