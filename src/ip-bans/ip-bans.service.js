import { db } from '../utils/db.server.js';
import { logMessage } from '../utils/utils.js';

// List all IP bans with pagination
async function listAllIPBans(query = {}) {
  try {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const [ipBans, total] = await Promise.all([
      db.IPBan.findMany({
        skip,
        take: limit,
        orderBy: {
          id: 'desc'
        }
      }),
      db.IPBan.count()
    ]);

    return {
      ipBans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logMessage('error', `Error listing IP bans: ${error.message}`);
    throw error;
  }
}

// Create single IP ban
async function createIPBan(data) {
  try {
    const ipBan = await db.IPBan.create({
      data
    });
    
    logMessage('info', `IP ban created: ${data.fromIP} - ${data.toIP}`);
    return ipBan;
  } catch (error) {
    logMessage('error', `Error creating IP ban: ${error.message}`);
    throw error;
  }
}

// Get IP ban by ID
async function getIPBanById(id) {
  try {
    const ipBan = await db.IPBan.findUnique({
      where: { id: parseInt(id) }
    });

    if (!ipBan) {
      throw new Error('IP ban not found');
    }

    return ipBan;
  } catch (error) {
    logMessage('error', `Error getting IP ban: ${error.message}`);
    throw error;
  }
}

// Update IP ban
async function updateIPBan(id, data) {
  try {
    const ipBan = await db.IPBan.update({
      where: { id: parseInt(id) },
      data
    });
    
    logMessage('info', `IP ban updated: ${id}`);
    return ipBan;
  } catch (error) {
    if (error.code === 'P2025') {
      throw new Error('IP ban not found');
    }
    logMessage('error', `Error updating IP ban: ${error.message}`);
    throw error;
  }
}

// Delete IP ban
async function deleteIPBan(id) {
  try {
    await db.IPBan.delete({
      where: { id: parseInt(id) }
    });
    
    logMessage('info', `IP ban deleted: ${id}`);
  } catch (error) {
    if (error.code === 'P2025') {
      throw new Error('IP ban not found');
    }
    logMessage('error', `Error deleting IP ban: ${error.message}`);
    throw error;
  }
}

// Bulk create IP bans
async function bulkCreateIPBans(data) {
  try {
    const result = await db.IPBan.createMany({
      data,
      skipDuplicates: true
    });
    
    logMessage('info', `Bulk IP bans created: ${result.count} records`);
    return result;
  } catch (error) {
    logMessage('error', `Error bulk creating IP bans: ${error.message}`);
    throw error;
  }
}

export {
  listAllIPBans,
  createIPBan,
  getIPBanById,
  updateIPBan,
  deleteIPBan,
  bulkCreateIPBans
};