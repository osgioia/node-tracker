import redisClient from './src/utils/redis.js';
import { execSync } from 'child_process';

export default async () => {
  console.log('\n\nTearing down test environment...');

  if (redisClient) {
    console.log('Disconnecting Redis client...');
    await redisClient.quit();
  }

  console.log('Stopping test database and Redis containers...');
  try {
    execSync('docker compose -f docker-compose.test.yml down', { stdio: 'inherit' });
  } catch (err) {
    console.warn('Docker Compose v2 not found, trying v1 (docker-compose)...');
    execSync('docker-compose -f docker-compose.test.yml down', { stdio: 'inherit' });
  }

  console.log('Test environment teardown complete.');
};
