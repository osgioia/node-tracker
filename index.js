import { Server } from 'bittorrent-tracker';
import express from 'express';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import cors from 'cors';
import { register } from 'prom-client';
import { checkTorrent, bannedIPs } from './src/utils/utils.js';
import { setupMorgan, logMessage } from './src/utils/utils.js';
import { db } from './src/utils/db.server.js';
import apiRouter from './src/router.js';
import { specs, swaggerUi } from './src/config/swagger.js';
import {
  securityConfig,
  validateSecurityConfig
} from './src/config/security.js';
import {
  sanitizeInput,
  validateContentType,
  validateUserAgent,
  securityLogger,
  preventEnumeration
} from './src/middleware/security.js';

dotenv.config();

// Validar configuración de seguridad al inicio
try {
  validateSecurityConfig();
  logMessage('info', 'Security configuration validated successfully');
} catch (error) {
  logMessage(
    'error',
    `Security configuration validation failed: ${error.message}`
  );
  process.exit(1);
}

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: securityConfig.headers.csp.directives,
      reportUri: securityConfig.headers.csp.reportUri
    },
    hsts: securityConfig.headers.hsts,
    crossOriginEmbedderPolicy: false, // Disable for tracker compatibility
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// CORS configuration
app.use(cors(securityConfig.cors));

// Body parsing with size limits
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({ error: 'Invalid JSON' });
        throw new Error('Invalid JSON');
      }
    }
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb'
  })
);

// Configurar logging HTTP
setupMorgan(app);

// Global rate limiting usando configuración centralizada
const globalLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.global.windowMs,
  max: securityConfig.rateLimit.global.max,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Slow down middleware para requests sospechosos
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutos
  delayAfter: 100, // Permitir 100 requests a velocidad normal
  delayMs: () => 500, // Función que retorna 500ms de delay
  maxDelayMs: 20000, // Máximo delay de 20 segundos
  validate: { delayMs: false } // Deshabilitar warning
});

// Auth rate limiting (más estricto para endpoints de autenticación)
const authLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.auth.windowMs,
  max: securityConfig.rateLimit.auth.max,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // No contar requests exitosos
});

// Security middlewares
app.use(securityLogger);
app.use(preventEnumeration);
app.use(validateUserAgent);
app.use(validateContentType);
app.use(sanitizeInput);

app.use(globalLimiter);
app.use(speedLimiter);

// Configurar Swagger con rate limiting
app.use(
  '/api-docs',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Límite más bajo para documentación
    message: { error: 'Too many requests to API documentation' }
  }),
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Node Tracker API Documentation'
  })
);

// Aplicar rate limiting específico para rutas de autenticación
app.use('/api/auth', authLimiter);

// Configurar el servidor BitTorrent Tracker
const server = new Server({
  udp: process.env.UDP === 'true', // Convertir a booleano
  http: false, // Deshabilitamos HTTP interno, usaremos Express
  interval: Number(process.env.ANNOUNCE_INTERVAL) || 300, // Convertir a número
  ws: process.env.WS === 'true',
  stats: process.env.STATS === 'true',
  trustProxy: process.env.TRUST_PROXY === 'true',
  filter: async (infoHash, params, callback) => {
    try {
      await checkTorrent(infoHash, callback);
      await bannedIPs(params, callback);
    } catch (error) {
      logMessage('error', `Error en filtro del tracker: ${error.message}`);
      callback(error);
    }
  }
});

// Middleware de rate limiting para /announce y /scrape
const trackerRateLimiter = rateLimit({
  windowMs: 60_000, // 1 minuto
  max: 100, // Máximo 100 solicitudes por IP
  message: 'Demasiadas solicitudes, inténtalo de nuevo más tarde.'
});

// Rutas del tracker con rate limiting (ANTES del router principal)
const onHttpRequest = server._onHttpRequest.bind(server);
app.get('/announce', trackerRateLimiter, onHttpRequest);
app.get('/scrape', trackerRateLimiter, onHttpRequest);

// Endpoint de métricas para Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Health check para verificar la conexión a la base de datos
app.get('/health', async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.status(200).send('OK');
  } catch (err) {
    logMessage('error', `Error en health check: ${err.message}`);
    res.status(500).send('Database Error');
  }
});

app.use('/', apiRouter);

// Manejar cierre del servidor
process.on('SIGINT', async () => {
  logMessage('info', 'Cerrando servidor...');
  try {
    await db.$disconnect(); // Desconectar la base de datos
    logMessage('info', 'Base de datos desconectada.');
  } catch (error) {
    logMessage(
      'error',
      `Error al desconectar la base de datos: ${error.message}`
    );
  }
  process.exit(0);
});

// Middleware de errores (debe ir al final)
app.use((err, req, res, next) => {
  logMessage('error', `Error no manejado: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error.' });
});

// Iniciar el servidor
const expressPort = process.env.PORT || 3000;
app.listen(expressPort, () => {
  logMessage(
    'info',
    `Torrent Tracker running at http://localhost:${expressPort}`
  );
});
