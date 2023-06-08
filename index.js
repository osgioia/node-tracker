import { Server } from "bittorrent-tracker";
import express from "express";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

const app = express();
app.use(express.json());
const expressPort = process.env.PORT || 3000;

async function addTorrent(infoHash, name, category, tags) {
  try {
    await prisma.torrent.create({
      data: {
        infoHash: infoHash,
        name: name,
        category: { create: { name: category } },
        tags: { create: tags.map((tag) => ({ name: tag })) },
      },
    });
    console.log("Torrent agregado correctamente");
  } catch (error) {
    console.error("Error al agregar el torrent:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkTorrent(infoHash, callback) {
  try {
    const torrent = await prisma.torrent.findUnique({
      where: { infoHash },
    });

    if (torrent) {
      await prisma.peer.create({
        data: {
          torrentId: torrent.id,
          ip: params.ip,
          port: params.port,
          uploaded: params.uploaded,
          downloaded: params.downloaded,
          left: params.left,
          event: params.event,
        },
      });
      callback(null);
    } else {
      throw new Error("Torrent no encontrado");
    }
  } catch (error) {
    callback(error);
  } finally {
    await prisma.$disconnect();
  }
}

async function searchTorrent(name, category) {
  try {
    const torrents = await prisma.torrent.findMany({
      where: {
        name: { contains: name || "" },
        category: { name: category || undefined },
      },
      include: {
        category: true,
        tags: true,
      },
    });

    return torrents;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en la búsqueda de torrents" });
  } finally {
    await prisma.$disconnect();
  }
}

async function updateTorrent(id, data) {
  try {
    const updatedTorrent = await prisma.torrent.update({
      where: { id },
      data,
    });
    console.log("Torrent actualizado correctamente:", updatedTorrent);
  } catch (error) {
    console.error("Error al actualizar el torrent:", error);
  } finally {
    await prisma.$disconnect();
  }
}

async function deleteTorrent(id) {
  try {
    await prisma.torrent.delete({
      where: { id },
    });
    console.log("Torrent eliminado correctamente");
  } catch (error) {
    console.error("Error al eliminar el torrent:", error);
  } finally {
    await prisma.$disconnect();
  }
}


app.get("/torrents/search", async (req, res) => {
  const { name, category } = req.query;
  const torrents = await searchTorrent(name, category);
  res.json(torrents);
});

// Ruta POST para agregar torrents
app.post("/torrents", async (req, res) => {
  const { infoHash, name, category, tags } = req.body;

  // Agregar lógica para registrar el torrent en la base de datos utilizando Prisma
  // Llama a la función agregarTorrent y pasa el infoHash correspondiente
  await addTorrent(infoHash, name, category, tags);

  res.send("Torrent agregado correctamente");
});

app.put("/torrents", async (req, res) => {
  const { id } = req.query; 
  const { data } = req.body;

  await updateTorrent(id, data);
  res.send("Torrent actualizado correctamente")
})

app.delete("/torrents", async(req, res) => {
  const { id } = req.query;

  await deleteTorrent(id);
  res.send("Torrent eliminado correctamente")
})

const server = new Server({
  udp: true,
  http: true,
  ws: true,
  stats: true,
  filter: async (infoHash, params, callback) => {
    await checkTorrent(infoHash, callback);
  },
});

const onHttpRequest = server.onHttpRequest.bind(server);
app.get("/announce", onHttpRequest);
app.get("/scrape", onHttpRequest);

app.listen(expressPort, () => {
  // Ejecutar tu función personalizada antes de levantar el servidor
  console.log(`Torrent Tracker running at ${expressPort}`);
});
