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

torrentRouter.get("/", async (req, res) => {
  const { infoHash } = req.query;
  const torrent = await getTorrent(infoHash, req.hostname);
  getRequestCounter.inc();
  res.download(torrent);
});

torrentRouter.post("/", async (req, res) => {
  const { infoHash, name, category, tags } = req.body;
  
  await addTorrent(infoHash, name, category, tags);
  postRequestCounter.inc();
  res.send("Torrent added.");
});

torrentRouter.put("/", async (req, res) => {
  const { id } = req.query;
  const { data } = req.body;

  await updateTorrent(id, data);
  putRequestCounter.inc()
  res.send("Torrent updated.");
});

torrentRouter.delete("/", async (req, res) => {
  const { id } = req.query;

  await deleteTorrent(id);
  deleteRequestCounter.inc();
  res.send("Torrent deleted.");
});
