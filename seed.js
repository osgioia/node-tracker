import fs  from 'fs';
import path  from 'path';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createDatabase(){
    const dbPath = path.join('/tmp', 'tracker.db');
  
    // Verificar si el archivo de la base de datos ya existe
    const dbExists = fs.existsSync(dbPath);
  
    // Crear la base de datos solo si no existe
    if (!dbExists && process.env.DATABASE_URL.startsWith('file:')) {
      fs.writeFileSync(dbPath, '');
  
      try {
        await prisma.$connect();
        
        // Obtener la ruta del directorio de migraciones
        const migrationsDir = './prisma/migrations';
  
        // Leer y aplicar todas las migraciones
        const migrationFiles = fs.readdirSync(migrationsDir);
        for (const migrationFile of migrationFiles) {
          const migrationPath = path.join(migrationsDir, migrationFile);
          const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
          await prisma.$executeRaw`${migrationSql}`;
          console.log(`Migración aplicada: ${migrationFile}`);
        }
  
        await prisma.$disconnect();
  
        console.log('Base de datos creada en /tmp y migraciones aplicadas');
  
      } catch (error) {
        console.error(error);
        return 'Error';
      } finally {
        await prisma.$disconnect();
      }
    
    }
    
  }
  
  await createDatabase()