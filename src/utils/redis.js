import { createClient } from 'redis';
import { logMessage } from './utils.js';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  logMessage('error', `Redis Error: ${err}`);
});

redisClient.on('connect', () => {
  logMessage('info', 'Connected to Redis');
});

await redisClient.connect();

export default redisClient;