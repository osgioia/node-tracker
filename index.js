import { Server } from "bittorrent-tracker";
import express from "express";
import { PrismaClient } from "@prisma/client";
import fs  from 'fs';
import path  from 'path';
import dotenv  from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

const app = express();
app.use(express.json());
const expressPort = process.env.PORT || 3000  ;

async function addTorrent(infoHash) {
  try {
    await prisma.torrent.create({
      data: {
        infoHash: infoHash,
      },
    });
    console.log('Torrent agregado correctamente');
  } catch (error) {
    console.error('Error al agregar el torrent:', error);
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
      throw new Error('Torrent no encontrado');
    }
  } catch (error) {
    callback(error);
  } finally {
    await prisma.$disconnect();
  }
  
}

async function createDatabase(){
  const dbPath = path.join('/tmp', 'tracker.db');

  // Verificar si el archivo de la base de datos ya existe
  const dbExists = fs.existsSync(dbPath);

  // Crear la base de datos solo si no existe
  if (!dbExists && process.env.DATABASE_URL.startsWith('file:')) {
    fs.writeFileSync(dbPath, '');

    try {
      await prisma.$connect();
      
      // Obtener la ruta del directorio de migraciones
      const migrationsDir = path.join('prisma', 'migrations');

      // Leer y aplicar todas las migraciones
      const migrationFiles = fs.readdirSync(migrationsDir);
      for (const migrationFile of migrationFiles) {
        const migrationPath = path.join(migrationsDir, migrationFile);
        const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
        await prisma.$executeRaw`${migrationSql}`;
        console.log(`Migración aplicada: ${migrationFile}`);
      }

      await prisma.$disconnect();

      console.log('Base de datos creada en /tmp y migraciones aplicadas');

    } catch (error) {
      console.error(error);
      return 'Error';
    } finally {
      await prisma.$disconnect();
    }
  
  }
  
}

// Ruta POST para agregar torrents
app.post("/torrents", async (req, res) => {
  const { infoHash } = req.body;

  // Agregar lógica para registrar el torrent en la base de datos utilizando Prisma
  // Llama a la función agregarTorrent y pasa el infoHash correspondiente
  await addTorrent(infoHash);

  res.send("Torrent agregado correctamente");
});


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

app.listen(expressPort, async () => {
  // Ejecutar tu función personalizada antes de levantar el servidor
  await createDatabase();
  console.log(`Torrent Tracker running at ${expressPort}`);
});