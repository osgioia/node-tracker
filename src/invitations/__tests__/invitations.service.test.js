import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock modules
const mockDb = {
  invite: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn()
  }
};

const mockLogMessage = jest.fn();
const mockGenerateInviteKey = jest.fn();

jest.unstable_mockModule('../../utils/db.server.js', () => ({ db: mockDb }));
jest.unstable_mockModule('../../utils/utils.js', () => ({ 
  logMessage: mockLogMessage,
  generateInviteKey: mockGenerateInviteKey
}));

// Import after mocking
const {
  getAllInvitations,
  createInvitation,
  getInvitationById,
  deleteInvitation
} = await import('../invitations.service.js');

describe('Invitations Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllInvitations', () => {
    it('should get all invitations for admin', async () => {
      const mockInvitations = [
        { id: 1, inviteKey: 'key1', inviterId: 1, used: false },
        { id: 2, inviteKey: 'key2', inviterId: 2, used: true }
      ];

      mockDb.invite.findMany.mockResolvedValue(mockInvitations);
      mockDb.invite.count.mockResolvedValue(2);

      const result = await getAllInvitations(1, 20, true); // isAdmin = true

      expect(mockDb.invite.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        select: {
          id: true,
          inviteKey: true,
          email: true,
          reason: true,
          expires: true,
          used: true,
          inviter: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: { id: 'desc' }
      });
      expect(mockDb.invite.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toHaveProperty('invitations', mockInvitations);
      expect(result).toHaveProperty('pagination');
      expect(result.pagination.total).toBe(2);
    });

    it('should get only user own invitations for non-admin', async () => {
      const mockInvitations = [
        { id: 1, inviteKey: 'key1', inviterId: 1, used: false }
      ];

      mockDb.invite.findMany.mockResolvedValue(mockInvitations);
      mockDb.invite.count.mockResolvedValue(1);

      const result = await getAllInvitations(1, 20, false, 1); // isAdmin = false, userId = 1

      expect(mockDb.invite.findMany).toHaveBeenCalledWith({
        where: { inviterId: 1 },
        skip: 0,
        take: 20,
        select: {
          id: true,
          inviteKey: true,
          email: true,
          reason: true,
          expires: true,
          used: true,
          inviter: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: { id: 'desc' }
      });
      expect(mockDb.invite.count).toHaveBeenCalledWith({ where: { inviterId: 1 } });
      expect(result.invitations).toEqual(mockInvitations);
    });

    it('should handle pagination correctly', async () => {
      mockDb.invite.findMany.mockResolvedValue([]);
      mockDb.invite.count.mockResolvedValue(50);

      const result = await getAllInvitations(3, 10, true);

      expect(mockDb.invite.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 20, // (3-1) * 10
        take: 10,
        select: {
          id: true,
          inviteKey: true,
          email: true,
          reason: true,
          expires: true,
          used: true,
          inviter: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: { id: 'desc' }
      });
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.pages).toBe(5);
    });
  });

  describe('createInvitation', () => {
    it('should create invitation successfully', async () => {
      const invitationData = {
        inviterId: 1,
        expires: new Date(Date.now() + 86400000) // Tomorrow
      };

      const mockCreatedInvitation = {
        id: 1,
        inviteKey: 'generated_key_123',
        inviterId: 1,
        expires: invitationData.expires,
        used: false,
        created: new Date()
      };

      mockGenerateInviteKey.mockReturnValue('generated_key_123');
      mockDb.invite.create.mockResolvedValue(mockCreatedInvitation);

      const result = await createInvitation(invitationData);

      expect(mockGenerateInviteKey).toHaveBeenCalled();
      expect(mockDb.invite.create).toHaveBeenCalledWith({
        data: {
          inviteKey: 'generated_key_123',
          inviterId: 1,
          expires: invitationData.expires,
          used: false
        },
        include: {
          inviter: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });
      expect(result).toEqual(mockCreatedInvitation);
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'Invitation created by user: 1 for email: undefined');
    });

    it('should create invitation with default expiration', async () => {
      const invitationData = { inviterId: 1 };

      mockGenerateInviteKey.mockReturnValue('generated_key_123');
      mockDb.invite.create.mockResolvedValue({
        id: 1,
        inviteKey: 'generated_key_123',
        inviterId: 1
      });

      await createInvitation(invitationData);

      expect(mockDb.invite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inviteKey: 'generated_key_123',
          inviterId: 1,
          used: false,
          expires: expect.any(Date)
        }),
        include: expect.any(Object)
      });
    });

    it('should handle creation errors', async () => {
      const invitationData = { inviterId: 1 };

      mockGenerateInviteKey.mockReturnValue('generated_key_123');
      mockDb.invite.create.mockRejectedValue(new Error('Database error'));

      await expect(createInvitation(invitationData)).rejects.toThrow('Database error');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error creating invitation: Database error');
    });
  });

  describe('getInvitationById', () => {
    it('should get invitation by id successfully', async () => {
      const mockInvitation = {
        id: 1,
        inviteKey: 'key123',
        inviterId: 1,
        used: false,
        inviter: { id: 1, username: 'testuser' }
      };

      mockDb.invite.findUnique.mockResolvedValue(mockInvitation);

      const result = await getInvitationById(1);

      expect(mockDb.invite.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          inviteKey: true,
          email: true,
          reason: true,
          expires: true,
          used: true,
          inviter: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });
      expect(result).toEqual(mockInvitation);
    });

    it('should throw error if invitation not found', async () => {
      mockDb.invite.findUnique.mockResolvedValue(null);

      await expect(getInvitationById(999)).rejects.toThrow('Invitation not found');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error getting invitation: Invitation not found');
    });
  });

  describe('deleteInvitation', () => {
    it('should delete invitation successfully', async () => {
      mockDb.invite.delete.mockResolvedValue({});

      await deleteInvitation(1);

      expect(mockDb.invite.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(mockLogMessage).toHaveBeenCalledWith('info', 'Invitation deleted: 1');
    });

    it('should throw error if invitation not found during deletion', async () => {
      mockDb.invite.delete.mockRejectedValue({ code: 'P2025' }); // Prisma not found error

      await expect(deleteInvitation(999)).rejects.toThrow('Invitation not found');
    });

    it('should handle other deletion errors', async () => {
      mockDb.invite.delete.mockRejectedValue(new Error('Database error'));

      await expect(deleteInvitation(1)).rejects.toThrow('Database error');
      expect(mockLogMessage).toHaveBeenCalledWith('error', 'Error deleting invitation: Database error');
    });
  });
});