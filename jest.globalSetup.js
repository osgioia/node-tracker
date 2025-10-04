import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';

export default async () => {
  console.log('\n\nSetting up test environment...');

  // Load environment variables from .env.test
  config({ path: path.resolve(process.cwd(), '.env.test') });

  // Check if Docker is available and setup containers if possible
  console.log('Checking Docker availability...');
  
  try {
    // Check if Docker is installed and running
    execSync('docker --version', { stdio: 'pipe' });
    
    try {
      // Try Docker Compose v2 first
      execSync('docker compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });
      console.log('✅ Docker containers started successfully');
      
      // Wait for database to be ready
      console.log('Waiting for database to be ready...');
      await new Promise(res => setTimeout(res, 5000));
      
      // Apply Prisma migrations to test database
      console.log('Applying database migrations...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      
    } catch (_composeErr) {
      console.warn('Docker Compose v2 failed, trying v1...');
      try {
        execSync('docker-compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });
        console.log('✅ Docker containers started with v1');
        
        await new Promise(res => setTimeout(res, 5000));
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        
      } catch (_v1Err) {
        throw new Error('Both Docker Compose v1 and v2 failed');
      }
    }
    
  } catch (_dockerErr) {
    console.warn('⚠️  Docker not available, running tests with mocked dependencies');
    console.warn('   Some integration tests may be skipped');
    
    // Set environment variables for mocked testing
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test.db'; // SQLite fallback
    process.env.REDIS_URL = 'redis://localhost:6379'; // Will be mocked
  }

  console.log('✅ Test environment setup complete.');
};

