import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';

export default async () => {
  console.log('\n\nSetting up test environment...');

  // Cargar variables de entorno de .env.test
  config({ path: path.resolve(process.cwd(), '.env.test') });

  // Arrancar contenedores Docker
  console.log('Starting test database and Redis containers...');

  try {
    // Intenta usar Docker Compose v2 (docker compose)
    execSync('docker compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });
  } catch (err) {
    console.warn('Docker Compose v2 not found, trying v1 (docker-compose)...');
    execSync('docker-compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });
  }

  // Espera para que la base de datos esté lista
  console.log('Waiting for database to be ready...');
  await new Promise(res => setTimeout(res, 5000));

  // Aplicar migraciones de Prisma en la base de datos de test
  console.log('Applying database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('Test environment setup complete.');
};

