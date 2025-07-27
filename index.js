import { Server } from "bittorrent-tracker";
import express from "express";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit"; // Corregido el nombre del paquete
import { register } from "prom-client";
import { checkTorrent, bannedIPs } from "./src/utils/utils.js";
import { setupMorgan, logMessage } from "./src/utils/utils.js";
import { db } from "./src/utils/db.server.js"; // Importar db para health check y cierre
import apiRouter from "./src/router.js";
import { specs, swaggerUi } from "./src/config/swagger.js";

dotenv.config();

const app = express();
app.use(express.json());

// Configurar logging HTTP
setupMorgan(app);

// Configurar Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Node Tracker API Documentation"
}));

app.use("/", apiRouter);

// Endpoint de métricas para Prometheus
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Health check para verificar la conexión a la base de datos
app.get("/health", async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.status(200).send("OK");
  } catch (err) {
    logMessage("error", `Error en health check: ${err.message}`);
    res.status(500).send("Database Error");
  }
});

// Configurar el servidor BitTorrent Tracker
const server = new Server({
  udp: process.env.UDP === "true", // Convertir a booleano
  http: process.env.HTTP === "true",
  interval: Number(process.env.ANNOUNCE_INTERVAL) || 300, // Convertir a número
  ws: process.env.WS === "true",
  stats: process.env.STATS === "true",
  trustProxy: process.env.TRUST_PROXY === "true",
  filter: async (infoHash, params, callback) => {
    try {
      await checkTorrent(infoHash, callback);
      await bannedIPs(params, callback);
    } catch (error) {
      logMessage("error", `Error en filtro del tracker: ${error.message}`);
      callback(error);
    }
  },
});

// Middleware de rate limiting para /announce y /scrape
const trackerRateLimiter = rateLimit({
  windowMs: 60_000, // 1 minuto
  max: 100, // Máximo 100 solicitudes por IP
  message: "Demasiadas solicitudes, inténtalo de nuevo más tarde.",
});

// Rutas del tracker con rate limiting
const onHttpRequest = server.onHttpRequest.bind(server);
app.use("/announce", trackerRateLimiter, onHttpRequest);
app.use("/scrape", trackerRateLimiter, onHttpRequest);

// Manejar cierre del servidor
process.on("SIGINT", async () => {
  logMessage("info", "Cerrando servidor...");
  try {
    await db.$disconnect(); // Desconectar la base de datos
    logMessage("info", "Base de datos desconectada.");
  } catch (error) {
    logMessage("error", `Error al desconectar la base de datos: ${error.message}`);
  }
  process.exit(0);
});

// Middleware de errores (debe ir al final)
app.use((err, req, res, next) => {
  logMessage("error", `Error no manejado: ${err.message}`);
  res.status(500).json({ error: "Internal Server Error." });
});

// Iniciar el servidor
const expressPort = process.env.PORT || 3000;
app.listen(expressPort, () => {
  logMessage("info", `Torrent Tracker running at http://localhost:${expressPort}`);
});