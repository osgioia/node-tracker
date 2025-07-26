import express from "express";
import { authMiddleware } from "./middleware/auth.js";
import { usersRouter } from "./users/users.router.js";
import { ipBansRouter } from "./ip-bans/ip-bans.router.js";
import { torrentsRouter } from "./torrents/torrents.router.js";

// Crear el router
const router = express.Router();

// Rutas públicas
router.use("/api/user", usersRouter);

// Aplicar el middleware de autenticación a las rutas protegidas
router.use(authMiddleware);

// Rutas protegidas
router.use("/api/ip-bans", ipBansRouter);
router.use("/api/torrents", torrentsRouter);

// Exportar el router
export default router;