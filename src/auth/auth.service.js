import { db } from '../utils/db.server.js';
import { logMessage, generateToken } from '../utils/utils.js';
import bcrypt from 'bcrypt';

// Contador de intentos de login fallidos (en producción usar Redis)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos

// Función para validar fortaleza de contraseña
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

// Función para verificar si una IP está bloqueada
function isIPBlocked(ip) {
  const attempts = loginAttempts.get(ip);
  if (!attempts) {return false;}
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    if (timeSinceLastAttempt < LOCKOUT_TIME) {
      return true;
    } else {
      // Reset attempts after lockout period
      loginAttempts.delete(ip);
      return false;
    }
  }
  
  return false;
}

// Función para registrar intento de login fallido
function recordFailedLogin(ip) {
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  loginAttempts.set(ip, attempts);
  
  logMessage('warn', `Failed login attempt ${attempts.count}/${MAX_LOGIN_ATTEMPTS} from IP: ${ip}`);
}

// Función para limpiar intentos exitosos
function clearFailedAttempts(ip) {
  loginAttempts.delete(ip);
}

// Register new user
async function registerUser(userData, clientIP = 'unknown') {
  try {
    const { username, email, password, inviteKey } = userData;
    
    // Validar fortaleza de contraseña
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.errors.join(', ')}`);
    }
    
    // Sanitizar inputs
    const sanitizedUsername = username.trim().toLowerCase();
    const sanitizedEmail = email.trim().toLowerCase();
    
    // Validaciones adicionales
    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 20) {
      throw new Error('Username must be between 3 and 20 characters');
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers and underscores');
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      throw new Error('Invalid email format');
    }
    
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
      throw new Error('User or email already exists');
    }

    // Verify invitation if provided, or allow bootstrap for first user
    let inviteData = null;
    const userCount = await db.user.count();
    
    if (inviteKey) {
      // Special case: allow "bootstrap" key for first user
      if (inviteKey === 'bootstrap' && userCount === 0) {
        logMessage('info', 'Bootstrap registration for first admin user');
        inviteData = null; // No invitation needed for bootstrap
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
      // If there are existing users, invitation is required
      throw new Error('Invitation required for registration');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user - first user (bootstrap) gets ADMIN role
    const isFirstUser = userCount === 0 && inviteKey === 'bootstrap';
    const newUser = await db.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        created: new Date(),
        banned: false,
        remainingInvites: isFirstUser ? 10 : 0, // Give admin some invites
        emailVerified: isFirstUser, // Auto-verify bootstrap user
        invitedById: inviteData?.inviterId || null,
        role: isFirstUser ? 'ADMIN' : 'USER'
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

    logMessage('info', `User registered: ${username}`);
    return { id: newUser.id, username: newUser.username, email: newUser.email };
  } catch (error) {
    logMessage('error', `Error registering user: ${error.message}`);
    throw error;
  }
}

// Authenticate user login
async function loginUser(username, password, clientIP = 'unknown') {
  try {
    // Verificar si la IP está bloqueada
    if (isIPBlocked(clientIP)) {
      const attempts = loginAttempts.get(clientIP);
      const timeRemaining = Math.ceil((LOCKOUT_TIME - (Date.now() - attempts.lastAttempt)) / 1000 / 60);
      logMessage('warn', `Blocked login attempt from IP: ${clientIP} - ${timeRemaining} minutes remaining`);
      throw new Error(`Too many failed attempts. Try again in ${timeRemaining} minutes.`);
    }

    // Sanitizar input
    const sanitizedUsername = username.trim().toLowerCase();
    
    // Buscar usuario (timing attack protection - siempre hacer bcrypt.compare)
    const user = await db.user.findFirst({
      where: {
        OR: [
          { username: sanitizedUsername },
          { email: sanitizedUsername }
        ]
      }
    });

    // Siempre hacer hash comparison para evitar timing attacks
    const dummyHash = '$2b$10$dummy.hash.to.prevent.timing.attacks.dummy.hash.value';
    const passwordToCheck = user ? user.password : dummyHash;
    const isValidPassword = await bcrypt.compare(password, passwordToCheck);

    if (!user || !isValidPassword) {
      recordFailedLogin(clientIP);
      logMessage('warn', `Failed login attempt for username: ${sanitizedUsername} from IP: ${clientIP}`);
      
      // Generic error message to prevent user enumeration
      throw new Error('Invalid credentials');
    }

    if (user.banned) {
      recordFailedLogin(clientIP);
      logMessage('warn', `Banned user login attempt: ${user.username} from IP: ${clientIP}`);
      throw new Error('Account is suspended');
    }

    // Login exitoso - limpiar intentos fallidos
    clearFailedAttempts(clientIP);

    const token = generateToken(user);
    
    // Log successful login with security info
    logMessage('info', `Successful login: ${user.username} from IP: ${clientIP}`);
    
    // Update last login timestamp
    await db.user.update({
      where: { id: user.id },
      data: { 
        // Agregar campo lastLogin si no existe en el schema
        // lastLogin: new Date()
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

// Función para logout seguro
async function logoutUser(token, clientIP = 'unknown') {
  try {
    // En una implementación completa, agregar el token a una blacklist
    // Por ahora solo loggeamos el evento
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