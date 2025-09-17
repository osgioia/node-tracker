export const securityConfig = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    algorithm: 'HS256',
    issuer: 'node-tracker',
    audience: 'tracker-users'
  },

  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAttempts: 5,
    lockoutTime: 15 * 60 * 1000,
    specialChars: '!@#$%^&*(),.?":{}|<>'
  },

  rateLimit: {
    global: {
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.GLOBAL_RATE_LIMIT) || 1000
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.AUTH_RATE_LIMIT) || 5
    },
    api: {
      windowMs: 15 * 60 * 1000,
      max: 100
    }
  },

  validation: {
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif'],
    maxFileSize: 5 * 1024 * 1024,
    sanitizeHtml: true,
    stripTags: true
  },

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

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    logFailedLogins: true,
    logSuspiciousActivity: true,
    logSecurityEvents: true,
    maxLogSize: '100mb',
    maxFiles: 5
  },

  session: {
    maxConcurrentSessions: 5,
    sessionTimeout: 30 * 60 * 1000, 
    renewThreshold: 5 * 60 * 1000, 
    secureCookies: process.env.NODE_ENV === 'production'
  },

  ipSecurity: {
    trustProxy: process.env.TRUST_PROXY === 'true',
    maxRequestsPerIP: 1000,
    blockSuspiciousIPs: true,
    whitelistedIPs: process.env.WHITELISTED_IPS?.split(',') || [],
    blacklistedIPs: process.env.BLACKLISTED_IPS?.split(',') || []
  },

  
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200,
    maxAge: 86400
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024,
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

  
  database: {
    connectionTimeout: 30000,
    maxConnections: 100,
    ssl: process.env.NODE_ENV === 'production',
    logQueries: process.env.NODE_ENV === 'development'
  },

  monitoring: {
    enableMetrics: true,
    enableHealthCheck: true,
    alertOnFailures: process.env.NODE_ENV === 'production',
    maxErrorRate: 0.05, 
    responseTimeThreshold: 5000 
  }
};

export const validateSecurityConfig = () => {
  const errors = [];

  if (!securityConfig.jwt.secret || securityConfig.jwt.secret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  if (process.env.NODE_ENV === 'production') {
    if (securityConfig.jwt.secret === 'node-tracker') {
      errors.push('Default JWT_SECRET detected in production');
    }
    
    if (!process.env.DATABASE_URL?.includes('ssl=true')) {
      errors.push('SSL should be enabled for database in production');
    }
  }

  if (securityConfig.cors.origin.includes('*')) {
    errors.push('Wildcard CORS origin is not secure');
  }

  if (errors.length > 0) {
    throw new Error(`Security configuration errors:\n${errors.join('\n')}`);
  }

  return true;
};

export default securityConfig;