import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockDb = {
  torrent: {
    findUnique: jest.fn()
  },
  IPBan: {
    findMany: jest.fn()
  }
};

const mockJwt = {
  sign: jest.fn()
};

const mockAddress4 = jest.fn();
const mockAddress6 = jest.fn();

const mockLogger = {
  log: jest.fn()
};

const mockCreateLogger = jest.fn().mockReturnValue(mockLogger);

jest.unstable_mockModule('../db.server.js', () => ({ db: mockDb }));
jest.unstable_mockModule('jsonwebtoken', () => ({ default: mockJwt }));
jest.unstable_mockModule('ip-address', () => ({
  Address4: mockAddress4,
  Address6: mockAddress6
}));
jest.unstable_mockModule('winston', () => ({
  createLogger: mockCreateLogger,
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

const {
  checkTorrent,
  bannedIPs,
  logMessage,
  generateToken
} = await import('../utils.js');

describe('Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkTorrent', () => {
    it('should call callback with null if torrent exists', async () => {
      const mockTorrent = {
        id: 1,
        infoHash: 'abc123',
        name: 'Test Torrent'
      };

      mockDb.torrent.findUnique.mockResolvedValue(mockTorrent);
      const callback = jest.fn();

      await checkTorrent('abc123', callback);

      expect(mockDb.torrent.findUnique).toHaveBeenCalledWith({
        where: { infoHash: 'abc123' }
      });
      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should call callback with error if torrent does not exist', async () => {
      mockDb.torrent.findUnique.mockResolvedValue(null);
      const callback = jest.fn();

      await checkTorrent('nonexistent', callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error));
      expect(callback.mock.calls[0][0].message).toBe('Torrent not found');
    });

    it('should handle database errors', async () => {
      mockDb.torrent.findUnique.mockRejectedValue(new Error('Database error'));
      const callback = jest.fn();

      await checkTorrent('abc123', callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error));
      expect(callback.mock.calls[0][0].message).toBe('Database error');
    });
  });

  describe('bannedIPs', () => {
    beforeEach(() => {
      
      mockAddress4.mockImplementation((ip) => ({
        bigInteger: () => {
          if (ip === '192.168.1.100') {return BigInt('3232235876');}
          if (ip === '192.168.1.1') {return BigInt('3232235777');}
          if (ip === '192.168.1.255') {return BigInt('3232236031');}
          if (ip === '10.0.0.1') {return BigInt('167772161');}
          return BigInt('0');
        }
      }));

      mockAddress6.mockImplementation((ip) => ({
        bigInteger: () => BigInt('0')
      }));
    });

    it('should call callback with null if IP is not banned', async () => {
      const mockBannedIPs = [
        {
          fromIP: '192.168.1.1',
          toIP: '192.168.1.255'
        }
      ];

      mockDb.IPBan.findMany.mockResolvedValue(mockBannedIPs);
      const callback = jest.fn();
      const params = { ip: '10.0.0.1' }; // Different network

      await bannedIPs(params, callback);

      expect(mockDb.IPBan.findMany).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should call callback with error if IP is banned', async () => {
      const mockBannedIPs = [
        {
          fromIP: '192.168.1.1',
          toIP: '192.168.1.255'
        }
      ];

      mockDb.IPBan.findMany.mockResolvedValue(mockBannedIPs);
      const callback = jest.fn();
      const params = { ip: '192.168.1.100' }; // Within banned range

      await bannedIPs(params, callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error));
      expect(callback.mock.calls[0][0].message).toBe('IP banned');
    });

    it('should handle IPv6 addresses', async () => {
      mockDb.IPBan.findMany.mockResolvedValue([]);
      const callback = jest.fn();
      const params = { ipv6: '2001:db8::1' };

      await bannedIPs(params, callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should handle invalid IP addresses gracefully', async () => {
      mockAddress4.mockImplementation(() => {
        throw new Error('Invalid IP');
      });

      mockDb.IPBan.findMany.mockResolvedValue([
        {
          fromIP: '192.168.1.1',
          toIP: '192.168.1.255'
        }
      ]);

      const callback = jest.fn();
      const params = { ip: 'invalid-ip' };

      await bannedIPs(params, callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should handle database errors', async () => {
      mockDb.IPBan.findMany.mockRejectedValue(new Error('Database error'));
      const callback = jest.fn();
      const params = { ip: '192.168.1.100' };

      await bannedIPs(params, callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error));
      expect(callback.mock.calls[0][0].message).toBe('Database error');
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token successfully', () => {
      const user = {
        id: 1,
        username: 'testuser'
      };

      mockJwt.sign.mockReturnValue('mock_jwt_token');

      const result = generateToken(user);

      expect(mockJwt.sign).toHaveBeenCalledWith(
        { id: 1, username: 'testuser' },
        'test-secret',
        { expiresIn: '1h' }
      );
      expect(result).toBe('mock_jwt_token');
    });

    it('should throw error for invalid user data', () => {
      const invalidUser = { id: 1 }; 

      expect(() => generateToken(invalidUser)).toThrow('Invalid user data for token generation');
    });

    it('should throw error for null user', () => {
      expect(() => generateToken(null)).toThrow('Invalid user data for token generation');
    });

    it('should throw error for user without id', () => {
      const invalidUser = { username: 'testuser' }; 

      expect(() => generateToken(invalidUser)).toThrow('Invalid user data for token generation');
    });
  });

  describe('logMessage', () => {
    it('should log message with correct level', () => {
      logMessage('info', 'Test message');

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: 'info',
        message: 'Test message'
      });
    });

    it('should log error messages', () => {
      logMessage('error', 'Error message');

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: 'error',
        message: 'Error message'
      });
    });

    it('should log warning messages', () => {
      logMessage('warn', 'Warning message');

      expect(mockLogger.log).toHaveBeenCalledWith({
        level: 'warn',
        message: 'Warning message'
      });
    });
  });
});