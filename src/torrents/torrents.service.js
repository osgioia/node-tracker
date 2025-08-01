import { db } from '../utils/db.server.js';
import { logMessage } from '../utils/utils.js';
import magnet from 'magnet-uri';

// Generate magnet URI
function generateMagnetURI(infoHash, name, hostname) {
  try {
    const port = process.env.PORT || 3000;
    const trackerUrl = `${hostname}:${port}/announce`;
    
    const magnetUri = magnet.encode({
      xt: `urn:btih:${infoHash}`,
      dn: name,
      tr: trackerUrl
    });
    
    return magnetUri;
  } catch (err) {
    throw new Error('Error generating magnet URI');
  }
}

// Add new torrent
async function addTorrent(torrentData) {
  try {
    const { infoHash, name, category, tags, description, size, anonymous, freeleech, uploadedById } = torrentData;
    
    // Check if torrent already exists
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
      size: size || null,
      anonymous: anonymous || false,
      freeleech: freeleech || false
    };

    // Add category if provided
    if (category) {
      torrentCreateData.category = {
        connectOrCreate: {
          where: { name: category },
          create: { name: category }
        }
      };
    }

    // Add tags if provided
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

// Get torrent by ID
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

// Get torrent by infoHash (for tracker compatibility)
async function getTorrentByInfoHash(infoHash, hostname) {
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

    const uri = generateMagnetURI(infoHash, torrent.name, hostname);
    return uri;
  } catch (error) {
    logMessage('error', `Error getting torrents: ${error.message}`);
    throw error;
  }
}

// Get all torrents with pagination and filters
async function getAllTorrents(page = 1, limit = 20, filters = {}) {
  try {
    const skip = (page - 1) * limit;
    const { category, search } = filters;

    // Build where clause
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

// Update torrent
async function updateTorrent(id, data) {
  try {
    const { category, tags, ...otherData } = data;
    
    const updateData = { ...otherData };

    // Handle category update
    if (category) {
      updateData.category = {
        connectOrCreate: {
          where: { name: category },
          create: { name: category }
        }
      };
    }

    // Handle tags update
    if (tags !== undefined) {
      if (tags && tags.trim()) {
        // Disconnect all existing tags and connect new ones
        updateData.tags = {
          set: [], // Clear existing
          connectOrCreate: tags.split(',').map((tag) => ({
            where: { name: tag.trim() },
            create: { name: tag.trim() }
          }))
        };
      } else {
        // Clear all tags
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

// Delete torrent
async function deleteTorrent(id) {
  try {
    await db.torrent.delete({
      where: { id: parseInt(id) }
    });
    
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