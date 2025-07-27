import express from 'express';
import { body, validationResult } from 'express-validator';
import { Counter } from 'prom-client';
import { registerUser, loginUser, logoutUser, validatePasswordStrength } from './auth.service.js';
import { authMiddleware, revokeToken } from '../middleware/auth.js';

export const authRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Autenticación y registro de usuarios
 */

// Prometheus metrics
const registerCounter = new Counter({
  name: 'auth_register_requests',
  help: 'Count user registrations'
});

const loginCounter = new Counter({
  name: 'auth_login_requests',
  help: 'Count user logins'
});

// Validations
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),
  body('email')
    .isEmail()
    .withMessage('Invalid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('inviteKey')
    .optional()
    .isString()
    .withMessage('Invalid invitation key')
];

const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username or email required'),
  body('password')
    .notEmpty()
    .withMessage('Password required')
];

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Usuario o email ya existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/auth/register
authRouter.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, inviteKey } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    const user = await registerUser({ username, email, password, inviteKey }, clientIP);
    
    registerCounter.inc();
    res.status(201).json({
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    if (error.message === 'User or email already exists') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('Password requirements not met')) {
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        details: error.message
      });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT token para autenticación
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/auth/login
authRouter.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    const result = await loginUser(username, password, clientIP);
    
    loginCounter.inc();
    res.json({
      message: 'Login successful',
      ...result
    });
  } catch (error) {
    if (error.message.includes('Too many failed attempts')) {
      return res.status(429).json({ 
        error: error.message,
        code: 'TOO_MANY_ATTEMPTS'
      });
    }
    res.status(401).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Token inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/auth/logout
authRouter.post('/logout', authMiddleware, async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Revocar el token
    revokeToken(req.token);
    
    const result = await logoutUser(req.token, clientIP);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/validate-password:
 *   post:
 *     summary: Validar fortaleza de contraseña
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 description: Contraseña a validar
 *     responses:
 *       200:
 *         description: Resultado de validación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 */
// POST /api/auth/validate-password
authRouter.post('/validate-password', [
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { password } = req.body;
    const validation = validatePasswordStrength(password);
    
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});