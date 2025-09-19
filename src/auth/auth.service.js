import redisClient from '../config/redis-client.js';
import { logMessage } from '../utils/utils.js';

const TOKEN_BLACKLIST_PREFIX = 'blacklist:';

/**
 * Añade un token a la lista de bloqueo de Redis con una expiración.
 * @param {string} token - El token JWT a bloquear.
 * @param {number} exp - El timestamp de expiración del token (en segundos).
 */
export async function blocklistToken(token, exp) {
  try {
    const key = `${TOKEN_BLACKLIST_PREFIX}${token}`;
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;

    if (ttl > 0) {
      await redisClient.setEx(key, ttl, 'blocked');
      logMessage('info', `Token blocklisted with TTL: ${ttl}s`);
    }
  } catch (error) {
    logMessage('error', `Error blocklisting token: ${error.message}`);
  }
}

/**
 * Verifica si un token está en la lista de bloqueo.
 * @param {string} token - El token JWT a verificar.
 * @returns {Promise<boolean>} - True si el token está bloqueado, false en caso contrario.
 */
export async function isTokenBlocklisted(token) {
  try {
    const key = `${TOKEN_BLACKLIST_PREFIX}${token}`;
    const result = await redisClient.get(key);
    return result === 'blocked';
  } catch (error) {
    logMessage('error', `Error checking token blocklist: ${error.message}`);
    return false;
  }
}