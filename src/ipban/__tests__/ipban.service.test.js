import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock modules
const mockDb = {
  iPBan: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createMany: jest.fn()
  }
};

const mockLogMessage = jest.fn();

jest.unstable_mockModule('../../utils/db.server.js', () => ({ db: mockDb }));
jest.unstable_mockModule('../../utils/utils.js', () => ({ logMessage: mockLogMessage }));

// Import after mocking
const {
  listAllIPBan,
  createIPBan,
  updateIPBan,
  deleteIPBan,
  bulkCreateIPBan
} = await import('../ipban.service.js');

describe('IPBan Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listAllIPBan', () => {
    it('should list all IP bans successfully', async () => {
      const mockIPBans = [
        {
          id: 1,
          fromIP: BigInt('3232235777'), // 192.168.1.1
          toIP: BigInt('3232236031'),   // 192.168.1.255
          reason: 'Spam'
        },
        {
          id: 2,
          fromIP: BigInt('167772161'),  // 10.0.0.1
          toIP: BigInt('184549375'),    // 10.255.255.255
          reason: 'Malicious activity'
        }
      ];

      mockDb.iPBan.findMany.mockResolvedValue(mockIPBans);

      const result = await listAllIPBan();

      expect(mockDb.iPBan.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockIPBans);
    });

    it('should handle database errors', async () => {
      mockDb.iPBan.findMany.mockRejectedValue(new Error('Database error'));

      const result = await listAllIPBan();

      expect(result).toBeUndefined();
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error to get data:Database error');
    });
  });

  describe('createIPBan', () => {
    it('should create IP ban successfully', async () => {
      const banData = {
        fromIP: '192.168.1.1',
        toIP: '192.168.1.255',
        reason: 'Spam'
      };

      const mockCreatedBan = {
        id: 1,
        fromIP: BigInt('3232235777'),
        toIP: BigInt('3232236031'),
        reason: 'Spam'
      };

      mockDb.iPBan.create.mockResolvedValue(mockCreatedBan);

      const result = await createIPBan(banData);

      expect(mockDb.iPBan.create).toHaveBeenCalledWith({
        data: banData
      });
      expect(result).toEqual(mockCreatedBan);
    });

    it('should handle creation errors', async () => {
      const banData = {
        fromIP: '192.168.1.1',
        toIP: '192.168.1.255',
        reason: 'Spam'
      };

      mockDb.iPBan.create.mockRejectedValue(new Error('Creation failed'));

      const result = await createIPBan(banData);

      expect(result).toBeUndefined();
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error to add ip:Creation failed');
    });
  });

  describe('updateIPBan', () => {
    it('should update IP ban successfully', async () => {
      const updateData = {
        fromIP: '192.168.1.1',
        toIP: '192.168.1.100',
        reason: 'Updated spam reason'
      };

      const mockUpdatedBan = {
        id: 1,
        fromIP: BigInt('3232235777'),
        toIP: BigInt('3232235876'),
        reason: 'Updated spam reason'
      };

      mockDb.iPBan.update.mockResolvedValue(mockUpdatedBan);

      const result = await updateIPBan(1, updateData);

      expect(mockDb.iPBan.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData
      });
      expect(result).toEqual(mockUpdatedBan);
    });

    it('should handle update errors', async () => {
      const updateData = {
        reason: 'Updated reason'
      };

      mockDb.iPBan.update.mockRejectedValue(new Error('Update failed'));

      const result = await updateIPBan(1, updateData);

      expect(result).toBeUndefined();
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error to update ip:Update failed');
    });
  });

  describe('deleteIPBan', () => {
    it('should delete IP ban successfully', async () => {
      const mockDeletedBan = {
        id: 1,
        fromIP: BigInt('3232235777'),
        toIP: BigInt('3232236031'),
        reason: 'Spam'
      };

      mockDb.iPBan.delete.mockResolvedValue(mockDeletedBan);

      const result = await deleteIPBan(1);

      expect(mockDb.iPBan.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(result).toEqual(mockDeletedBan);
    });

    it('should handle deletion errors', async () => {
      mockDb.iPBan.delete.mockRejectedValue(new Error('Deletion failed'));

      const result = await deleteIPBan(1);

      expect(result).toBeUndefined();
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error to delete ip:Deletion failed');
    });
  });

  describe('bulkCreateIPBan', () => {
    it('should create multiple IP bans successfully', async () => {
      const bulkData = [
        {
          fromIP: '192.168.1.1',
          toIP: '192.168.1.255',
          reason: 'Spam network'
        },
        {
          fromIP: '10.0.0.1',
          toIP: '10.255.255.255',
          reason: 'Corporate network'
        }
      ];

      const mockResult = {
        count: 2
      };

      mockDb.iPBan.createMany.mockResolvedValue(mockResult);

      const result = await bulkCreateIPBan(bulkData);

      expect(mockDb.iPBan.createMany).toHaveBeenCalledWith({
        data: bulkData,
        skipDuplicates: true
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle bulk creation errors', async () => {
      const bulkData = [
        {
          fromIP: '192.168.1.1',
          toIP: '192.168.1.255',
          reason: 'Spam network'
        }
      ];

      mockDb.iPBan.createMany.mockRejectedValue(new Error('Bulk creation failed'));

      const result = await bulkCreateIPBan(bulkData);

      expect(result).toBeUndefined();
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error to load bulk ips:Bulk creation failed');
    });

    it('should skip duplicates when creating bulk IP bans', async () => {
      const bulkData = [
        {
          fromIP: '192.168.1.1',
          toIP: '192.168.1.255',
          reason: 'Spam network'
        }
      ];

      mockDb.iPBan.createMany.mockResolvedValue({ count: 1 });

      await bulkCreateIPBan(bulkData);

      expect(mockDb.iPBan.createMany).toHaveBeenCalledWith({
        data: bulkData,
        skipDuplicates: true
      });
    });
  });
});