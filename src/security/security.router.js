import express from 'express';
import { logMessage } from '../utils/utils.js';

export const securityRouter = express.Router();

securityRouter.post('/csp-report', express.raw({ type: 'application/csp-report' }), (req, res) => {
  try {
    const report = JSON.parse(req.body.toString());
    
    logMessage('warn', `CSP Violation: ${JSON.stringify({
      documentURI: report['csp-report']?.['document-uri'],
      violatedDirective: report['csp-report']?.['violated-directive'],
      blockedURI: report['csp-report']?.['blocked-uri'],
      sourceFile: report['csp-report']?.['source-file'],
      lineNumber: report['csp-report']?.['line-number'],
      userAgent: req.get('User-Agent'),
      ip: req.ip
    })}`);
    
    res.status(204).send();
  } catch (error) {
    logMessage('error', `CSP report parsing error: ${error.message}`);
    res.status(400).send();
  }
});

securityRouter.get('/health', (req, res) => {
  const securityStatus = {
    status: 'secure',
    timestamp: new Date().toISOString(),
    security: {
      https: req.secure || req.get('X-Forwarded-Proto') === 'https',
      headers: {
        helmet: true,
        cors: true,
        rateLimit: true
      },
      environment: process.env.NODE_ENV || 'development'
    }
  };
  
  res.json(securityStatus);
});