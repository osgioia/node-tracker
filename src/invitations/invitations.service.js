import { db } from '../utils/db.server.js';
import { logMessage, generateInviteKey } from '../utils/utils.js';

async function createInvitation(invitationData) {
  try {
    const { inviterId, email, reason, expires } = invitationData;
    
    const inviteKey = generateInviteKey();
    
    const expiresAt = expires ? new Date(expires) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await db.invite.create({
      data: {
        inviterId: parseInt(inviterId),
        inviteKey,
        email,
        reason,
        expires: expiresAt,
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

    logMessage('info', `Invitation created by user: ${inviterId} for email: ${email}`);
    return invitation;
  } catch (error) {
    logMessage('error', `Error creating invitation: ${error.message}`);
    throw error;
  }
}

async function getUserInvitations(userId) {
  try {
    const invitations = await db.invite.findMany({
      where: { inviterId: parseInt(userId) },
      select: {
        id: true,
        inviteKey: true,
        email: true,
        reason: true,
        expires: true,
        used: true
      },
      orderBy: {
        id: 'desc'
      }
    });

    return invitations;
  } catch (error) {
    logMessage('error', `Error getting user invitations: ${error.message}`);
    throw error;
  }
}

async function getAllInvitations(page = 1, limit = 20, isAdmin = false, userId = null) {
  try {
    const skip = (page - 1) * limit;
    
    const where = isAdmin ? {} : { inviterId: userId };
    
    const [invitations, total] = await Promise.all([
      db.invite.findMany({
        where,
        skip,
        take: limit,
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
        orderBy: {
          id: 'desc'
        }
      }),
      db.invite.count({ where })
    ]);

    return {
      invitations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logMessage('error', `Error getting all invitations: ${error.message}`);
    throw error;
  }
}

async function getInvitationById(id) {
  try {
    const invitation = await db.invite.findUnique({
      where: { id: parseInt(id) },
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

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    return invitation;
  } catch (error) {
    logMessage('error', `Error getting invitation: ${error.message}`);
    throw error;
  }
}

async function deleteInvitation(id) {
  try {
    await db.invite.delete({
      where: { id: parseInt(id) }
    });

    logMessage('info', `Invitation deleted: ${id}`);
  } catch (error) {
    if (error.code === 'P2025') {
      throw new Error('Invitation not found');
    }
    logMessage('error', `Error deleting invitation: ${error.message}`);
    throw error;
  }
}

export {
  createInvitation,
  getUserInvitations,
  getAllInvitations,
  getInvitationById,
  deleteInvitation
};