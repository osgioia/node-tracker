import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockDb = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
};

const mockLogMessage = jest.fn();

jest.unstable_mockModule('../../utils/db.server.js', () => ({
  db: mockDb
}));

jest.unstable_mockModule('../../utils/utils.js', () => ({
  logMessage: mockLogMessage
}));

jest.unstable_mockModule('bcrypt', () => ({
  default: {
    hash: jest.fn().mockResolvedValue('hashedpassword')
  }
}));

const {
  getUserById,
  getUserStats,
  getAllUsers
} = await import('../users.service.js');

describe('Users Service - Ratio Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById with ratio', () => {
    it('should return user with calculated ratio', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        uid: 'test-uid',
        created: new Date(),
        banned: false,
        role: 'USER',
        remainingInvites: 5,
        emailVerified: true,
        uploaded: BigInt(5368709120), // 5 GB
        downloaded: BigInt(2684354560), // 2.5 GB
        seedtime: BigInt(86400), // 24 hours
        torrents: [],
        bookmarks: []
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserById(1);

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
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

      expect(result).toEqual({
        ...mockUser,
        uploaded: 5368709120,
        downloaded: 2684354560,
        seedtime: 86400,
        ratio: 2.0 // 5GB / 2.5GB = 2.0
      });
    });

    it('should handle zero download ratio correctly', async () => {
      const mockUser = {
        id: 1,
        username: 'newuser',
        email: 'new@example.com',
        uid: 'new-uid',
        created: new Date(),
        banned: false,
        role: 'USER',
        remainingInvites: 5,
        emailVerified: true,
        uploaded: BigInt(1073741824), // 1 GB
        downloaded: BigInt(0), // 0 GB
        seedtime: BigInt(3600), // 1 hour
        torrents: [],
        bookmarks: []
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserById(1);

      expect(result.ratio).toBe(0); // Should be 0 when downloaded is 0
    });

    it('should handle perfect ratio correctly', async () => {
      const mockUser = {
        id: 1,
        username: 'perfectuser',
        email: 'perfect@example.com',
        uid: 'perfect-uid',
        created: new Date(),
        banned: false,
        role: 'USER',
        remainingInvites: 5,
        emailVerified: true,
        uploaded: BigInt(1073741824), // 1 GB
        downloaded: BigInt(1073741824), // 1 GB
        seedtime: BigInt(7200), // 2 hours
        torrents: [],
        bookmarks: []
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserById(1);

      expect(result.ratio).toBe(1.0); // Perfect 1:1 ratio
    });

    it('should throw error if user not found', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(getUserById(999)).rejects.toThrow('User not found');
    });
  });

  describe('getUserStats with ratio', () => {
    it('should return user statistics with ratio', async () => {
      const mockStats = {
        uploaded: BigInt(10737418240), // 10 GB
        downloaded: BigInt(5368709120), // 5 GB
        seedtime: BigInt(172800), // 48 hours
        _count: {
          torrents: 8,
          bookmarks: 4
        }
      };

      mockDb.user.findUnique.mockResolvedValue(mockStats);

      const result = await getUserStats(1);

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
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

      expect(result).toEqual({
        torrentsUploaded: 8,
        bookmarks: 4,
        totalUploaded: 10737418240,
        totalDownloaded: 5368709120,
        seedtime: 172800,
        ratio: 2.0 // 10GB / 5GB = 2.0
      });
    });

    it('should handle low ratio correctly', async () => {
      const mockStats = {
        uploaded: BigInt(1073741824), // 1 GB
        downloaded: BigInt(5368709120), // 5 GB
        seedtime: BigInt(43200), // 12 hours
        _count: {
          torrents: 2,
          bookmarks: 1
        }
      };

      mockDb.user.findUnique.mockResolvedValue(mockStats);

      const result = await getUserStats(1);

      expect(result.ratio).toBe(0.2); // 1GB / 5GB = 0.2
    });

    it('should throw error if user not found', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(getUserStats(999)).rejects.toThrow('User not found');
    });
  });

  describe('getAllUsers with ratio', () => {
    it('should return all users with calculated ratios', async () => {
      const mockUsers = [
        {
          id: 1,
          username: 'user1',
          email: 'user1@example.com',
          created: new Date(),
          banned: false,
          role: 'USER',
          emailVerified: true,
          remainingInvites: 5,
          uploaded: BigInt(5368709120), // 5 GB
          downloaded: BigInt(2684354560), // 2.5 GB
          seedtime: BigInt(86400), // 24 hours
          _count: { torrents: 3 }
        },
        {
          id: 2,
          username: 'user2',
          email: 'user2@example.com',
          created: new Date(),
          banned: false,
          role: 'USER',
          emailVerified: true,
          remainingInvites: 3,
          uploaded: BigInt(1073741824), // 1 GB
          downloaded: BigInt(5368709120), // 5 GB
          seedtime: BigInt(43200), // 12 hours
          _count: { torrents: 1 }
        }
      ];

      mockDb.user.findMany.mockResolvedValue(mockUsers);
      mockDb.user.count.mockResolvedValue(2);

      const result = await getAllUsers(1, 20);

      expect(mockDb.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
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
      });

      expect(result.users).toHaveLength(2);
      expect(result.users[0]).toEqual({
        ...mockUsers[0],
        uploaded: 5368709120,
        downloaded: 2684354560,
        seedtime: 86400,
        ratio: 2.0 // 5GB / 2.5GB = 2.0
      });
      expect(result.users[1]).toEqual({
        ...mockUsers[1],
        uploaded: 1073741824,
        downloaded: 5368709120,
        seedtime: 43200,
        ratio: 0.2 // 1GB / 5GB = 0.2
      });

      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        pages: 1
      });
    });

    it('should handle pagination correctly', async () => {
      mockDb.user.findMany.mockResolvedValue([]);
      mockDb.user.count.mockResolvedValue(50);

      const result = await getAllUsers(3, 10);

      expect(mockDb.user.findMany).toHaveBeenCalledWith({
        skip: 20, // (3-1) * 10 = 20
        take: 10,
        select: expect.any(Object),
        orderBy: {
          created: 'desc'
        }
      });

      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 50,
        pages: 5 // Math.ceil(50/10) = 5
      });
    });

    it('should handle users with zero downloads', async () => {
      const mockUsers = [
        {
          id: 1,
          username: 'seeder',
          email: 'seeder@example.com',
          created: new Date(),
          banned: false,
          role: 'USER',
          emailVerified: true,
          remainingInvites: 5,
          uploaded: BigInt(10737418240), // 10 GB
          downloaded: BigInt(0), // 0 GB
          seedtime: BigInt(259200), // 72 hours
          _count: { torrents: 5 }
        }
      ];

      mockDb.user.findMany.mockResolvedValue(mockUsers);
      mockDb.user.count.mockResolvedValue(1);

      const result = await getAllUsers(1, 20);

      expect(result.users[0].ratio).toBe(0); // Should be 0 when downloaded is 0
    });
  });

  describe('Ratio calculation edge cases', () => {
    it('should handle very large numbers correctly', async () => {
      const mockUser = {
        id: 1,
        username: 'poweruser',
        email: 'power@example.com',
        uid: 'power-uid',
        created: new Date(),
        banned: false,
        role: 'USER',
        remainingInvites: 5,
        emailVerified: true,
        uploaded: BigInt('1099511627776'), // 1 TB
        downloaded: BigInt('549755813888'), // 512 GB
        seedtime: BigInt(2592000), // 30 days
        torrents: [],
        bookmarks: []
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserById(1);

      expect(result.ratio).toBe(2.0); // 1TB / 512GB = 2.0
    });

    it('should round ratio to 2 decimal places', async () => {
      const mockUser = {
        id: 1,
        username: 'preciseuser',
        email: 'precise@example.com',
        uid: 'precise-uid',
        created: new Date(),
        banned: false,
        role: 'USER',
        remainingInvites: 5,
        emailVerified: true,
        uploaded: BigInt(1000000000), // ~1 GB
        downloaded: BigInt(3000000000), // ~3 GB
        seedtime: BigInt(7200),
        torrents: [],
        bookmarks: []
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserById(1);

      expect(result.ratio).toBe(0.33); // Should be rounded to 2 decimal places
    });
  });
});