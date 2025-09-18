import { execSync } from 'child_process';

export default async () => {
  console.log('\n\nTearing down test environment...');

  // Stop and remove Docker containers
  console.log('Stopping test database and Redis containers...');
  execSync('docker-compose -f docker-compose.test.yml down', { stdio: 'inherit' });

  console.log('Test environment teardown complete.');
};