import { db } from "../utils/db.server.js";
import { logMessage, generateToken } from "../utils/utils.js";
import bcrypt from "bcrypt";

// Register new user
async function registerUser(userData) {
  try {
    const { username, email, password, inviteKey } = userData;
    
    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      throw new Error("User or email already exists");
    }

    // Verify invitation if provided
    let inviteData = null;
    if (inviteKey) {
      inviteData = await db.invite.findFirst({
        where: {
          inviteKey,
          used: false,
          expires: {
            gt: new Date()
          }
        }
      });

      if (!inviteData) {
        throw new Error("Invalid or expired invitation");
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        created: new Date(),
        banned: false,
        remainingInvites: 0,
        emailVerified: false,
        invitedById: inviteData?.inviterId || null
      }
    });

    // Mark invitation as used
    if (inviteData) {
      await db.invite.update({
        where: { id: inviteData.id },
        data: { used: true }
      });

      // Create invitation tree node
      await db.inviteTreeNode.create({
        data: {
          userId: newUser.id,
          inviterId: inviteData.inviterId
        }
      });
    }

    logMessage("info", `User registered: ${username}`);
    return { id: newUser.id, username: newUser.username, email: newUser.email };
  } catch (error) {
    logMessage("error", `Error registering user: ${error.message}`);
    throw error;
  }
}

// Authenticate user login
async function loginUser(username, password) {
  try {
    const user = await db.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }
        ]
      }
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.banned) {
      throw new Error("User is banned");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error("Incorrect password");
    }

    const token = generateToken(user);
    logMessage("info", `User logged in: ${user.username}`);
    
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      },
      token
    };
  } catch (error) {
    logMessage("error", `Error in authentication: ${error.message}`);
    throw error;
  }
}

export {
  registerUser,
  loginUser
};