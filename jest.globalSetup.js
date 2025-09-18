import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';

export default async () => {
  console.log('\n\nSetting up test environment...');

  // Load .env.test variables
  config({ path: path.resolve(process.cwd(), '.env.test') });

  // Start Docker containers
  console.log('Starting test database and Redis containers...');
  execSync('docker-compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });

  // Wait a bit for the database to be ready
  await new Promise(res => setTimeout(res, 5000));

  // Run Prisma migrations on the test database
  console.log('Applying database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('Test environment setup complete.');
};