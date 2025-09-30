import { db } from '../utils/db.server.js';
import redisClient from '../config/redis-client.js';
import { getUserById, updateUser, toggleUserBan } from './users.service.js';

jest.mock('../utils/db.server.js', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../config/redis-client.js', () => ({
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
}));

describe('Users Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    const userId = '1';
    const cacheKey = `user:${userId}`;
    const mockUserFromDb = {
      id: 1,
      username: 'testuser',
      uploaded: 1024n, 
      downloaded: 512n, 
      seedtime: 3600n,
    };
    const mockUserForCache = {
      ...mockUserFromDb,
      uploaded: '1024', 
      downloaded: '512', 
      seedtime: 3600,
      ratio: 2.00,
    };

    it('should fetch user from DB and store in cache if not cached', async () => {
      redisClient.get.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(mockUserFromDb);

      const result = await getUserById(userId);

      expect(redisClient.get).toHaveBeenCalledWith(cacheKey);
      expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 }, select: expect.any(Object) });
      expect(redisClient.setEx).toHaveBeenCalledWith(cacheKey, 3600, JSON.stringify(expect.objectContaining({ id: 1, uploaded: '1024' })));
      expect(result.username).toBe('testuser');
      expect(result.uploaded).toBe(1024); 
    });

    it('should fetch user from cache if available', async () => {
      redisClient.get.mockResolvedValue(JSON.stringify(mockUserForCache));

      const result = await getUserById(userId);

      expect(redisClient.get).toHaveBeenCalledWith(cacheKey);
      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(redisClient.setEx).not.toHaveBeenCalled();
      expect(result.username).toBe('testuser');
      expect(result.uploaded).toBe(1024n); 
    });

    it('should throw an error if user is not found in DB or cache', async () => {
      redisClient.get.mockResolvedValue(null);
      db.user.findUnique.mockResolvedValue(null);

      await expect(getUserById(userId)).rejects.toThrow('User not found');
    });
  });

  describe('updateUser', () => {
    it('should invalidate cache after updating a user', async () => {
      const userId = '1';
      const cacheKey = `user:${userId}`;
      const updateData = { email: 'new@email.com' };
      const updatedUser = { id: 1, email: 'new@email.com' };

      db.user.update.mockResolvedValue(updatedUser);

      await updateUser(userId, updateData);

      expect(db.user.update).toHaveBeenCalled();
      expect(redisClient.del).toHaveBeenCalledWith(cacheKey);
    });
  });

  describe('toggleUserBan', () => {
    it('should invalidate cache after changing user ban status', async () => {
      const userId = '1';
      const cacheKey = `user:${userId}`;
      const updatedUser = { id: 1, banned: true };

      db.user.update.mockResolvedValue(updatedUser);

      await toggleUserBan(userId, true);

      expect(db.user.update).toHaveBeenCalled();
      expect(redisClient.del).toHaveBeenCalledWith(cacheKey);
    });
  });
});