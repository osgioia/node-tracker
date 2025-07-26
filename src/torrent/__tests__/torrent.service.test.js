import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Set up environment variables
process.env.PORT = '3000';

// Mock modules
const mockDb = {
  torrent: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
};

const mockLogMessage = jest.fn();

const mockMagnet = {
  encode: jest.fn()
};

jest.unstable_mockModule('../../utils/db.server.js', () => ({ db: mockDb }));
jest.unstable_mockModule('../../utils/utils.js', () => ({ logMessage: mockLogMessage }));
jest.unstable_mockModule('magnet-uri', () => ({ default: mockMagnet }));

// Import after mocking
const {
  addTorrent,
  searchTorrent,
  updateTorrent,
  deleteTorrent
} = await import('../torrent.service.js');

describe('Torrent Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addTorrent', () => {
    it('should add torrent successfully with all fields', async () => {
      const mockTorrent = {
        id: 1,
        infoHash: 'abc123',
        name: 'Test Torrent',
        uploadedById: 1,
        category: { id: 1, name: 'Movies' },
        tags: [{ id: 1, name: 'action' }, { id: 2, name: 'hd' }],
        uploadedBy: { id: 1, username: 'testuser' }
      };

      mockDb.torrent.create.mockResolvedValue(mockTorrent);

      const result = await addTorrent('abc123', 'Test Torrent', 'Movies', 'action, hd', 1);

      expect(mockDb.torrent.create).toHaveBeenCalledWith({
        data: {
          infoHash: 'abc123',
          name: 'Test Torrent',
          uploadedById: 1,
          category: {
            connectOrCreate: {
              where: { name: 'Movies' },
              create: { name: 'Movies' }
            }
          },
          tags: {
            connectOrCreate: [
              {
                where: { name: 'action' },
                create: { name: 'action' }
              },
              {
                where: { name: 'hd' },
                create: { name: 'hd' }
              }
            ]
          }
        },
        include: {
          category: true,
          tags: true,
          uploadedBy: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      expect(result).toEqual(mockTorrent);
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'Torrent added: Test Torrent by user 1');
    });

    it('should add torrent without category and tags', async () => {
      const mockTorrent = {
        id: 1,
        infoHash: 'abc123',
        name: 'Test Torrent',
        uploadedById: 1,
        uploadedBy: { id: 1, username: 'testuser' }
      };

      mockDb.torrent.create.mockResolvedValue(mockTorrent);

      const result = await addTorrent('abc123', 'Test Torrent', null, null, 1);

      expect(mockDb.torrent.create).toHaveBeenCalledWith({
        data: {
          infoHash: 'abc123',
          name: 'Test Torrent',
          uploadedById: 1
        },
        include: {
          category: true,
          tags: true,
          uploadedBy: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      expect(result).toEqual(mockTorrent);
    });

    it('should handle empty tags string', async () => {
      const mockTorrent = {
        id: 1,
        infoHash: 'abc123',
        name: 'Test Torrent',
        uploadedById: 1
      };

      mockDb.torrent.create.mockResolvedValue(mockTorrent);

      await addTorrent('abc123', 'Test Torrent', 'Movies', '   ', 1);

      expect(mockDb.torrent.create).toHaveBeenCalledWith({
        data: {
          infoHash: 'abc123',
          name: 'Test Torrent',
          uploadedById: 1,
          category: {
            connectOrCreate: {
              where: { name: 'Movies' },
              create: { name: 'Movies' }
            }
          }
        },
        include: expect.any(Object)
      });
    });

    it('should handle database errors', async () => {
      mockDb.torrent.create.mockRejectedValue(new Error('Database error'));

      await expect(addTorrent('abc123', 'Test Torrent', null, null, 1))
        .rejects.toThrow('Database error');

      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error adding torrent: Database error');
    });
  });

  describe('searchTorrent (getTorrent)', () => {
    it('should get torrent and generate magnet URI successfully', async () => {
      const mockTorrent = {
        id: 1,
        infoHash: 'abc123',
        name: 'Test Torrent',
        category: { name: 'Movies' },
        tags: [{ name: 'action' }],
        uploadedBy: { id: 1, username: 'testuser' }
      };

      const mockMagnetUri = 'magnet:?xt=urn:btih:abc123&dn=Test+Torrent&tr=localhost:3000/announce';

      mockDb.torrent.findFirst.mockResolvedValue(mockTorrent);
      mockMagnet.encode.mockReturnValue(mockMagnetUri);

      const result = await searchTorrent('abc123', 'localhost');

      expect(mockDb.torrent.findFirst).toHaveBeenCalledWith({
        where: { infoHash: 'abc123' },
        include: {
          category: true,
          tags: true,
          uploadedBy: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      expect(mockMagnet.encode).toHaveBeenCalledWith({
        xt: 'urn:btih:abc123',
        dn: 'Test Torrent',
        tr: 'localhost:3000/announce'
      });

      expect(result).toBe(mockMagnetUri);
    });

    it('should throw error if torrent not found', async () => {
      mockDb.torrent.findFirst.mockResolvedValue(null);

      await expect(searchTorrent('nonexistent', 'localhost'))
        .rejects.toThrow('Torrent not found');

      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error getting torrents: Torrent not found');
    });

    it('should handle database errors', async () => {
      mockDb.torrent.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(searchTorrent('abc123', 'localhost'))
        .rejects.toThrow('Database error');

      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error getting torrents: Database error');
    });
  });

  describe('updateTorrent', () => {
    it('should update torrent successfully', async () => {
      const updateData = {
        name: 'Updated Torrent Name',
        description: 'Updated description'
      };

      const mockUpdatedTorrent = {
        id: 1,
        name: 'Updated Torrent Name',
        description: 'Updated description',
        category: { name: 'Movies' },
        tags: [{ name: 'action' }],
        uploadedBy: { id: 1, username: 'testuser' }
      };

      mockDb.torrent.update.mockResolvedValue(mockUpdatedTorrent);

      const result = await updateTorrent(1, updateData);

      expect(mockDb.torrent.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
        include: {
          category: true,
          tags: true,
          uploadedBy: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      expect(result).toEqual(mockUpdatedTorrent);
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'Torrent updated: Updated Torrent Name');
    });

    it('should handle update errors', async () => {
      mockDb.torrent.update.mockRejectedValue(new Error('Update failed'));

      await expect(updateTorrent(1, { name: 'New Name' }))
        .rejects.toThrow('Update failed');

      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error updating torrent: Update failed');
    });
  });

  describe('deleteTorrent', () => {
    it('should delete torrent successfully', async () => {
      mockDb.torrent.delete.mockResolvedValue({ id: 1 });

      await deleteTorrent(1);

      expect(mockDb.torrent.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });

      expect(mockLogMessage).toHaveBeenCalledWith('info', 'Torrent deleted');
    });

    it('should handle delete errors gracefully', async () => {
      mockDb.torrent.delete.mockRejectedValue(new Error('Delete failed'));

      // Should not throw, just log the error
      await deleteTorrent(1);

      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error deleting torrent: Delete failed');
    });
  });

  describe('generateMagnetURI', () => {
    it('should generate magnet URI correctly', async () => {
      const mockMagnetUri = 'magnet:?xt=urn:btih:abc123&dn=Test+Torrent&tr=localhost:3000/announce';
      mockMagnet.encode.mockReturnValue(mockMagnetUri);

      // We need to test this indirectly through searchTorrent since generateMagnetURI is not exported
      const mockTorrent = {
        infoHash: 'abc123',
        name: 'Test Torrent'
      };

      mockDb.torrent.findFirst.mockResolvedValue(mockTorrent);

      await searchTorrent('abc123', 'localhost');

      expect(mockMagnet.encode).toHaveBeenCalledWith({
        xt: 'urn:btih:abc123',
        dn: 'Test Torrent',
        tr: 'localhost:3000/announce'
      });
    });

    it('should handle magnet generation errors', async () => {
      mockMagnet.encode.mockImplementation(() => {
        throw new Error('Magnet generation failed');
      });

      const mockTorrent = {
        infoHash: 'abc123',
        name: 'Test Torrent'
      };

      mockDb.torrent.findFirst.mockResolvedValue(mockTorrent);

      await expect(searchTorrent('abc123', 'localhost'))
        .rejects.toThrow('Error generating magnet URI');
    });
  });
});