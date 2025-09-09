import jwt from 'jsonwebtoken';
import { logMessage } from '../utils/utils.js';
import { db } from '../utils/db.server.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Validar que JWT_SECRET existe y es seguro
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long for security');
}

// Lista negra de tokens (en producción usar Redis)
const tokenBlacklist = new Set();

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logMessage('warn', `Access without token from IP: ${req.ip}`);
      return res.status(401).json({ 
        error: 'Access denied',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verificar si el token está en la lista negra
    if (tokenBlacklist.has(token)) {
      logMessage('warn', `Blacklisted token used from IP: ${req.ip}`);
      return res.status(401).json({ 
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verificar que el usuario aún existe y no está baneado
    const user = await db.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        banned: true,
        emailVerified: true
      }
    });

    if (!user) {
      logMessage('warn', `Token for non-existent user: ${decoded.id} from IP: ${req.ip}`);
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.banned) {
      logMessage('warn', `Banned user attempted access: ${user.username} from IP: ${req.ip}`);
      return res.status(403).json({ 
        error: 'User account is banned',
        code: 'USER_BANNED'
      });
    }

    // Agregar información del usuario a la request
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logMessage('warn', `Expired token from IP: ${req.ip}`);
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      logMessage('warn', `Invalid token from IP: ${req.ip}`);
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }

    logMessage('error', `Auth middleware error: ${error.message} from IP: ${req.ip}`);
    res.status(401).json({ 
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

// Función para revocar tokens (logout)
export const revokeToken = (token) => {
  tokenBlacklist.add(token);
  // En producción, esto debería ir a Redis con TTL
  logMessage('info', 'Token revoked');
};

// Middleware para verificar roles específicos
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!userRoles.includes(req.user.role)) {
      logMessage('warn', `Insufficient permissions: ${req.user.username} (${req.user.role}) tried to access ${req.path}`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: userRoles,
        current: req.user.role
      });
    }

    next();
  };
};