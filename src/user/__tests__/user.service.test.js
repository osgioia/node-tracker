import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock modules before importing
const mockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn()
};

const mockJwt = {
  sign: jest.fn()
};

const mockDb = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  invite: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn()
  },
  inviteTreeNode: {
    create: jest.fn()
  }
};

const mockLogMessage = jest.fn();

jest.unstable_mockModule('bcrypt', () => ({ default: mockBcrypt }));
jest.unstable_mockModule('jsonwebtoken', () => ({ default: mockJwt }));
jest.unstable_mockModule('../../utils/db.server.js', () => ({ db: mockDb }));
jest.unstable_mockModule('../../utils/utils.js', () => ({ 
  logMessage: mockLogMessage,
  generateToken: jest.fn().mockReturnValue('mock_token')
}));

// Import after mocking
const { 
  createUser, 
  authenticateUser, 
  getUserById, 
  getAllUsers, 
  updateUser, 
  toggleUserBan,
  createInvite,
  getUserStats
} = await import('../user.service.js');

describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      mockDb.user.findFirst.mockResolvedValue(null); // No existing user
      mockBcrypt.hash.mockResolvedValue('hashed_password');
      mockDb.user.create.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      });

      const result = await createUser(userData);

      expect(mockDb.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: 'testuser' },
            { email: 'test@example.com' }
          ]
        }
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockDb.user.create).toHaveBeenCalled();
      expect(result).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      });
    });

    it('should throw error if user already exists', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      mockDb.user.findFirst.mockResolvedValue({ id: 1 }); // Existing user

      await expect(createUser(userData)).rejects.toThrow('User or email already exists');
    });

    it('should create user with valid invite', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      mockDb.user.findFirst.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed_password');
      mockDb.user.create.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      });

      const result = await createUser(userData);

      expect(mockDb.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: 'testuser' },
            { email: 'test@example.com' }
          ]
        }
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockDb.user.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error with invalid invite', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      mockDb.user.findFirst.mockResolvedValue({
        id: 1,
        username: 'testuser'
      }); // Existing user

      await expect(createUser(userData)).rejects.toThrow('User or email already exists');
    });
  });

  describe('authenticateUser', () => {
    it('should authenticate user successfully', async () => {
      const username = 'testuser';
      const password = 'password123';

      mockDb.user.findFirst.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed_password',
        banned: false,
        role: 'USER',
        emailVerified: true
      });
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await authenticateUser(username, password);

      expect(mockDb.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: 'testuser' },
            { email: 'testuser' }
          ]
        }
      });
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.username).toBe('testuser');
    });

    it('should throw error for non-existent user', async () => {
      mockDb.user.findFirst.mockResolvedValue(null);

      await expect(authenticateUser('nonexistent', 'password')).rejects.toThrow('User not found');
    });

    it('should throw error for banned user', async () => {
      mockDb.user.findFirst.mockResolvedValue({
        id: 1,
        username: 'testuser',
        banned: true
      });

      await expect(authenticateUser('testuser', 'password')).rejects.toThrow('User is banned');
    });

    it('should throw error for invalid password', async () => {
      mockDb.user.findFirst.mockResolvedValue({
        id: 1,
        username: 'testuser',
        password: 'hashed_password',
        banned: false
      });
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(authenticateUser('testuser', 'wrongpassword')).rejects.toThrow('Incorrect password');
    });
  });

  describe('getUserById', () => {
    it('should get user by id successfully', async () => {
      const userId = 1;
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        torrents: [],
        bookmarks: []
      };

      mockDb.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserById(userId);

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.any(Object)
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error if user not found', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(getUserById(999)).rejects.toThrow('User not found');
    });
  });

  describe('getAllUsers', () => {
    it('should get all users with pagination', async () => {
      const mockUsers = [
        { id: 1, username: 'user1' },
        { id: 2, username: 'user2' }
      ];

      mockDb.user.findMany.mockResolvedValue(mockUsers);
      mockDb.user.count.mockResolvedValue(2);

      const result = await getAllUsers(1, 20);

      expect(mockDb.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        select: expect.any(Object),
        orderBy: { created: 'desc' }
      });
      expect(mockDb.user.count).toHaveBeenCalled();
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('pagination');
      expect(result.users).toEqual(mockUsers);
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userId = 1;
      const updateData = { username: 'newusername' };
      const mockUpdatedUser = { id: 1, username: 'newusername' };

      mockDb.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await updateUser(userId, updateData);

      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { username: 'newusername' },
        select: expect.any(Object)
      });
      expect(result).toEqual(mockUpdatedUser);
    });

    it('should hash password when updating', async () => {
      const userId = 1;
      const updateData = { password: 'newpassword' };
      const mockUpdatedUser = { id: 1, username: 'testuser' };

      mockBcrypt.hash.mockResolvedValue('new_hashed_password');
      mockDb.user.update.mockResolvedValue(mockUpdatedUser);

      await updateUser(userId, updateData);

      expect(mockBcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { password: 'new_hashed_password' },
        select: expect.any(Object)
      });
    });
  });

  describe('toggleUserBan', () => {
    it('should ban user successfully', async () => {
      const userId = 1;
      const mockUser = { id: 1, username: 'testuser', banned: true };

      mockDb.user.update.mockResolvedValue(mockUser);

      const result = await toggleUserBan(userId, true, 'Violation');

      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { banned: true },
        select: expect.any(Object)
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('createInvite', () => {
    it('should create invite successfully', async () => {
      const inviterId = 1;
      const email = 'invite@example.com';
      const reason = 'Friend';

      mockDb.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'inviter',
        remainingInvites: 5
      });
      mockDb.invite.create.mockResolvedValue({
        id: 1,
        inviteKey: 'inv_123_abc',
        email: 'invite@example.com'
      });
      mockDb.user.update.mockResolvedValue({});

      const result = await createInvite(inviterId, email, reason);

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(mockDb.invite.create).toHaveBeenCalled();
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { remainingInvites: { decrement: 1 } }
      });
      expect(result).toBeDefined();
    });

    it('should throw error if no invites remaining', async () => {
      mockDb.user.findUnique.mockResolvedValue({
        id: 1,
        remainingInvites: 0
      });

      await expect(createInvite(1, 'test@example.com', 'reason')).rejects.toThrow('No invitations remaining');
    });
  });

  describe('getUserStats', () => {
    it('should get user stats successfully', async () => {
      const userId = 1;
      const mockStats = {
        _count: {
          torrents: 5,
          bookmarks: 3
        },
        Progress: [
          { uploaded: BigInt(1000), download: BigInt(500) },
          { uploaded: BigInt(2000), download: BigInt(1500) }
        ]
      };

      mockDb.user.findUnique.mockResolvedValue(mockStats);

      const result = await getUserStats(userId);

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.any(Object)
      });
      expect(result).toHaveProperty('torrentsUploaded', 5);
      expect(result).toHaveProperty('bookmarks', 3);
      expect(result).toHaveProperty('totalUploaded', 3000);
      expect(result).toHaveProperty('totalDownloaded', 2000);
      expect(result).toHaveProperty('ratio', 1.5);
    });
  });
});