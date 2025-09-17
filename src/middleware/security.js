import { logMessage } from '../utils/utils.js';

// Middleware para sanitizar inputs
export const sanitizeInput = (req, res, next) => {
  try {
    // Excluir rutas del tracker
    if (req.url.startsWith('/announce') || req.url.startsWith('/scrape')) {
      return next();
    }

    // Función para limpiar strings de caracteres peligrosos
    const sanitizeString = (str) => {
      if (typeof str !== 'string') {return str;}

      return str
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .replace(/[<>]/g, ''); // Remove < and > characters
    };

    // Función recursiva para sanitizar objetos
    const sanitizeObject = (obj) => {
      if (obj === null || obj === undefined) {return obj;}

      if (typeof obj === 'string') {return sanitizeString(obj);}

      if (Array.isArray(obj)) {return obj.map(sanitizeObject);}

      if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          obj[key] = sanitizeObject(obj[key]);
        }
        return obj;
      }

      return obj;
    };

    // Sanitizar body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitizar query (modificar propiedades, no reemplazar el objeto)
    if (req.query) {
      for (const key of Object.keys(req.query)) {
        req.query[key] = sanitizeObject(req.query[key]);
      }
    }

    // Sanitizar params (modificar propiedades)
    if (req.params) {
      for (const key of Object.keys(req.params)) {
        req.params[key] = sanitizeObject(req.params[key]);
      }
    }

    next();
  } catch (error) {
    logMessage('error', `Input sanitization error: ${error.message}`);
    res.status(400).json({ error: 'Invalid input format' });
  }
};

// Middleware para validar Content-Type
export const validateContentType = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes('application/json')) {
      logMessage('warn', `Invalid content type: ${contentType} from IP: ${req.ip}`);
      return res.status(415).json({ 
        error: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE'
      });
    }
  }
  
  next();
};

// Middleware para prevenir ataques de timing
export const addRandomDelay = (req, res, next) => {
  // Agregar delay aleatorio pequeño para prevenir timing attacks
  const delay = Math.random() * 100; // 0-100ms
  
  setTimeout(() => {
    next();
  }, delay);
};

// Middleware para validar User-Agent
export const validateUserAgent = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent || userAgent.length < 10) {
    logMessage('warn', `Suspicious User-Agent: ${userAgent} from IP: ${req.ip}`);
    return res.status(400).json({ 
      error: 'Invalid User-Agent',
      code: 'INVALID_USER_AGENT'
    });
  }
  
  // Detectar bots maliciosos conocidos
  const suspiciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /zap/i,
    /burp/i
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    logMessage('warn', `Malicious User-Agent detected: ${userAgent} from IP: ${req.ip}`);
    return res.status(403).json({ 
      error: 'Access denied',
      code: 'SUSPICIOUS_USER_AGENT'
    });
  }
  
  next();
};

// Middleware para logging de seguridad
export const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request details
  const requestInfo = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };
  
  // Log suspicious activity
  if (req.url.includes('..') || req.url.includes('<script>') || req.url.includes('SELECT')) {
    logMessage('warn', `Suspicious request: ${JSON.stringify(requestInfo)}`);
  }
  
  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    if (res.statusCode >= 400) {
      logMessage('warn', `Error response: ${res.statusCode} for ${req.method} ${req.url} from ${req.ip} (${responseTime}ms)`);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Middleware para prevenir ataques de enumeración
export const preventEnumeration = (req, res, next) => {
  // Agregar headers para prevenir información leakage
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  
  next();
};

export default {
  sanitizeInput,
  validateContentType,
  addRandomDelay,
  validateUserAgent,
  securityLogger,
  preventEnumeration
};
