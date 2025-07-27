import { PrismaClient } from '@prisma/client';

if (!global.__db) {
  global.__db = new PrismaClient();
  await global.__db.$connect();
}

const db = global.__db;

export { db };
