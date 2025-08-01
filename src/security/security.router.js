import express from 'express';
import { logMessage } from '../utils/utils.js';

export const securityRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Security
 *   description: Endpoints de seguridad
 */

/**
 * @swagger
 * /api/security/csp-report:
 *   post:
 *     summary: Recibir reportes de violaciones CSP
 *     tags: [Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       204:
 *         description: Reporte recibido
 */
// POST /api/security/csp-report - Endpoint para reportes CSP
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

/**
 * @swagger
 * /api/security/health:
 *   get:
 *     summary: Health check de seguridad
 *     tags: [Security]
 *     responses:
 *       200:
 *         description: Sistema seguro
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 security:
 *                   type: object
 */
// GET /api/security/health - Health check de seguridad
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