import { PrismaClient } from "@prisma/client";

if (!global.__db) {
  global.__db = new PrismaClient();
}

const db = global.__db;

export { db };
