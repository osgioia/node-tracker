import express from "express";
import { searchTorrent, addTorrent, deleteTorrent, updateTorrent  } from "./torrent.service.js";

export const torrentRouter = express.Router();

torrentRouter.get("/", async (req, res) => {
  const { name, category } = req.query;
  const torrents = await searchTorrent(name, category);
  res.json(torrents);
});

// Ruta POST para agregar torrents
torrentRouter.post("/", async (req, res) => {
  const { infoHash, name, category, tags } = req.body;

  // Agregar lógica para registrar el torrent en la base de datos utilizando Prisma
  // Llama a la función agregarTorrent y pasa el infoHash correspondiente
  await addTorrent(infoHash, name, category, tags);

  res.send("Torrent agregado correctamente");
});

torrentRouter.put("/", async (req, res) => {
  const { id } = req.query;
  const { data } = req.body;

  await updateTorrent(id, data);
  res.send("Torrent actualizado correctamente");
});

torrentRouter.delete("/", async (req, res) => {
  const { id } = req.query;

  await deleteTorrent(id);
  res.send("Torrent eliminado correctamente");
});
