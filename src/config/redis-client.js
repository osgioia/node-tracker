import { createClient } from 'redis';
import { logMessage } from '../utils/utils.js';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => logMessage('error', `Redis Client Error: ${err}`));

redisClient.on('connect', () => logMessage('info', 'Connected to Redis server.'));

redisClient.connect().catch(err => {
  logMessage('error', `Failed to connect to Redis: ${err.message}`);
});

export default redisClient;