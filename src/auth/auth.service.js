import { db } from '../utils/db.server.js';
import { logMessage, generateToken } from '../utils/utils.js';
import bcrypt from 'bcrypt';

import redisClient from '../utils/redis.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos en ms

// Clave Redis: login_attempts:<ip>
async function isIPBlocked(ip) {
  const attemptsKey = `login_attempts:${ip}`;
  const attempts = await redisClient.hGetAll(attemptsKey);
  
  if (!attempts || !attempts.count) return false;
  
  const count = parseInt(attempts.count);
  const lastAttempt = parseInt(attempts.lastAttempt);
  
  if (count >= MAX_LOGIN_ATTEMPTS) {
    const timeSinceLastAttempt = Date.now() - lastAttempt;
    if (timeSinceLastAttempt < LOCKOUT_TIME) {
      return true;
    } else {
      await redisClient.del(attemptsKey);
      return false;
    }
  }
  
  return false;
}

async function recordFailedLogin(ip) {
  const attemptsKey = `login_attempts:${ip}`;
  const attempts = await redisClient.hGetAll(attemptsKey);
  
  let count = attempts?.count ? parseInt(attempts.count) + 1 : 1;
  
  await redisClient.hSet(attemptsKey, {
    count: count.toString(),
    lastAttempt: Date.now().toString()
  });
  
  // Establecer TTL para autoeliminación
  await redisClient.expire(attemptsKey, LOCKOUT_TIME / 1000);
  
  logMessage('warn', `Failed login attempt ${count}/${MAX_LOGIN_ATTEMPTS} from IP: ${ip}`);
}

async function clearFailedAttempts(ip) {
  const attemptsKey = `login_attempts:${ip}`;
  await redisClient.del(attemptsKey);
}

function validatePasswordStrength(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}


async function registerUser(userData, _clientIP = 'unknown') {
  try {
    const { username, email, password, inviteKey } = userData;
    
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.errors.join(', ')}`);
    }
    
    const sanitizedUsername = username.trim().toLowerCase();
    const sanitizedEmail = email.trim().toLowerCase();
    
    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 20) {
      throw new Error('Username must be between 3 and 20 characters');
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers and underscores');
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      throw new Error('Invalid email format');
    }
    
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      throw new Error('User or email already exists');
    }

    let inviteData = null;
    const userCount = await db.user.count();
    
    if (inviteKey) {
      if (inviteKey === 'bootstrap' && userCount === 0) {
        logMessage('info', 'Bootstrap registration for first admin user');
        inviteData = null;
      } else {
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
          throw new Error('Invalid or expired invitation');
        }
      }
    } else if (userCount > 0) {
      throw new Error('Invitation required for registration');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const isFirstUser = userCount === 0 && inviteKey === 'bootstrap';
    const newUser = await db.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        created: new Date(),
        banned: false,
        remainingInvites: isFirstUser ? 10 : 0, 
        emailVerified: isFirstUser,
        invitedById: inviteData?.inviterId || null,
        role: isFirstUser ? 'ADMIN' : 'USER'
      }
    });

    
    if (inviteData) {
      await db.invite.update({
        where: { id: inviteData.id },
        data: { used: true }
      });

      await db.inviteTreeNode.create({
        data: {
          userId: newUser.id,
          inviterId: inviteData.inviterId
        }
      });
    }

    logMessage('info', `User registered: ${username}`);
    return { id: newUser.id, username: newUser.username, email: newUser.email };
  } catch (error) {
    logMessage('error', `Error registering user: ${error.message}`);
    throw error;
  }
}

async function loginUser(username, password, clientIP = 'unknown') {
  try {
    if (isIPBlocked(clientIP)) {
      const attempts = loginAttempts.get(clientIP);
      const timeRemaining = Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.lastAttempt)) / 1000 / 60);
      logMessage('warn', `Blocked login attempt from IP: ${clientIP} - ${timeRemaining} minutes remaining`);
      throw new Error(`Too many failed attempts. Try again in ${timeRemaining} minutes.`);
    }

    const sanitizedUsername = username.trim().toLowerCase();
    
    const user = await db.user.findFirst({
      where: {
        OR: [
          { username: sanitizedUsername },
          { email: sanitizedUsername }
        ]
      }
    });

    const dummyHash = '$2b$10$dummy.hash.to.prevent.timing.attacks.dummy.hash.value';
    const passwordToCheck = user ? user.password : dummyHash;
    const isValidPassword = await bcrypt.compare(password, passwordToCheck);

    if (!user || !isValidPassword) {
      recordFailedLogin(clientIP);
      logMessage('warn', `Failed login attempt for username: ${sanitizedUsername} from IP: ${clientIP}`);
      
      throw new Error('Invalid credentials');
    }

    if (user.banned) {
      recordFailedLogin(clientIP);
      logMessage('warn', `Banned user login attempt: ${user.username} from IP: ${clientIP}`);
      throw new Error('Account is suspended');
    }

    clearFailedAttempts(clientIP);

    const token = generateToken(user);
    
    logMessage('info', `Successful login: ${user.username} from IP: ${clientIP}`);
    
    await db.user.update({
      where: { id: user.id },
      data: { 
        
      }
    });
    
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
    logMessage('error', `Authentication error for ${username} from IP ${clientIP}: ${error.message}`);
    throw error;
  }
}

async function logoutUser(token, clientIP = 'unknown') {
  try {

    logMessage('info', `User logged out from IP: ${clientIP}`);
    return { message: 'Logged out successfully' };
  } catch (error) {
    logMessage('error', `Logout error from IP ${clientIP}: ${error.message}`);
    throw error;
  }
}

export {
  registerUser,
  loginUser,
  logoutUser,
  validatePasswordStrength
};