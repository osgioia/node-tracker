import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockDb = {
  torrent: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }
};

const mockLogMessage = jest.fn();
const mockMagnet = {
  encode: jest.fn()
};

jest.unstable_mockModule('../../utils/db.server.js', () => ({ db: mockDb }));
jest.unstable_mockModule('../../utils/utils.js', () => ({ logMessage: mockLogMessage }));
jest.unstable_mockModule('magnet-uri', () => ({ default: mockMagnet }));

const {
  addTorrent,
  getTorrentById,
  getTorrentByInfoHash,
  getAllTorrents,
  updateTorrent,
  deleteTorrent
} = await import('../torrents.service.js');

describe('Torrents Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PORT = '3000';
  });

  describe('addTorrent', () => {
    it('should add a new torrent successfully', async () => {
      const torrentData = {
        infoHash: 'abc123',
        name: 'Test Torrent',
        category: 'Movies',
        tags: 'action, thriller',
        description: 'A test torrent',
        size: 1024,
        anonymous: false,
        freeleech: true,
        uploadedById: 1
      };

      mockDb.torrent.findFirst.mockResolvedValue(null); 
      mockDb.torrent.create.mockResolvedValue({
        id: 1,
        infoHash: 'abc123',
        name: 'Test Torrent',
        uploadedById: 1,
        category: { name: 'Movies' },
        tags: [{ name: 'action' }, { name: 'thriller' }],
        uploadedBy: { id: 1, username: 'testuser' }
      });

      const result = await addTorrent(torrentData);

      expect(mockDb.torrent.findFirst).toHaveBeenCalledWith({
        where: { infoHash: 'abc123' }
      });
      expect(mockDb.torrent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          infoHash: 'abc123',
          name: 'Test Torrent',
          uploadedById: 1,
          description: 'A test torrent',
          size: 1024,
          anonymous: false,
          freeleech: true,
          category: {
            connectOrCreate: {
              where: { name: 'Movies' },
              create: { name: 'Movies' }
            }
          },
          tags: {
            connectOrCreate: [
              { where: { name: 'action' }, create: { name: 'action' } },
              { where: { name: 'thriller' }, create: { name: 'thriller' } }
            ]
          }
        }),
        include: expect.any(Object)
      });
      expect(result).toBeDefined();
    });

    it('should throw error if torrent already exists', async () => {
      const torrentData = {
        infoHash: 'abc123',
        name: 'Test Torrent',
        uploadedById: 1
      };

      mockDb.torrent.findFirst.mockResolvedValue({ id: 1 }); 

      await expect(addTorrent(torrentData)).rejects.toThrow('Torrent with this infoHash already exists');
    });

    it('should add torrent without optional fields', async () => {
      const torrentData = {
        infoHash: 'abc123',
        name: 'Test Torrent',
        uploadedById: 1
      };

      mockDb.torrent.findFirst.mockResolvedValue(null);
      mockDb.torrent.create.mockResolvedValue({
        id: 1,
        infoHash: 'abc123',
        name: 'Test Torrent',
        uploadedById: 1
      });

      await addTorrent(torrentData);

      expect(mockDb.torrent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          infoHash: 'abc123',
          name: 'Test Torrent',
          uploadedById: 1,
          description: null,
          size: 0, 
          anonymous: false,
          freeleech: false
        }),
        include: expect.any(Object)
      });
    });
  });

  describe('getTorrentById', () => {
    it('should get torrent by id successfully', async () => {
      const mockTorrent = {
        id: 1,
        infoHash: 'abc123',
        name: 'Test Torrent',
        category: { name: 'Movies' },
        tags: [{ name: 'action' }],
        uploadedBy: { id: 1, username: 'testuser' }
      };

      mockDb.torrent.findUnique.mockResolvedValue(mockTorrent);

      const result = await getTorrentById(1);

      expect(mockDb.torrent.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object)
      });
      expect(result).toEqual(mockTorrent);
    });

    it('should throw error if torrent not found', async () => {
      mockDb.torrent.findUnique.mockResolvedValue(null);

      await expect(getTorrentById(999)).rejects.toThrow('Torrent not found');
    });
  });

  describe('getTorrentByInfoHash', () => {
    it('should get torrent by infoHash and generate magnet URI', async () => {
      const mockTorrent = {
        id: 1,
        infoHash: 'abc123',
        name: 'Test Torrent',
        category: { name: 'Movies' },
        tags: [{ name: 'action' }],
        uploadedBy: { id: 1, username: 'testuser' }
      };

      mockDb.torrent.findFirst.mockResolvedValue(mockTorrent);
      mockMagnet.encode.mockReturnValue('magnet:?xt=urn:btih:abc123&dn=Test%20Torrent&tr=localhost:3000/announce');

      const result = await getTorrentByInfoHash('abc123', 'localhost');

      expect(mockDb.torrent.findFirst).toHaveBeenCalledWith({
        where: { infoHash: 'abc123' },
        include: expect.any(Object)
      });
      expect(mockMagnet.encode).toHaveBeenCalledWith({
        xt: 'urn:btih:abc123',
        dn: 'Test Torrent',
        tr: 'localhost:3000/announce'
      });
      expect(result).toBe('magnet:?xt=urn:btih:abc123&dn=Test%20Torrent&tr=localhost:3000/announce');
    });

    it('should throw error if torrent not found', async () => {
      mockDb.torrent.findFirst.mockResolvedValue(null);

      await expect(getTorrentByInfoHash('nonexistent', 'localhost')).rejects.toThrow('Torrent not found');
    });
  });

  describe('getAllTorrents', () => {
    it('should get all torrents with pagination', async () => {
      const mockTorrents = [
        { id: 1, name: 'Torrent 1' },
        { id: 2, name: 'Torrent 2' }
      ];

      mockDb.torrent.findMany.mockResolvedValue(mockTorrents);
      mockDb.torrent.count.mockResolvedValue(2);

      const result = await getAllTorrents(1, 20);

      expect(mockDb.torrent.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        include: expect.any(Object),
        orderBy: { id: 'desc' }
      });
      expect(mockDb.torrent.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toHaveProperty('torrents', mockTorrents);
      expect(result).toHaveProperty('pagination');
      expect(result.pagination.total).toBe(2);
    });

    it('should filter torrents by category', async () => {
      const mockTorrents = [{ id: 1, name: 'Movie Torrent' }];

      mockDb.torrent.findMany.mockResolvedValue(mockTorrents);
      mockDb.torrent.count.mockResolvedValue(1);

      const result = await getAllTorrents(1, 20, { category: 'Movies' });

      expect(mockDb.torrent.findMany).toHaveBeenCalledWith({
        where: {
          category: { name: 'Movies' }
        },
        skip: 0,
        take: 20,
        include: expect.any(Object),
        orderBy: { id: 'desc' }
      });
      expect(result.torrents).toEqual(mockTorrents);
    });

    it('should filter torrents by search term', async () => {
      const mockTorrents = [{ id: 1, name: 'Action Movie' }];

      mockDb.torrent.findMany.mockResolvedValue(mockTorrents);
      mockDb.torrent.count.mockResolvedValue(1);

      const result = await getAllTorrents(1, 20, { search: 'action' });

      expect(mockDb.torrent.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'action',
            mode: 'insensitive'
          }
        },
        skip: 0,
        take: 20,
        include: expect.any(Object),
        orderBy: { id: 'desc' }
      });
      expect(result.torrents).toEqual(mockTorrents);
    });
  });

  describe('updateTorrent', () => {
    it('should update torrent successfully', async () => {
      const updateData = {
        name: 'Updated Torrent',
        category: 'TV Shows',
        tags: 'drama, comedy'
      };

      const mockUpdatedTorrent = {
        id: 1,
        name: 'Updated Torrent',
        category: { name: 'TV Shows' },
        tags: [{ name: 'drama' }, { name: 'comedy' }]
      };

      mockDb.torrent.update.mockResolvedValue(mockUpdatedTorrent);

      const result = await updateTorrent(1, updateData);

      expect(mockDb.torrent.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          name: 'Updated Torrent',
          category: {
            connectOrCreate: {
              where: { name: 'TV Shows' },
              create: { name: 'TV Shows' }
            }
          },
          tags: {
            set: [],
            connectOrCreate: [
              { where: { name: 'drama' }, create: { name: 'drama' } },
              { where: { name: 'comedy' }, create: { name: 'comedy' } }
            ]
          }
        }),
        include: expect.any(Object)
      });
      expect(result).toEqual(mockUpdatedTorrent);
    });

    it('should clear tags when empty string provided', async () => {
      const updateData = {
        name: 'Updated Torrent',
        tags: ''
      };

      mockDb.torrent.update.mockResolvedValue({ id: 1, name: 'Updated Torrent' });

      await updateTorrent(1, updateData);

      expect(mockDb.torrent.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          name: 'Updated Torrent',
          tags: { set: [] }
        }),
        include: expect.any(Object)
      });
    });
  });

  describe('deleteTorrent', () => {
    it('should delete torrent successfully', async () => {
      mockDb.torrent.delete.mockResolvedValue({});

      await deleteTorrent(1);

      expect(mockDb.torrent.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'Torrent deleted: 1');
    });

    it('should handle delete errors', async () => {
      mockDb.torrent.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(deleteTorrent(1)).rejects.toThrow('Delete failed');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error deleting torrent: Delete failed');
    });
  });
});