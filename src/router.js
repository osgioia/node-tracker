import express from "express";
import { authMiddleware } from "./middleware/auth.js";
// import { userRouter } from "./user/user.router.js";

// Crear el router
const router = express.Router();

// Rutas de usuario (incluye públicas y protegidas)
// router.use("/api/user", userRouter);

// Aplicar el middleware de autenticación a las rutas protegidas

// Exportar el router
export default router;