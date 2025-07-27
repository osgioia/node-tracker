// Configuración centralizada de seguridad
export const securityConfig = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    algorithm: 'HS256',
    issuer: 'node-tracker',
    audience: 'tracker-users'
  },

  // Password Policy
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAttempts: 5,
    lockoutTime: 15 * 60 * 1000, // 15 minutes
    specialChars: '!@#$%^&*(),.?":{}|<>'
  },

  // Rate Limiting
  rateLimit: {
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.GLOBAL_RATE_LIMIT) || 1000
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.AUTH_RATE_LIMIT) || 5
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100
    }
  },

  // Input Validation
  validation: {
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    sanitizeHtml: true,
    stripTags: true
  },

  // Security Headers
  headers: {
    hsts: {
      maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000,
      includeSubDomains: true,
      preload: true
    },
    csp: {
      directives: {
        defaultSrc: ['\'self\''],
        styleSrc: ['\'self\'', '\'unsafe-inline\''],
        scriptSrc: ['\'self\''],
        imgSrc: ['\'self\'', 'data:', 'https:'],
        connectSrc: ['\'self\''],
        fontSrc: ['\'self\''],
        objectSrc: ['\'none\''],
        mediaSrc: ['\'self\''],
        frameSrc: ['\'none\'']
      },
      reportUri: process.env.CSP_REPORT_URI || '/api/security/csp-report'
    }
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    logFailedLogins: true,
    logSuspiciousActivity: true,
    logSecurityEvents: true,
    maxLogSize: '100mb',
    maxFiles: 5
  },

  // Session Management
  session: {
    maxConcurrentSessions: 5,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    renewThreshold: 5 * 60 * 1000, // 5 minutes
    secureCookies: process.env.NODE_ENV === 'production'
  },

  // IP Security
  ipSecurity: {
    trustProxy: process.env.TRUST_PROXY === 'true',
    maxRequestsPerIP: 1000,
    blockSuspiciousIPs: true,
    whitelistedIPs: process.env.WHITELISTED_IPS?.split(',') || [],
    blacklistedIPs: process.env.BLACKLISTED_IPS?.split(',') || []
  },

  // CORS
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
    maxAge: 86400 // 24 hours
  },

  // File Upload Security
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: [
      'application/x-bittorrent',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain'
    ],
    scanForMalware: process.env.NODE_ENV === 'production',
    quarantinePath: './quarantine'
  },

  // Database Security
  database: {
    connectionTimeout: 30000,
    maxConnections: 100,
    ssl: process.env.NODE_ENV === 'production',
    logQueries: process.env.NODE_ENV === 'development'
  },

  // Monitoring
  monitoring: {
    enableMetrics: true,
    enableHealthCheck: true,
    alertOnFailures: process.env.NODE_ENV === 'production',
    maxErrorRate: 0.05, // 5%
    responseTimeThreshold: 5000 // 5 seconds
  }
};

// Validar configuración de seguridad al inicio
export const validateSecurityConfig = () => {
  const errors = [];

  // Validar JWT Secret
  if (!securityConfig.jwt.secret || securityConfig.jwt.secret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  // Validar que no se usen valores por defecto en producción
  if (process.env.NODE_ENV === 'production') {
    if (securityConfig.jwt.secret === 'node-tracker') {
      errors.push('Default JWT_SECRET detected in production');
    }
    
    if (!process.env.DATABASE_URL?.includes('ssl=true')) {
      errors.push('SSL should be enabled for database in production');
    }
  }

  // Validar CORS origins
  if (securityConfig.cors.origin.includes('*')) {
    errors.push('Wildcard CORS origin is not secure');
  }

  if (errors.length > 0) {
    throw new Error(`Security configuration errors:\n${errors.join('\n')}`);
  }

  return true;
};

export default securityConfig;