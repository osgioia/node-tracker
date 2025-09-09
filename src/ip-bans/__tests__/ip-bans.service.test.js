import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock modules
const mockDb = {
  IPBan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }
};

const mockLogMessage = jest.fn();

jest.unstable_mockModule('../../utils/db.server.js', () => ({ db: mockDb }));
jest.unstable_mockModule('../../utils/utils.js', () => ({ logMessage: mockLogMessage }));

// Import after mocking
const {
  listAllIPBans,
  createIPBan,
  getIPBanById,
  updateIPBan,
  deleteIPBan,
  bulkCreateIPBans
} = await import('../ip-bans.service.js');

describe('IP Bans Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listAllIPBans', () => {
    it('should list all IP bans with pagination', async () => {
      const mockIPBans = [
        { id: 1, fromIP: '192.168.1.1', toIP: '192.168.1.1', reason: 'Spam' },
        { id: 2, fromIP: '10.0.0.1', toIP: '10.0.0.255', reason: 'Abuse' }
      ];

      mockDb.IPBan.findMany.mockResolvedValue(mockIPBans);
      mockDb.IPBan.count.mockResolvedValue(2);

      const result = await listAllIPBans(1, 20);

      expect(mockDb.IPBan.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { id: 'desc' }
      });
      expect(mockDb.IPBan.count).toHaveBeenCalled();
      expect(result).toHaveProperty('ipBans', mockIPBans);
      expect(result).toHaveProperty('pagination');
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.pages).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      mockDb.IPBan.findMany.mockResolvedValue([]);
      mockDb.IPBan.count.mockResolvedValue(50);

      const result = await listAllIPBans(3, 10);

      expect(mockDb.IPBan.findMany).toHaveBeenCalledWith({
        skip: 20, // (3-1) * 10
        take: 10,
        orderBy: { id: 'desc' }
      });
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.pages).toBe(5);
    });
  });

  describe('createIPBan', () => {
    it('should create a new IP ban successfully', async () => {
      const ipBanData = {
        fromIP: '192.168.1.1',
        toIP: '192.168.1.1',
        reason: 'Spam activity'
      };

      const mockCreatedIPBan = {
        id: 1,
        ...ipBanData,
        created: new Date()
      };

      mockDb.IPBan.create.mockResolvedValue(mockCreatedIPBan);

      const result = await createIPBan(ipBanData);

      expect(mockDb.IPBan.create).toHaveBeenCalledWith({
        data: ipBanData
      });
      expect(result).toEqual(mockCreatedIPBan);
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'IP ban created: 192.168.1.1 - 192.168.1.1');
    });

    it('should handle creation errors', async () => {
      const ipBanData = {
        fromIP: '192.168.1.1',
        toIP: '192.168.1.1',
        reason: 'Spam activity'
      };

      mockDb.IPBan.create.mockRejectedValue(new Error('Database error'));

      await expect(createIPBan(ipBanData)).rejects.toThrow('Database error');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error creating IP ban: Database error');
    });
  });

  describe('getIPBanById', () => {
    it('should get IP ban by id successfully', async () => {
      const mockIPBan = {
        id: 1,
        fromIP: '192.168.1.1',
        toIP: '192.168.1.1',
        reason: 'Spam activity'
      };

      mockDb.IPBan.findUnique.mockResolvedValue(mockIPBan);

      const result = await getIPBanById(1);

      expect(mockDb.IPBan.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(result).toEqual(mockIPBan);
    });

    it('should throw error if IP ban not found', async () => {
      mockDb.IPBan.findUnique.mockResolvedValue(null);

      await expect(getIPBanById(999)).rejects.toThrow('IP ban not found');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error getting IP ban: IP ban not found');
    });
  });

  describe('updateIPBan', () => {
    it('should update IP ban successfully', async () => {
      const updateData = {
        fromIP: '192.168.1.2',
        toIP: '192.168.1.2',
        reason: 'Updated reason'
      };

      const mockUpdatedIPBan = {
        id: 1,
        ...updateData
      };

      mockDb.IPBan.update.mockResolvedValue(mockUpdatedIPBan);

      const result = await updateIPBan(1, updateData);

      expect(mockDb.IPBan.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData
      });
      expect(result).toEqual(mockUpdatedIPBan);
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'IP ban updated: 1');
    });

    it('should throw error if IP ban not found during update', async () => {
      const updateData = { reason: 'Updated reason' };

      mockDb.IPBan.update.mockRejectedValue({ code: 'P2025' }); // Prisma not found error

      await expect(updateIPBan(999, updateData)).rejects.toThrow('IP ban not found');
    });

    it('should handle other update errors', async () => {
      const updateData = { reason: 'Updated reason' };

      mockDb.IPBan.update.mockRejectedValue(new Error('Database error'));

      await expect(updateIPBan(1, updateData)).rejects.toThrow('Database error');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error updating IP ban: Database error');
    });
  });

  describe('deleteIPBan', () => {
    it('should delete IP ban successfully', async () => {
      mockDb.IPBan.delete.mockResolvedValue({});

      await deleteIPBan(1);

      expect(mockDb.IPBan.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'IP ban deleted: 1');
    });

    it('should throw error if IP ban not found during deletion', async () => {
      mockDb.IPBan.delete.mockRejectedValue({ code: 'P2025' }); // Prisma not found error

      await expect(deleteIPBan(999)).rejects.toThrow('IP ban not found');
    });

    it('should handle other deletion errors', async () => {
      mockDb.IPBan.delete.mockRejectedValue(new Error('Database error'));

      await expect(deleteIPBan(1)).rejects.toThrow('Database error');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error deleting IP ban: Database error');
    });
  });

  describe('bulkCreateIPBans', () => {
    it('should bulk create IP bans successfully', async () => {
      const ipBansData = [
        { fromIP: '192.168.1.1', toIP: '192.168.1.1', reason: 'Spam' },
        { fromIP: '10.0.0.1', toIP: '10.0.0.255', reason: 'Abuse' }
      ];

      const mockResult = { count: 2 };

      mockDb.IPBan.createMany.mockResolvedValue(mockResult);

      const result = await bulkCreateIPBans(ipBansData);

      expect(mockDb.IPBan.createMany).toHaveBeenCalledWith({
        data: ipBansData,
        skipDuplicates: true
      });
      expect(result).toEqual(mockResult);
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'Bulk IP bans created: 2 records');
    });

    it('should handle bulk creation errors', async () => {
      const ipBansData = [
        { fromIP: '192.168.1.1', toIP: '192.168.1.1', reason: 'Spam' }
      ];

      mockDb.IPBan.createMany.mockRejectedValue(new Error('Bulk creation failed'));

      await expect(bulkCreateIPBans(ipBansData)).rejects.toThrow('Bulk creation failed');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error bulk creating IP bans: Bulk creation failed');
    });
  });
});