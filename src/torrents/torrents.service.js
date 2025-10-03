import { db } from '../utils/db.server.js';
import { logMessage } from '../utils/utils.js';
import magnet from 'magnet-uri';
import { RedisKeys } from '../utils/redis-keys.js';

function generateMagnetURI(infoHash, name, hostname,passkey) {
  try {
    const port = process.env.PORT || 3000;
    const trackerUrl = `${hostname}:${port}/announce?passkey=${passkey}`;
    
    const magnetUri = magnet.encode({
      xt: `urn:btih:${infoHash}`,
      dn: name,
      tr: trackerUrl
    });
    
    return magnetUri;
  } catch (_err) {
    throw new Error('Error generating magnet URI');
  }
}

async function addTorrent(torrentData) {
  try {
    const { infoHash, name, category, tags, description, size, anonymous, freeleech, uploadedById } = torrentData;
    
    const existingTorrent = await db.torrent.findFirst({
      where: { infoHash }
    });

    if (existingTorrent) {
      throw new Error('Torrent with this infoHash already exists');
    }

    const torrentCreateData = {
      infoHash,
      name,
      uploadedById,
      description: description || null,
      size: size || 0, 
      anonymous: anonymous || false,
      freeleech: freeleech || false
    };

    if (category) {
      torrentCreateData.category = {
        connectOrCreate: {
          where: { name: category },
          create: { name: category }
        }
      };
    }

    if (tags && tags.trim()) {
      torrentCreateData.tags = {
        connectOrCreate: tags.split(',').map((tag) => ({
          where: { name: tag.trim() },
          create: { name: tag.trim() }
        }))
      };
    }

    const newTorrent = await db.torrent.create({
      data: torrentCreateData,
      include: {
        category: true,
        tags: true,
        uploadedBy: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    logMessage('info', `Torrent added: ${name} by user ${uploadedById}`);
    return newTorrent;
  } catch (error) {
    logMessage('error', `Error adding torrent: ${error.message}`);
    throw error;
  }
}

async function getTorrentById(id) {
  try {
    const torrent = await db.torrent.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: true,
        tags: true,
        uploadedBy: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    if (!torrent) {
      throw new Error('Torrent not found');
    }

    return torrent;
  } catch (error) {
    logMessage('error', `Error getting torrent: ${error.message}`);
    throw error;
  }
}

async function getTorrentByInfoHash(infoHash, hostname, userPasskey) {
  try {
    const torrent = await db.torrent.findFirst({
      where: { infoHash },
      include: {
        category: true,
        tags: true,
        uploadedBy: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    if (!torrent) {
      throw new Error('Torrent not found');
    }

    const uri = generateMagnetURI(infoHash, torrent.name, hostname, userPasskey);
    return uri;
  } catch (error) {
    logMessage('error', `Error getting torrents: ${error.message}`);
    throw error;
  }
}

async function getAllTorrents(page = 1, limit = 20, filters = {}) {
  try {
    const skip = (page - 1) * limit;
    const { category, search } = filters;

    const where = {};
    
    if (category) {
      where.category = {
        name: category
      };
    }

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive'
      };
    }

    const [torrents, total] = await Promise.all([
      db.torrent.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
          tags: true,
          uploadedBy: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: {
          id: 'desc'
        }
      }),
      db.torrent.count({ where })
    ]);

    return {
      torrents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logMessage('error', `Error listing torrents: ${error.message}`);
    throw error;
  }
}

async function updateTorrent(id, data) {
  try {
    const { category, tags, ...otherData } = data;
    
    const updateData = { ...otherData };

    if (category) {
      updateData.category = {
        connectOrCreate: {
          where: { name: category },
          create: { name: category }
        }
      };
    }

    if (tags !== undefined) {
      if (tags && tags.trim()) {
        updateData.tags = {
          set: [], 
          connectOrCreate: tags.split(',').map((tag) => ({
            where: { name: tag.trim() },
            create: { name: tag.trim() }
          }))
        };
      } else {
        updateData.tags = {
          set: []
        };
      }
    }

    const updatedTorrent = await db.torrent.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        category: true,
        tags: true,
        uploadedBy: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    logMessage('info', `Torrent updated: ${updatedTorrent.name}`);
    return updatedTorrent;
  } catch (error) {
    logMessage('error', `Error updating torrent: ${error.message}`);
    throw error;
  }
}

async function deleteTorrent(id) {
  try {
    await db.torrent.delete({
      where: { id: parseInt(id) }
    });
    const cacheKey = RedisKeys.cache.torrentCount();
    await redisClient.del(cacheKey);
    logMessage('info', `Torrent deleted: ${id}`);
  } catch (error) {
    logMessage('error', `Error deleting torrent: ${error.message}`);
    throw error;
  }
}

export {
  addTorrent,
  getTorrentById,
  getTorrentByInfoHash,
  getAllTorrents,
  updateTorrent,
  deleteTorrent
};