import express from "express";
import { authMiddleware } from "./middleware/auth.js";
import { iPBanRouter } from "./ipban/ipban.router.js";
import { torrentRouter } from "./torrent/torrent.router.js";
import { userRouter } from "./user/user.router.js";

// Crear el router
const router = express.Router();

// Rutas de usuario (incluye públicas y protegidas)
router.use("/api/user", userRouter);

// Aplicar el middleware de autenticación a las rutas protegidas
router.use("/api/torrent", authMiddleware, torrentRouter);
router.use("/api/ipban", authMiddleware, iPBanRouter);

// Exportar el router
export default router;