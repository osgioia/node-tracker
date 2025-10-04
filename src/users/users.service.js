import { db } from '../utils/db.server.js';
import { logMessage } from '../utils/utils.js';
import bcrypt from 'bcrypt';
import redisClient from '../utils/redis.js';
import { RedisKeys } from '../utils/redis-keys.js';

async function createUser(userData) {
  try {
    const { username, email, password, role = 'USER', remainingInvites = 0 } = userData;
    
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

    const hashedPassword = await bcrypt.hash(password, 10);

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

async function getUserById(id) {
  try {
    const cacheKey = RedisKeys.user.stats(id); // Updated to use RedisKeys

    const cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
      logMessage('info', `User ${id} found in cache.`);
      const user = JSON.parse(cachedUser);
      user.uploaded = BigInt(user.uploaded);
      user.downloaded = BigInt(user.downloaded);
      return user;
    }

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
        uploaded: true,
        downloaded: true,
        seedtime: true,
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

    const uploaded = Number(user.uploaded);
    const downloaded = Number(user.downloaded);
    const ratio = downloaded > 0 ? uploaded / downloaded : 0;
    const seedtime = Number(user.seedtime);
    
    const result = {
      ...user,
      uploaded,
      downloaded,
      seedtime,
      ratio: parseFloat(ratio.toFixed(2))
    };

    const userToCache = { ...result, uploaded: result.uploaded.toString(), downloaded: result.downloaded.toString() };
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(userToCache)); // Updated TTL constant
    logMessage('info', `User ${id} stored in cache.`);

    return result;
  } catch (error) {
    logMessage('error', `Error getting user: ${error.message}`);
    throw error;
  }
}

async function getAllUsers(page = 1, limit = 20) {
  try {
    const skip = (page - 1) * limit;
    
    const [usersData, total] = await Promise.all([
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
          uploaded: true,
          downloaded: true,
          seedtime: true,
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

    const users = usersData.map(user => {
      const uploaded = Number(user.uploaded);
      const downloaded = Number(user.downloaded);
      const seedtime = Number(user.seedtime);
      const ratio = downloaded > 0 ? uploaded / downloaded : 0;

      return {
        ...user,
        uploaded,
        downloaded,
        seedtime,
        ratio: parseFloat(ratio.toFixed(2))
      };
    });

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

async function updateUser(id, updateData) {
  try {
    const { password, ...otherData } = updateData;
    
    const dataToUpdate = { ...otherData };
    
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

    const cacheKey = RedisKeys.user.stats(id); // Updated to use RedisKeys
    await redisClient.del(cacheKey);
    logMessage('info', `Cache invalidated for user ${id}.`);

    logMessage('info', `User updated: ${updatedUser.username}`);
    return updatedUser;
  } catch (error) {
    logMessage('error', `Error updating user: ${error.message}`);
    throw error;
  }
}

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
    
    const cacheKey = RedisKeys.user.stats(id); // Updated to use RedisKeys
    await redisClient.del(cacheKey);
    logMessage('info', `Cache invalidated for user ${id} due to ban status change.`);

    return updatedUser;
  } catch (error) {
    logMessage('error', `Error changing ban status: ${error.message}`);
    throw error;
  }
}

async function getUserStats(userId) {
  try {
    const stats = await db.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        uploaded: true,
        downloaded: true,
        seedtime: true,
        _count: {
          select: {
            torrents: true,
            bookmarks: true
          }
        }
      }
    });

    if (!stats) {
      throw new Error('User not found');
    }

    const totalUploaded = Number(stats.uploaded);
    const totalDownloaded = Number(stats.downloaded);
    const seedtime = Number(stats.seedtime);
    const ratio = totalDownloaded > 0 ? totalUploaded / totalDownloaded : 0;

    return {
      torrentsUploaded: stats._count.torrents,
      bookmarks: stats._count.bookmarks,
      totalUploaded,
      totalDownloaded,
      seedtime,
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