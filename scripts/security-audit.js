#!/usr/bin/env node

/**
 * Script de Auditoría de Seguridad Automatizada
 * Verifica el cumplimiento de las mejores prácticas de seguridad OWASP
 */

import fs from 'fs';
import { execSync } from 'child_process';

const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

class SecurityAuditor {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      issues: []
    };
  }

  log(message, type = 'info') {
    const colors = {
      success: COLORS.GREEN,
      error: COLORS.RED,
      warning: COLORS.YELLOW,
      info: COLORS.BLUE
    };
    
    console.log(`${colors[type]}${message}${COLORS.RESET}`);
  }

  addResult(test, passed, message, severity = 'medium') {
    const result = { test, passed, message, severity };
    this.results.issues.push(result);
    
    if (passed) {
      this.results.passed++;
      this.log(`✅ ${test}: ${message}`, 'success');
    } else {
      if (severity === 'critical') {
        this.results.failed++;
        this.log(`❌ ${test}: ${message}`, 'error');
      } else {
        this.results.warnings++;
        this.log(`⚠️  ${test}: ${message}`, 'warning');
      }
    }
  }

  // Verify JWT configuration
  checkJWTSecurity() {
    this.log('\n🔐 Verifying JWT security...', 'info');
    
    try {
      const envContent = fs.readFileSync('.env', 'utf8');
      const jwtSecret = envContent.match(/JWT_SECRET\s*=\s*(.+)/)?.[1]?.trim();
      
      if (!jwtSecret) {
        this.addResult('JWT Secret', false, 'JWT_SECRET not found in .env', 'critical');
        return;
      }

      if (jwtSecret === 'node-tracker') {
        this.addResult('JWT Secret', false, 'JWT_SECRET usa valor por defecto inseguro', 'critical');
      } else if (jwtSecret.length < 32) {
        this.addResult('JWT Secret', false, `JWT_SECRET muy corto (${jwtSecret.length} chars, mínimo 32)`, 'critical');
      } else {
        this.addResult('JWT Secret', true, `JWT_SECRET tiene longitud segura (${jwtSecret.length} chars)`);
      }

      // Verify secret entropy
      const entropy = this.calculateEntropy(jwtSecret);
      if (entropy < 4.0) {
        this.addResult('JWT Entropy', false, `Baja entropía en JWT_SECRET (${entropy.toFixed(2)})`, 'high');
      } else {
        this.addResult('JWT Entropy', true, `Entropía adecuada en JWT_SECRET (${entropy.toFixed(2)})`);
      }

    } catch (error) {
      this.addResult('JWT Config', false, `Error reading JWT configuration: ${error.message}`, 'critical');
    }
  }

  // Calculate entropy of a string
  calculateEntropy(str) {
    const freq = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = str.length;
    
    for (const char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  // Verificar dependencias vulnerables
  checkVulnerableDependencies() {
    this.log('\n📦 Verifying vulnerable dependencies...', 'info');
    
    try {
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      if (audit.vulnerabilities) {
        const vulnCount = Object.keys(audit.vulnerabilities).length;
        const criticalVulns = Object.values(audit.vulnerabilities)
          .filter(v => v.severity === 'critical').length;
        const highVulns = Object.values(audit.vulnerabilities)
          .filter(v => v.severity === 'high').length;
        
        if (criticalVulns > 0) {
          this.addResult('Dependencies', false, `${criticalVulns} vulnerabilidades críticas encontradas`, 'critical');
        } else if (highVulns > 0) {
          this.addResult('Dependencies', false, `${highVulns} vulnerabilidades altas encontradas`, 'high');
        } else if (vulnCount > 0) {
          this.addResult('Dependencies', false, `${vulnCount} vulnerabilidades menores encontradas`, 'medium');
        } else {
          this.addResult('Dependencies', true, 'No se encontraron vulnerabilidades');
        }
      }
    } catch (error) {
      this.addResult('Dependencies', false, `Error ejecutando npm audit: ${error.message}`, 'medium');
    }
  }

  // Verify security configuration
  checkSecurityConfig() {
    this.log('\n⚙️ Verifying security configuration...', 'info');
    
    try {
      // Verify that security configuration file exists
      if (fs.existsSync('src/config/security.js')) {
        this.addResult('Security Config', true, 'Security configuration file found');
      } else {
        this.addResult('Security Config', false, 'Security configuration file not found', 'high');
      }

      // Verificar middleware de seguridad
      if (fs.existsSync('src/middleware/security.js')) {
        this.addResult('Security Middleware', true, 'Security middleware found');
      } else {
        this.addResult('Security Middleware', false, 'Security middleware not found', 'high');
      }

      // Verificar helmet en package.json
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (packageJson.dependencies.helmet) {
        this.addResult('Helmet.js', true, 'Helmet.js instalado para headers de seguridad');
      } else {
        this.addResult('Helmet.js', false, 'Helmet.js not found', 'medium');
      }

      // Verificar CORS
      if (packageJson.dependencies.cors) {
        this.addResult('CORS', true, 'CORS configured');
      } else {
        this.addResult('CORS', false, 'CORS not configured', 'medium');
      }

    } catch (error) {
      this.addResult('Security Config', false, `Error verifying configuration: ${error.message}`, 'medium');
    }
  }

  // Verificar archivos sensibles
  checkSensitiveFiles() {
    this.log('\n📁 Verifying sensitive files...', 'info');
    
    // Verificar que .env existe
    if (fs.existsSync('.env')) {
      this.addResult('Environment File', true, 'Environment file found');
      
      // Verificar permisos de .env (solo en sistemas Unix)
      if (process.platform !== 'win32') {
        try {
          const stats = fs.statSync('.env');
          const mode = stats.mode & parseInt('777', 8);
          if (mode === parseInt('600', 8) || mode === parseInt('644', 8)) {
            this.addResult('Env Permissions', true, 'Permisos de .env son seguros');
          } else {
            this.addResult('Env Permissions', false, `Permisos de .env inseguros: ${mode.toString(8)}`, 'medium');
          }
        } catch (error) {
          this.addResult('Env Permissions', false, `Error verifying permissions: ${error.message}`, 'low');
        }
      }
    } else {
      this.addResult('Environment File', false, 'Environment file not found', 'critical');
    }

    // Verificar .gitignore
    if (fs.existsSync('.gitignore')) {
      const gitignore = fs.readFileSync('.gitignore', 'utf8');
      if (gitignore.includes('.env')) {
        this.addResult('Gitignore', true, '.env está en .gitignore');
      } else {
        this.addResult('Gitignore', false, '.env no está en .gitignore', 'critical');
      }
    }
  }

  // Verify rate limiting configuration
  checkRateLimiting() {
    this.log('\n🚦 Verificando rate limiting...', 'info');
    
    try {
      const indexContent = fs.readFileSync('index.js', 'utf8');
      
      if (indexContent.includes('express-rate-limit')) {
        this.addResult('Rate Limiting', true, 'Rate limiting configured');
      } else {
        this.addResult('Rate Limiting', false, 'Rate limiting not found', 'high');
      }

      if (indexContent.includes('express-slow-down')) {
        this.addResult('Slow Down', true, 'Slow down middleware configurado');
      } else {
        this.addResult('Slow Down', false, 'Slow down middleware no encontrado', 'medium');
      }

    } catch (error) {
      this.addResult('Rate Limiting', false, `Error verificando rate limiting: ${error.message}`, 'medium');
    }
  }

  // Verificar logging de seguridad
  checkSecurityLogging() {
    this.log('\n📝 Verificando logging de seguridad...', 'info');
    
    try {
      // Verificar Winston
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (packageJson.dependencies.winston) {
        this.addResult('Winston Logging', true, 'Winston configurado para logging');
      } else {
        this.addResult('Winston Logging', false, 'Winston no encontrado', 'medium');
      }

      // Verificar Morgan
      if (packageJson.dependencies.morgan) {
        this.addResult('HTTP Logging', true, 'Morgan configurado para logging HTTP');
      } else {
        this.addResult('HTTP Logging', false, 'Morgan no encontrado', 'low');
      }

      // Verificar que existe utils.js con logMessage
      if (fs.existsSync('src/utils/utils.js')) {
        const utilsContent = fs.readFileSync('src/utils/utils.js', 'utf8');
        if (utilsContent.includes('logMessage')) {
          this.addResult('Security Logging', true, 'Función logMessage encontrada');
        } else {
          this.addResult('Security Logging', false, 'Función logMessage no encontrada', 'medium');
        }
      }

    } catch (error) {
      this.addResult('Security Logging', false, `Error verificando logging: ${error.message}`, 'medium');
    }
  }

  // Verify input validation
  checkInputValidation() {
    this.log('\n🔍 Verificando validación de entrada...', 'info');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      if (packageJson.dependencies['express-validator']) {
        this.addResult('Input Validation', true, 'Express-validator configurado');
      } else {
        this.addResult('Input Validation', false, 'Express-validator no encontrado', 'high');
      }

      // Verify sanitization middleware
      if (fs.existsSync('src/middleware/security.js')) {
        const securityContent = fs.readFileSync('src/middleware/security.js', 'utf8');
        if (securityContent.includes('sanitizeInput')) {
          this.addResult('Input Sanitization', true, 'Middleware de sanitización encontrado');
        } else {
          this.addResult('Input Sanitization', false, 'Middleware de sanitización no encontrado', 'medium');
        }
      }

    } catch (error) {
      this.addResult('Input Validation', false, `Error verificando validación: ${error.message}`, 'medium');
    }
  }

  // Generar reporte final
  generateReport() {
    this.log('\n' + '='.repeat(60), 'info');
    this.log(`${COLORS.BOLD}🔒 REPORTE DE AUDITORÍA DE SEGURIDAD${COLORS.RESET}`, 'info');
    this.log('='.repeat(60), 'info');
    
    const total = this.results.passed + this.results.failed + this.results.warnings;
    const score = Math.round((this.results.passed / total) * 100);
    
    this.log('\n📊 RESUMEN:', 'info');
    this.log(`   ✅ Pruebas pasadas: ${this.results.passed}`, 'success');
    this.log(`   ❌ Pruebas fallidas: ${this.results.failed}`, 'error');
    this.log(`   ⚠️  Advertencias: ${this.results.warnings}`, 'warning');
    this.log(`   📈 Puntuación: ${score}%`, score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error');
    
    // Clasificar nivel de seguridad
    let securityLevel, recommendation;
    if (score >= 90 && this.results.failed === 0) {
      securityLevel = '🟢 ALTO';
      recommendation = 'Excelente nivel de seguridad. Listo para producción.';
    } else if (score >= 75 && this.results.failed <= 2) {
      securityLevel = '🟡 MEDIO';
      recommendation = 'Buen nivel de seguridad. Corregir issues críticos antes de producción.';
    } else {
      securityLevel = '🔴 BAJO';
      recommendation = 'Nivel de seguridad insuficiente. Requiere mejoras significativas.';
    }
    
    this.log(`\n🛡️  NIVEL DE SEGURIDAD: ${securityLevel}`, 'info');
    this.log(`💡 RECOMENDACIÓN: ${recommendation}`, 'info');
    
    // Show critical issues
    const criticalIssues = this.results.issues.filter(i => !i.passed && i.severity === 'critical');
    if (criticalIssues.length > 0) {
      this.log('\n🚨 ISSUES CRÍTICOS A CORREGIR:', 'error');
      criticalIssues.forEach(issue => {
        this.log(`   • ${issue.test}: ${issue.message}`, 'error');
      });
    }
    
    // Show next steps
    this.log('\n📋 PRÓXIMOS PASOS:', 'info');
    if (this.results.failed > 0) {
      this.log(`   1. Corregir ${this.results.failed} issues críticos`, 'error');
    }
    if (this.results.warnings > 0) {
      this.log(`   2. Revisar ${this.results.warnings} advertencias`, 'warning');
    }
    this.log('   3. Ejecutar \'npm audit fix\' para dependencias', 'info');
    this.log('   4. Revisar SECURITY_AUDIT.md para detalles completos', 'info');
    
    this.log('\n' + '='.repeat(60), 'info');
    
    return score;
  }

  // Run complete audit
  async runAudit() {
    this.log(`${COLORS.BOLD}🔒 INICIANDO AUDITORÍA DE SEGURIDAD OWASP${COLORS.RESET}`, 'info');
    this.log(`Fecha: ${new Date().toISOString()}`, 'info');
    
    this.checkJWTSecurity();
    this.checkVulnerableDependencies();
    this.checkSecurityConfig();
    this.checkSensitiveFiles();
    this.checkRateLimiting();
    this.checkSecurityLogging();
    this.checkInputValidation();
    
    const score = this.generateReport();
    
    // Exit code basado en el score
    if (score < 60 || this.results.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

// Run audit if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new SecurityAuditor();
  auditor.runAudit().catch(console.error);
}

export default SecurityAuditor;