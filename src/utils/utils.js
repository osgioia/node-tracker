import { createLogger, format, transports } from 'winston';
import { Address6, Address4 } from 'ip-address';
import { db } from './db.server.js';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';

// Validar JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Convertir IP a número (IPv4 o IPv6)
function ipToNumber(ip) {
  try {
    // Handle IPv4-mapped IPv6 addresses (e.g., ::ffff:192.168.1.1)
    if (ip.includes(':')) {
      const addr6 = new Address6(ip);
      if (addr6.isV4()) {
        // Convert to IPv4 representation
        const v4 = addr6.to4().address;
        const parts = v4.split('.').map(Number);
        return BigInt(parts[0]) * 16777216n +
               BigInt(parts[1]) * 65536n +
               BigInt(parts[2]) * 256n +
               BigInt(parts[3]);
      }
      return BigInt(addr6.bigInteger());
    } else {
      // IPv4
      const parts = ip.split('.').map(Number);
      if (parts.length !== 4 || parts.some(part => part < 0 || part > 255)) {
        throw new Error('Invalid IPv4 address');
      }
      return BigInt(parts[0]) * 16777216n +
             BigInt(parts[1]) * 65536n +
             BigInt(parts[2]) * 256n +
             BigInt(parts[3]);
    }
  } catch (error) {
    logMessage('error', `Error converting IP: ${error.message}`);
    return null;
  }
}

// Configurar Morgan para logging de HTTP
function setupMorgan(app) {
  let accessLogStream;

  if (process.env.NODE_ENV === 'production') {
    accessLogStream = fs.createWriteStream(
      path.join(process.cwd(), 'access.log'),
      { flags: 'a' }
    );
  }

  app.use(morgan('combined', { stream: accessLogStream || process.stdout }));
}

// Configuración de Winston para logging estructurado
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'application.log' })
  ]
});

// Función helper para logging
function logMessage(level, message) {
  logger.log({ level, message });
}

// Verificar si un torrent existe en la base de datos
async function checkTorrent(infoHash, callback) {
  try {
    const torrent = await db.torrent.findUnique({
      where: { infoHash }
    });
    if (!torrent) {
      logMessage('warn', `Torrent not found: ${infoHash}`);
      throw new Error('Torrent not found');
    }
    callback(null);
  } catch (error) {
    logMessage('error', `Error in checkTorrent: ${error.message}`);
    callback(error);
  }
}

// Verificar si una IP está en un rango baneado
async function bannedIPs(params, callback) {
  try {
    const bannedIPs = await db.IPBan.findMany();
    const ip = params.ipv6 || params.ip;

    const isBanned = bannedIPs.some((ipBan) => {
      const fromIP = ipToNumber(ipBan.fromIP);
      const toIP = ipToNumber(ipBan.toIP);
      const currentIP = ipToNumber(ip);

      if (fromIP === null || toIP === null || currentIP === null) {
        return false;
      }

      return currentIP >= fromIP && currentIP <= toIP;
    });

    if (isBanned) {
      logMessage('warn', `IP banned: ${ip}`);
      callback(new Error('IP banned'));
    } else {
      callback(null);
    }
  } catch (error) {
    logMessage('error', `Error in bannedIPs: ${error.message}`);
    callback(error);
  }
}

// Generar un token JWT para autenticación
function generateToken(user) {
  if (!user || !user.id || !user.username) {
    throw new Error('Invalid user data for token generation');
  }

  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Generar una clave de invitación única
function generateInviteKey() {
  return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Exportar funciones
export { checkTorrent, bannedIPs, setupMorgan, logMessage, generateToken, generateInviteKey, ipToNumber };