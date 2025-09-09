import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the database
const mockDb = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  userBan: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  }
};

// Mock utils
const mockLogMessage = jest.fn();

jest.unstable_mockModule('../../utils/db.server.js', () => ({
  db: mockDb
}));

jest.unstable_mockModule('../../utils/utils.js', () => ({
  logMessage: mockLogMessage
}));

const {
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
} = await import('../user-ban.service.js');

describe('UserBan Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('createUserBan', () => {
    it('should create a new user ban successfully', async () => {
      const mockUser = { id: 1, username: 'testuser', banned: false };
      const mockUserBan = {
        id: 1,
        userId: 1,
        reason: 'Test ban reason',
        bannedBy: 'admin',
        bannedAt: new Date(),
        expiresAt: null,
        active: true,
        user: { id: 1, username: 'testuser' }
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);
      mockDb.userBan.create.mockResolvedValue(mockUserBan);
      mockDb.user.update.mockResolvedValue({ ...mockUser, banned: true });

      const banData = {
        userId: 1,
        reason: 'Test ban reason',
        bannedBy: 'admin',
        expiresAt: null
      };

      const result = await createUserBan(banData);

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, username: true, banned: true }
      });

      expect(mockDb.userBan.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          reason: 'Test ban reason',
          bannedBy: 'admin',
          expiresAt: null,
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

      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { banned: true }
      });

      expect(result).toEqual(mockUserBan);
      expect(mockLogMessage).toHaveBeenCalledWith(
        'info',
        'User banned (permanent): testuser by admin - Reason: Test ban reason'
      );
    });

    it('should throw error if user not found', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      const banData = {
        userId: 999,
        reason: 'Test ban reason',
        bannedBy: 'admin'
      };

      await expect(createUserBan(banData)).rejects.toThrow('User not found');
    });
  });

  describe('banUserFor7Days', () => {
    it('should ban user for 7 days', async () => {
      const mockUser = { id: 1, username: 'testuser', banned: false };
      const mockUserBan = {
        id: 1,
        userId: 1,
        reason: 'Spam',
        bannedBy: 'admin',
        bannedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        active: true,
        user: { id: 1, username: 'testuser' }
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);
      mockDb.userBan.create.mockResolvedValue(mockUserBan);
      mockDb.user.update.mockResolvedValue({ ...mockUser, banned: true });

      const result = await banUserFor7Days(1, 'Spam', 'admin');

      expect(result).toEqual(mockUserBan);
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'User banned for 7 days: testuser');
    });
  });

  describe('banUserFor15Days', () => {
    it('should ban user for 15 days', async () => {
      const mockUser = { id: 1, username: 'testuser', banned: false };
      const mockUserBan = {
        id: 1,
        userId: 1,
        reason: 'Toxic behavior',
        bannedBy: 'moderator',
        bannedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        active: true,
        user: { id: 1, username: 'testuser' }
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);
      mockDb.userBan.create.mockResolvedValue(mockUserBan);
      mockDb.user.update.mockResolvedValue({ ...mockUser, banned: true });

      const result = await banUserFor15Days(1, 'Toxic behavior', 'moderator');

      expect(result).toEqual(mockUserBan);
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'User banned for 15 days: testuser');
    });
  });

  describe('banUserFor30Days', () => {
    it('should ban user for 30 days', async () => {
      const mockUser = { id: 1, username: 'testuser', banned: false };
      const mockUserBan = {
        id: 1,
        userId: 1,
        reason: 'Repeated violations',
        bannedBy: 'admin',
        bannedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        active: true,
        user: { id: 1, username: 'testuser' }
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);
      mockDb.userBan.create.mockResolvedValue(mockUserBan);
      mockDb.user.update.mockResolvedValue({ ...mockUser, banned: true });

      const result = await banUserFor30Days(1, 'Repeated violations', 'admin');

      expect(result).toEqual(mockUserBan);
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'User banned for 30 days: testuser');
    });
  });

  describe('banUserPermanently', () => {
    it('should ban user permanently', async () => {
      const mockUser = { id: 1, username: 'testuser', banned: false };
      const mockUserBan = {
        id: 1,
        userId: 1,
        reason: 'Severe violation',
        bannedBy: 'admin',
        bannedAt: new Date(),
        expiresAt: null,
        active: true,
        user: { id: 1, username: 'testuser' }
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);
      mockDb.userBan.create.mockResolvedValue(mockUserBan);
      mockDb.user.update.mockResolvedValue({ ...mockUser, banned: true });

      const result = await banUserPermanently(1, 'Severe violation', 'admin');

      expect(result).toEqual(mockUserBan);
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'User permanently banned: testuser');
    });
  });

  describe('getUserBanById', () => {
    it('should get user ban by ID', async () => {
      const mockUserBan = {
        id: 1,
        userId: 1,
        reason: 'Test ban',
        bannedBy: 'admin',
        bannedAt: new Date(),
        expiresAt: null,
        active: true,
        user: { id: 1, username: 'testuser', email: 'test@example.com' }
      };

      mockDb.userBan.findUnique.mockResolvedValue(mockUserBan);

      const result = await getUserBanById(1);

      expect(mockDb.userBan.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
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

      expect(result).toEqual(mockUserBan);
    });

    it('should throw error if ban not found', async () => {
      mockDb.userBan.findUnique.mockResolvedValue(null);

      await expect(getUserBanById(999)).rejects.toThrow('User ban not found');
    });
  });

  describe('getActiveUserBan', () => {
    it('should get active user ban', async () => {
      const mockActiveBan = {
        id: 1,
        userId: 1,
        reason: 'Active ban',
        bannedBy: 'admin',
        bannedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        active: true,
        user: { id: 1, username: 'testuser' }
      };

      mockDb.userBan.findFirst.mockResolvedValue(mockActiveBan);

      const result = await getActiveUserBan(1);

      expect(mockDb.userBan.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 1,
          active: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } }
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

      expect(result).toEqual(mockActiveBan);
    });

    it('should return null if no active ban', async () => {
      mockDb.userBan.findFirst.mockResolvedValue(null);

      const result = await getActiveUserBan(1);

      expect(result).toBeNull();
    });
  });

  describe('deactivateUserBan', () => {
    it('should deactivate user ban and unban user if no other active bans', async () => {
      const mockUserBan = {
        id: 1,
        userId: 1,
        active: true,
        user: { id: 1, username: 'testuser' }
      };

      mockDb.userBan.findUnique.mockResolvedValue(mockUserBan);
      mockDb.userBan.update.mockResolvedValue({ ...mockUserBan, active: false });
      mockDb.userBan.findFirst.mockResolvedValue(null); // No other active bans
      mockDb.user.update.mockResolvedValue({ id: 1, banned: false });

      const result = await deactivateUserBan(1, 'admin');

      expect(mockDb.userBan.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { active: false }
      });

      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { banned: false }
      });

      expect(mockLogMessage).toHaveBeenCalledWith('info', 'User ban deactivated: testuser by admin');
    });

    it('should throw error if ban not found', async () => {
      mockDb.userBan.findUnique.mockResolvedValue(null);

      await expect(deactivateUserBan(999, 'admin')).rejects.toThrow('User ban not found');
    });

    it('should throw error if ban already inactive', async () => {
      const mockUserBan = {
        id: 1,
        userId: 1,
        active: false,
        user: { id: 1, username: 'testuser' }
      };

      mockDb.userBan.findUnique.mockResolvedValue(mockUserBan);

      await expect(deactivateUserBan(1, 'admin')).rejects.toThrow('User ban is already inactive');
    });
  });

  describe('isUserBanned', () => {
    it('should return true if user is banned', async () => {
      const mockActiveBan = {
        id: 1,
        userId: 1,
        active: true
      };

      mockDb.userBan.findFirst.mockResolvedValue(mockActiveBan);

      const result = await isUserBanned(1);

      expect(result).toBe(true);
    });

    it('should return false if user is not banned', async () => {
      mockDb.userBan.findFirst.mockResolvedValue(null);

      const result = await isUserBanned(1);

      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredBans', () => {
    it('should cleanup expired bans and unban users', async () => {
      const expiredBans = [
        {
          id: 1,
          userId: 1,
          user: { id: 1, username: 'user1' }
        },
        {
          id: 2,
          userId: 2,
          user: { id: 2, username: 'user2' }
        }
      ];

      mockDb.userBan.findMany.mockResolvedValue(expiredBans);
      mockDb.userBan.updateMany.mockResolvedValue({ count: 2 });
      mockDb.userBan.findFirst.mockResolvedValue(null); // No other active bans
      mockDb.user.update.mockResolvedValue({});

      const result = await cleanupExpiredBans();

      expect(mockDb.userBan.updateMany).toHaveBeenCalledWith({
        where: {
          active: true,
          expiresAt: { lt: expect.any(Date) }
        },
        data: { active: false }
      });

      expect(result).toEqual({ cleaned: 2 });
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'Cleaned up 2 expired bans');
    });

    it('should return 0 if no expired bans', async () => {
      mockDb.userBan.findMany.mockResolvedValue([]);

      const result = await cleanupExpiredBans();

      expect(result).toEqual({ cleaned: 0 });
    });
  });

  describe('getAllUserBans', () => {
    it('should get all user bans with pagination', async () => {
      const mockUserBans = [
        {
          id: 1,
          userId: 1,
          reason: 'Ban 1',
          user: { id: 1, username: 'user1', email: 'user1@example.com' }
        },
        {
          id: 2,
          userId: 2,
          reason: 'Ban 2',
          user: { id: 2, username: 'user2', email: 'user2@example.com' }
        }
      ];

      mockDb.userBan.findMany.mockResolvedValue(mockUserBans);
      mockDb.userBan.count.mockResolvedValue(2);

      const result = await getAllUserBans(1, 20, {});

      expect(mockDb.userBan.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
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
      });

      expect(result).toEqual({
        userBans: mockUserBans,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1
        }
      });
    });

    it('should apply filters correctly', async () => {
      const filters = { active: true, userId: 1, bannedBy: 'admin' };
      
      mockDb.userBan.findMany.mockResolvedValue([]);
      mockDb.userBan.count.mockResolvedValue(0);

      await getAllUserBans(1, 20, filters);

      expect(mockDb.userBan.findMany).toHaveBeenCalledWith({
        where: {
          active: true,
          userId: 1,
          bannedBy: { contains: 'admin', mode: 'insensitive' }
        },
        skip: 0,
        take: 20,
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
      });
    });
  });
});