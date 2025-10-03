import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (optional)
  await prisma.progress.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.torrent.deleteMany();
  await prisma.category.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.inviteTreeNode.deleteMany();
  await prisma.userBan.deleteMany();
  await prisma.user.deleteMany();
  await prisma.iPBan.deleteMany();
  await prisma.geoIP.deleteMany();

  console.log('🧹 Existing data deleted');

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({
      data: { name: 'Películas' }
    }),
    prisma.category.create({
      data: { name: 'Series' }
    }),
    prisma.category.create({
      data: { name: 'Música' }
    }),
    prisma.category.create({
      data: { name: 'Juegos' }
    }),
    prisma.category.create({
      data: { name: 'Software' }
    }),
    prisma.category.create({
      data: { name: 'Libros' }
    })
  ]);

  console.log('📂 Categories created');

  // Create tags
  const tags = await Promise.all([
    prisma.tag.create({ data: { name: 'HD' } }),
    prisma.tag.create({ data: { name: '4K' } }),
    prisma.tag.create({ data: { name: 'Subtitulado' } }),
    prisma.tag.create({ data: { name: 'Latino' } }),
    prisma.tag.create({ data: { name: 'English' } }),
    prisma.tag.create({ data: { name: 'Clásico' } }),
    prisma.tag.create({ data: { name: 'Nuevo' } }),
    prisma.tag.create({ data: { name: 'Popular' } })
  ]);

  console.log('🏷️ Tags created');

  // Hash for passwords
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        created: new Date(),
        banned: false,
        role: 'ADMIN',
        remainingInvites: 10,
        emailVerified: true,
        uploaded: BigInt(1000000000), // 1GB
        downloaded: BigInt(500000000), // 500MB
        seedtime: BigInt(86400) // 1 day in seconds
      }
    }),
    prisma.user.create({
      data: {
        username: 'moderator',
        email: 'moderator@example.com',
        password: hashedPassword,
        created: new Date(),
        banned: false,
        role: 'MODERATOR',
        remainingInvites: 5,
        emailVerified: true,
        uploaded: BigInt(500000000),
        downloaded: BigInt(300000000),
        seedtime: BigInt(43200)
      }
    }),
    prisma.user.create({
      data: {
        username: 'user1',
        email: 'user1@example.com',
        password: hashedPassword,
        created: new Date(),
        banned: false,
        role: 'USER',
        remainingInvites: 2,
        emailVerified: true,
        uploaded: BigInt(200000000),
        downloaded: BigInt(800000000),
        seedtime: BigInt(21600)
      }
    }),
    prisma.user.create({
      data: {
        username: 'user2',
        email: 'user2@example.com',
        password: hashedPassword,
        created: new Date(),
        banned: false,
        role: 'USER',
        remainingInvites: 1,
        emailVerified: false,
        uploaded: BigInt(100000000),
        downloaded: BigInt(400000000),
        seedtime: BigInt(10800)
      }
    })
  ]);

  console.log('👥 Users created'); // Create Torrents
  const torrents = await Promise.all([
    prisma.torrent.create({
      data: {
        name: 'Película Ejemplo 2024',
        description: 'Una película de ejemplo en alta calidad',
        infoHash: 'a1b2c3d4e5f6789012345678901234567890abcd',
        completed: 150,
        uploadedById: users[0].id,
        downloads: 75,
        anonymous: false,
        freeleech: true,
        size: 536870912, // 512MB
        categoryId: categories[0].id,
        tags: {
          connect: [
            { id: tags[0].id }, // HD
            { id: tags[2].id }, // Subtitulado
            { id: tags[6].id } // Nuevo
          ]
        }
      }
    }),
    prisma.torrent.create({
      data: {
        name: 'Serie Popular S01E01',
        description: 'Primer episodio de una serie muy popular',
        infoHash: 'b2c3d4e5f6789012345678901234567890abcdef',
        completed: 89,
        uploadedById: users[1].id,
        downloads: 234,
        anonymous: false,
        freeleech: false,
        size: 268435456, // 256MB
        categoryId: categories[1].id,
        tags: {
          connect: [
            { id: tags[1].id }, // 4K
            { id: tags[3].id }, // Latino
            { id: tags[7].id } // Popular
          ]
        }
      }
    }),
    prisma.torrent.create({
      data: {
        name: 'Álbum Musical 2024',
        description: 'Último álbum del artista famoso',
        infoHash: 'c3d4e5f6789012345678901234567890abcdef12',
        completed: 45,
        uploadedById: users[2].id,
        downloads: 123,
        anonymous: true,
        freeleech: true,
        size: 134217728, // 128MB
        categoryId: categories[2].id,
        tags: {
          connect: [
            { id: tags[6].id }, // Nuevo
            { id: tags[7].id } // Popular
          ]
        }
      }
    }),
    prisma.torrent.create({
      data: {
        name: 'Juego Indie Increíble',
        description: 'Un juego independiente muy bien valorado',
        infoHash: 'd4e5f6789012345678901234567890abcdef1234',
        completed: 67,
        uploadedById: users[3].id,
        downloads: 89,
        anonymous: false,
        freeleech: false,
        size: 536870912, // 512MB
        categoryId: categories[3].id,
        tags: {
          connect: [
            { id: tags[4].id }, // English
            { id: tags[6].id } // Nuevo
          ]
        }
      }
    })
  ]);

  console.log('🎬 Torrents created');

  // Create invitations
  const invites = await Promise.all([
    prisma.invite.create({
      data: {
        inviterId: users[0].id,
        inviteKey: 'invite-key-admin-001',
        email: 'new-user1@example.com',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        reason: 'User recommended by the community',
        used: false
      }
    }),
    prisma.invite.create({
      data: {
        inviterId: users[1].id,
        inviteKey: 'invite-key-mod-002',
        email: 'new-user2@example.com',
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        reason: 'Amigo personal',
        used: false
      }
    }),
    prisma.invite.create({
      data: {
        inviterId: users[0].id,
        inviteKey: 'invite-key-used-003',
        email: 'existing-user@example.com',
        expires: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Expirada
        reason: 'Invitación de prueba',
        used: true
      }
    })
  ]);

  console.log('📧 Invitations created');

  // Create bookmarks
  const bookmarks = await Promise.all([
    prisma.bookmark.create({
      data: {
        userId: users[2].id,
        time: new Date(),
        sort: 1
      }
    }),
    prisma.bookmark.create({
      data: {
        userId: users[3].id,
        time: new Date(),
        sort: 1
      }
    })
  ]);

  console.log('🔖 Bookmarks created');

  // Create download progress
  const progress = await Promise.all([
    prisma.progress.create({
      data: {
        infoHash: torrents[0].infoHash,
        userId: users[2].id,
        uploaded: BigInt(104857600), // 100MB
        download: BigInt(1073741824), // 1GB
        left: BigInt(1073741824) // 1GB restante
      }
    }),
    prisma.progress.create({
      data: {
        infoHash: torrents[1].infoHash,
        userId: users[3].id,
        uploaded: BigInt(52428800), // 50MB
        download: BigInt(536870912), // 512MB
        left: BigInt(536870912) // 512MB restante
      }
    })
  ]);

  console.log('📊 Download progress created');

  // Create some example IP bans
  const ipBans = await Promise.all([
    prisma.iPBan.create({
      data: {
        fromIP: BigInt('3232235777'), // 192.168.1.1
        toIP: BigInt('3232235777'),
        reason: 'Actividad sospechosa'
      }
    }),
    prisma.iPBan.create({
      data: {
        fromIP: BigInt('167772160'), // 10.0.0.0
        toIP: BigInt('184549375'), // 10.255.255.255
        reason: 'Rango de IPs problemáticas'
      }
    })
  ]);

  console.log('🚫 IP bans created');

  // Create invitation tree
  const inviteTree = await Promise.all([
    prisma.inviteTreeNode.create({
      data: {
        userId: users[2].id,
        inviterId: users[0].id
      }
    }),
    prisma.inviteTreeNode.create({
      data: {
        userId: users[3].id,
        inviterId: users[1].id
      }
    })
  ]);

  console.log('🌳 Invitation tree created');

  // Create some example GeoIP data
  const geoIPs = await Promise.all([
    prisma.geoIP.create({
      data: {
        startIP: BigInt('134744064'), // 8.8.8.0
        endIP: BigInt('134744071'), // 8.8.8.7
        code: 'US'
      }
    }),
    prisma.geoIP.create({
      data: {
        startIP: BigInt('3232235520'), // 192.168.0.0
        endIP: BigInt('3232301055'), // 192.168.255.255
        code: 'XX' // Code for private networks
      }
    })
  ]);

  console.log('🌍 GeoIP data created');

  console.log('✅ Seed completed successfully!');
  console.log(`
📊 Summary of created data:
- ${categories.length} categories
- ${tags.length} tags
- ${users.length} users
- ${torrents.length} torrents
- ${invites.length} invitations
- ${bookmarks.length} bookmarks
- ${progress.length} registros de progreso
- ${ipBans.length} bans de IP
- ${inviteTree.length} invitation tree nodes
- ${geoIPs.length} registros de GeoIP
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
