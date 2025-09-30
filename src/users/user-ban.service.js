import { db } from '../utils/db.server.js';
import { logMessage } from '../utils/utils.js';

async function createUserBan(banData) {
  try {
    const { userId, reason, bannedBy, expiresAt = null } = banData;
    
    const user = await db.user.findUnique({
      where: { id: parseInt(userId) },
      select: { id: true, username: true, banned: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const userBan = await db.userBan.create({
      data: {
        userId: parseInt(userId),
        reason,
        bannedBy,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        active: true
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    await db.user.update({
      where: { id: parseInt(userId) },
      data: { banned: true }
    });

    const banType = expiresAt ? `temporary (expires: ${new Date(expiresAt).toISOString()})` : 'permanent';
    logMessage('info', `User banned (${banType}): ${user.username} by ${bannedBy} - Reason: ${reason}`);
    return userBan;
  } catch (error) {
    logMessage('error', `Error creating user ban: ${error.message}`);
    throw error;
  }
}

async function banUserForDays(userId, reason, bannedBy, days) {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    
    const banData = {
      userId,
      reason,
      bannedBy,
      expiresAt
    };
    
    const userBan = await createUserBan(banData);
    logMessage('info', `User banned for ${days} days: ${userBan.user.username}`);
    return userBan;
  } catch (error) {
    logMessage('error', `Error banning user for ${days} days: ${error.message}`);
    throw error;
  }
}

async function banUserFor7Days(userId, reason, bannedBy) {
  return await banUserForDays(userId, reason, bannedBy, 7);
}

async function banUserFor15Days(userId, reason, bannedBy) {
  return await banUserForDays(userId, reason, bannedBy, 15);
}

async function banUserFor30Days(userId, reason, bannedBy) {
  return await banUserForDays(userId, reason, bannedBy, 30);
}

async function banUserPermanently(userId, reason, bannedBy) {
  try {
    const banData = {
      userId,
      reason,
      bannedBy,
      expiresAt: null // null = permanent ban
    };
    
    const userBan = await createUserBan(banData);
    logMessage('info', `User permanently banned: ${userBan.user.username}`);
    return userBan;
  } catch (error) {
    logMessage('error', `Error permanently banning user: ${error.message}`);
    throw error;
  }
}

async function getUserBanById(banId) {
  try {
    const userBan = await db.userBan.findUnique({
      where: { id: parseInt(banId) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!userBan) {
      throw new Error('User ban not found');
    }

    return userBan;
  } catch (error) {
    logMessage('error', `Error getting user ban: ${error.message}`);
    throw error;
  }
}

async function getUserBans(userId) {
  try {
    const userBans = await db.userBan.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { bannedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    return userBans;
  } catch (error) {
    logMessage('error', `Error getting user bans: ${error.message}`);
    throw error;
  }
}

async function getActiveUserBan(userId) {
  try {
    const activeBan = await db.userBan.findFirst({
      where: {
        userId: parseInt(userId),
        active: true,
        OR: [
          { expiresAt: null }, // Permanent ban
          { expiresAt: { gt: new Date() } } // Not expired yet
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    return activeBan;
  } catch (error) {
    logMessage('error', `Error getting active user ban: ${error.message}`);
    throw error;
  }
}

async function getAllUserBans(page = 1, limit = 20, filters = {}) {
  try {
    const skip = (page - 1) * limit;
    const { active, userId, bannedBy } = filters;
    
    const whereClause = {};
    
    if (active !== undefined) {
      whereClause.active = active;
    }
    
    if (userId) {
      whereClause.userId = parseInt(userId);
    }
    
    if (bannedBy) {
      whereClause.bannedBy = { contains: bannedBy, mode: 'insensitive' };
    }

    const [userBans, total] = await Promise.all([
      db.userBan.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { bannedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      }),
      db.userBan.count({ where: whereClause })
    ]);

    return {
      userBans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logMessage('error', `Error listing user bans: ${error.message}`);
    throw error;
  }
}

async function deactivateUserBan(banId, unbannedBy) {
  try {
    const userBan = await db.userBan.findUnique({
      where: { id: parseInt(banId) },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    if (!userBan) {
      throw new Error('User ban not found');
    }

    if (!userBan.active) {
      throw new Error('User ban is already inactive');
    }

    const updatedBan = await db.userBan.update({
      where: { id: parseInt(banId) },
      data: { active: false }
    });

    const otherActiveBans = await db.userBan.findFirst({
      where: {
        userId: userBan.userId,
        id: { not: parseInt(banId) },
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    // If no other active bans, unban the user
    if (!otherActiveBans) {
      await db.user.update({
        where: { id: userBan.userId },
        data: { banned: false }
      });
    }

    logMessage('info', `User ban deactivated: ${userBan.user.username} by ${unbannedBy}`);
    return updatedBan;
  } catch (error) {
    logMessage('error', `Error deactivating user ban: ${error.message}`);
    throw error;
  }
}

async function isUserBanned(userId) {
  try {
    const activeBan = await getActiveUserBan(userId);
    return !!activeBan;
  } catch (error) {
    logMessage('error', `Error checking if user is banned: ${error.message}`);
    throw error;
  }
}

async function cleanupExpiredBans() {
  try {
    const expiredBans = await db.userBan.findMany({
      where: {
        active: true,
        expiresAt: { lt: new Date() }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    if (expiredBans.length === 0) {
      return { cleaned: 0 };
    }

    await db.userBan.updateMany({
      where: {
        active: true,
        expiresAt: { lt: new Date() }
      },
      data: { active: false }
    });

    for (const ban of expiredBans) {
      const otherActiveBans = await db.userBan.findFirst({
        where: {
          userId: ban.userId,
          id: { not: ban.id },
          active: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });

      if (!otherActiveBans) {
        await db.user.update({
          where: { id: ban.userId },
          data: { banned: false }
        });
        logMessage('info', `User automatically unbanned due to expired ban: ${ban.user.username}`);
      }
    }

    logMessage('info', `Cleaned up ${expiredBans.length} expired bans`);
    return { cleaned: expiredBans.length };
  } catch (error) {
    logMessage('error', `Error cleaning up expired bans: ${error.message}`);
    throw error;
  }
}

export {
  createUserBan,
  banUserForDays,
  banUserFor7Days,
  banUserFor15Days,
  banUserFor30Days,
  banUserPermanently,
  getUserBanById,
  getUserBans,
  getActiveUserBan,
  getAllUserBans,
  deactivateUserBan,
  isUserBanned,
  cleanupExpiredBans
};