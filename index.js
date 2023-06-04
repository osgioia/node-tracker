import { Server } from "bittorrent-tracker";
import express from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const app = express();
app.use(express.json());
const expressPort = 3000 || process.env.PORT;

// Ruta POST para agregar torrents
app.post("/torrents", (req, res) => {
  const { infoHash } = req.body;

  // Agregar lógica para registrar el torrent en la base de datos utilizando Prisma

  res.send("Torrent agregado correctamente");
});

const server = new Server({
  udp: true,
  http: true,
  ws: true,
  stats: true,
  filter: (infoHash, params, callback) => {
    callback(null);
  },
});

const onHttpRequest = server.onHttpRequest.bind(server);
app.get("/announce", onHttpRequest);
app.get("/scrape", onHttpRequest);

app.listen(expressPort, () => {
  console.log(`Torrent Tracker running at ${expressPort}`);
});
