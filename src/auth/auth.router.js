import express from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth.js';
import { blocklistToken } from './auth.service.js';
import { logMessage } from '../utils/utils.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
// Asumimos que tienes un servicio para verificar credenciales
// import { verifyUserCredentials } from './auth.service.js';
// import { generateToken } from '../utils/utils.js';

export const authRouter = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión de usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve token JWT
 *       401:
 *         description: Credenciales inválidas
 */
authRouter.post('/login', authRateLimiter, async (req, res) => {
  // Aquí iría tu lógica de login existente para verificar email/password
  // y generar un token con generateToken(user)
  res.status(501).json({ message: 'Login endpoint not implemented yet' });
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión de usuario
 *     description: Invalida el token JWT actual del usuario.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout exitoso
 *       401:
 *         description: No autorizado
 */
authRouter.post('/logout', authMiddleware, async (req, res) => {
  try {
    const token = req.token; // Token adjuntado por el authMiddleware
    const decoded = jwt.decode(token);

    if (decoded && decoded.exp) {
      await blocklistToken(token, decoded.exp);
    }

    logMessage('info', `User ${req.user.username} logged out successfully.`);
    res.status(200).json({ message: 'Successfully logged out' });
  } catch (error) {
    logMessage('error', `Error during logout: ${error.message}`);
    res.status(500).json({ error: 'An error occurred during logout' });
  }
});