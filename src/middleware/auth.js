import jwt from 'jsonwebtoken';
import { getUserById } from '../users/users.service.js';
import { isTokenBlocklisted } from '../auth/auth.service.js';
import { logMessage } from '../utils/utils.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. Verificar si el token está en la lista de bloqueo
    if (await isTokenBlocklisted(token)) {
      logMessage('warn', `Attempt to use a blocklisted token from IP: ${req.ip}`);
      return res.status(401).json({ error: 'Token has been invalidated. Please log in again.' });
    }

    // 2. Verificar la firma y expiración del token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. Obtener el usuario de la base de datos (o caché)
    const user = await getUserById(decoded.id);
    if (!user || user.banned) {
      return res.status(401).json({ error: 'User not found or is banned' });
    }

    // 4. Adjuntar el usuario y el token a la petición
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    logMessage('warn', `Invalid token provided: ${error.message}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};