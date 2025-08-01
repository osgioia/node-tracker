import { db } from '../utils/db.server.js';
import { logMessage } from '../utils/utils.js';
import bcrypt from 'bcrypt';

// Create new user (admin only)
async function createUser(userData) {
  try {
    const { username, email, password, role = 'USER', remainingInvites = 0 } = userData;
    
    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      throw new Error('User or email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        created: new Date(),
        banned: false,
        role,
        remainingInvites,
        emailVerified: false
      }
    });

    logMessage('info', `User created by admin: ${username}`);
    return { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role };
  } catch (error) {
    logMessage('error', `Error creating user: ${error.message}`);
    throw error;
  }
}

// Get user by ID
async function getUserById(id) {
  try {
    const user = await db.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        username: true,
        email: true,
        uid: true,
        created: true,
        banned: true,
        role: true,
        remainingInvites: true,
        emailVerified: true,
        torrents: {
          select: {
            id: true,
            name: true,
            infoHash: true,
            completed: true,
            downloads: true,
            size: true
          }
        },
        bookmarks: {
          select: {
            id: true,
            time: true,
            sort: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    logMessage('error', `Error getting user: ${error.message}`);
    throw error;
  }
}

// List all users with pagination (admin only)
async function getAllUsers(page = 1, limit = 20) {
  try {
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      db.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          created: true,
          banned: true,
          role: true,
          emailVerified: true,
          remainingInvites: true,
          _count: {
            select: {
              torrents: true
            }
          }
        },
        orderBy: {
          created: 'desc'
        }
      }),
      db.user.count()
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logMessage('error', `Error listing users: ${error.message}`);
    throw error;
  }
}

// Update user
async function updateUser(id, updateData) {
  try {
    const { password, ...otherData } = updateData;
    
    const dataToUpdate = { ...otherData };
    
    // Hash new password if provided
    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await db.user.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        banned: true,
        emailVerified: true,
        remainingInvites: true
      }
    });

    logMessage('info', `User updated: ${updatedUser.username}`);
    return updatedUser;
  } catch (error) {
    logMessage('error', `Error updating user: ${error.message}`);
    throw error;
  }
}

// Ban/unban user
async function toggleUserBan(id, banned, reason = null) {
  try {
    const updatedUser = await db.user.update({
      where: { id: parseInt(id) },
      data: { banned },
      select: {
        id: true,
        username: true,
        banned: true
      }
    });

    const action = banned ? 'banned' : 'unbanned';
    logMessage('info', `User ${action}: ${updatedUser.username}${reason ? ` - Reason: ${reason}` : ''}`);
    
    return updatedUser;
  } catch (error) {
    logMessage('error', `Error changing ban status: ${error.message}`);
    throw error;
  }
}

// Get user statistics
async function getUserStats(userId) {
  try {
    const stats = await db.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        _count: {
          select: {
            torrents: true,
            bookmarks: true
          }
        },
        Progress: {
          select: {
            uploaded: true,
            download: true
          }
        }
      }
    });

    if (!stats) {
      throw new Error('User not found');
    }

    // Calculate upload/download totals
    const totalUploaded = stats.Progress.reduce((sum, p) => sum + Number(p.uploaded), 0);
    const totalDownloaded = stats.Progress.reduce((sum, p) => sum + Number(p.download), 0);
    const ratio = totalDownloaded > 0 ? totalUploaded / totalDownloaded : 0;

    return {
      torrentsUploaded: stats._count.torrents,
      bookmarks: stats._count.bookmarks,
      totalUploaded,
      totalDownloaded,
      ratio: parseFloat(ratio.toFixed(2))
    };
  } catch (error) {
    logMessage('error', `Error getting user statistics: ${error.message}`);
    throw error;
  }
}

export {
  createUser,
  getUserById,
  getAllUsers,
  updateUser,
  toggleUserBan,
  getUserStats
};