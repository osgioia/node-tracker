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
    // Check if Docker is available
    execSync('docker --version', { stdio: 'pipe' });
    
    try {
      // Try Docker Compose v2 first
      execSync('docker compose -f docker-compose.test.yml down', { stdio: 'inherit' });
      console.log('✅ Docker containers stopped successfully');
    } catch (_composeErr) {
      try {
        execSync('docker-compose -f docker-compose.test.yml down', { stdio: 'inherit' });
        console.log('✅ Docker containers stopped with v1');
      } catch (_v1Err) {
        console.warn('⚠️  Failed to stop Docker containers');
      }
    }
  } catch (_dockerErr) {
    console.warn('⚠️  Docker not available, skipping container cleanup');
  }

  console.log('✅ Test environment teardown complete.');
};
