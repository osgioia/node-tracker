// src/utils/redis-keys.js
import redisClient from './redis.js';
import { logMessage } from './utils.js';

// Key generators
export const RedisKeys = {
  // Tracker Core
  torrent: {
    peers: (infoHash) => `torrent:peers:${infoHash}`,
    stats: (infoHash) => `torrent:stats:${infoHash}`
  },
  peer: (infoHash, peerId) => `peer:${infoHash}:${peerId}`,
  
  // Authentication
  auth: {
    blacklist: (jti) => `auth:blacklist:${jti}`,
    session: (token) => `user:session:${token}`,
    attempts: (ip) => `auth:login:attempts:${ip}`,
    blocked: (ip) => `auth:login:blocked:${ip}`
  },
  
  // Rate Limiting
  ratelimit: {
    api: (ip) => `ratelimit:api:${ip}`,
    announce: (passkey) => `ratelimit:announce:${passkey}`,
    auth: (ip) => `ratelimit:auth:${ip}`
  },
  
  // Bans
  ban: {
    userCheck: (userId) => `ban:user:check:${userId}`,
    ipCheck: (ip) => `ban:ip:check:${ip}`,
    active: () => 'ban:user:active'
  },
  
  // User Stats
  user: {
    stats: (userId) => `user:stats:${userId}`
  },
  
  // Cache
  cache: {
    ratio: (userId) => `cache:ratio:${userId}`,
    query: (hash) => `cache:query:${hash}`,
    torrentCount: () => 'cache:torrent:count'
  },
  
  // Invitations
  invite: {
    data: (inviteKey) => `invite:${inviteKey}`,
    remaining: (userId) => `invite:remaining:${userId}`
  },
  
  // Temporary
  temp: {
    emailVerify: (token) => `temp:email:verify:${token}`,
    passwordReset: (token) => `temp:password:reset:${token}`
  },
  
  // Health
  health: {
    db: () => 'health:db'
  }
};

// TTL constants (in seconds)
export const RedisTTL = {
  PEER_DATA: 3600,
  BAN_CHECK: 300,
  IP_BAN_CHECK: 3600,
  RATIO_CACHE: 3600,
  QUERY_CACHE: 300,
  LOGIN_ATTEMPTS: 900,
  RATE_LIMIT_API: 900,
  RATE_LIMIT_ANNOUNCE: 60,
  EMAIL_VERIFY: 86400,
  PASSWORD_RESET: 3600,
  SESSION: 3600,
  HEALTH_CHECK: 30
};

// Helper functions
export const RedisHelpers = {
  // Set with TTL
  async setWithTTL(key, value, ttl) {
    try {
      await redisClient.set(key, value, { EX: ttl });
      return true;
    } catch (error) {
      logMessage('error', `Redis setWithTTL error: ${error.message}`);
      return false;
    }
  },

  // Get or compute
  async getOrCompute(key, computeFn, ttl = 300) {
    try {
      const cached = await redisClient.get(key);
      if (cached !== null) {return JSON.parse(cached);}
      
      const computed = await computeFn();
      await redisClient.set(key, JSON.stringify(computed), { EX: ttl });
      return computed;
    } catch (error) {
      logMessage('error', `Redis getOrCompute error: ${error.message}`);
      return computeFn(); // Fallback to compute without cache
    }
  },

  // Check if user is banned (cached)
  async isUserBanned(userId) {
    const key = RedisKeys.ban.userCheck(userId);
    try {
      const cached = await redisClient.get(key);
      if (cached !== null) {return cached === 'true';}
      
      // Fallback to database check
      const { db } = await import('./db.server.js');
      const activeBan = await db.userBan.findFirst({
        where: {
          userId,
          active: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });
      
      const isBanned = !!activeBan;
      await redisClient.set(key, String(isBanned), { EX: RedisTTL.BAN_CHECK });
      return isBanned;
    } catch (error) {
      logMessage('error', `Redis isUserBanned error: ${error.message}`);
      return false;
    }
  },

  // Check if IP is banned (cached)
  async isIPBanned(ip) {
    const key = RedisKeys.ban.ipCheck(ip);
    try {
      const cached = await redisClient.get(key);
      if (cached !== null) {return cached === 'banned';}
      
      // Fallback to database check
      const { db } = await import('./db.server.js');
      const { ipToLong } = await import('./ip-utils.js');
      
      const ipLong = ipToLong(ip);
      const ban = await db.iPBan.findFirst({
        where: {
          fromIP: { lte: ipLong },
          toIP: { gte: ipLong }
        }
      });
      
      const isBanned = !!ban;
      if (isBanned) {
        await redisClient.set(key, 'banned', { EX: RedisTTL.IP_BAN_CHECK });
      }
      return isBanned;
    } catch (error) {
      logMessage('error', `Redis isIPBanned error: ${error.message}`);
      return false;
    }
  },

  // Invalidate ban cache
  async invalidateBanCache(userId) {
    try {
      await redisClient.del(RedisKeys.ban.userCheck(userId));
      await redisClient.sRem(RedisKeys.ban.active(), String(userId));
    } catch (error) {
      logMessage('error', `Redis invalidateBanCache error: ${error.message}`);
    }
  },

  // JWT Blacklist
  async blacklistToken(jti, expiresIn) {
    try {
      const key = RedisKeys.auth.blacklist(jti);
      await redisClient.set(key, 'revoked', { EX: expiresIn });
    } catch (error) {
      logMessage('error', `Redis blacklistToken error: ${error.message}`);
    }
  },

  async isTokenBlacklisted(jti) {
    try {
      const key = RedisKeys.auth.blacklist(jti);
      const result = await redisClient.get(key);
      return result === 'revoked';
    } catch (error) {
      logMessage('error', `Redis isTokenBlacklisted error: ${error.message}`);
      return false;
    }
  },

  // Rate limiting
  async checkRateLimit(key, limit, window) {
    try {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, window);
      }
      return current <= limit;
    } catch (error) {
      logMessage('error', `Redis checkRateLimit error: ${error.message}`);
      return true; // Fail open
    }
  },

  // User stats cache
  async getUserStats(userId) {
    const key = RedisKeys.user.stats(userId);
    try {
      const cached = await redisClient.hGetAll(key);
      if (Object.keys(cached).length > 0) {
        return {
          uploaded: BigInt(cached.uploaded || '0'),
          downloaded: BigInt(cached.downloaded || '0'),
          seedtime: BigInt(cached.seedtime || '0')
        };
      }
      return null;
    } catch (error) {
      logMessage('error', `Redis getUserStats error: ${error.message}`);
      return null;
    }
  },

  async updateUserStats(userId, stats) {
    const key = RedisKeys.user.stats(userId);
    try {
      await redisClient.hSet(key, {
        uploaded: String(stats.uploaded),
        downloaded: String(stats.downloaded),
        seedtime: String(stats.seedtime)
      });
      await redisClient.expire(key, RedisTTL.RATIO_CACHE);
    } catch (error) {
      logMessage('error', `Redis updateUserStats error: ${error.message}`);
    }
  }
};

export default redisClient;