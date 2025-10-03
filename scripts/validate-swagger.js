#!/usr/bin/env node

/**
 * Swagger documentation validation script
 * Validates that the swagger.yaml file is syntactically correct
 * and can be loaded by the Swagger configuration.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Validating Swagger documentation...\n');

try {
  // Validate YAML file
  const swaggerYamlPath = join(__dirname, '../swagger.yaml');
  const swaggerYamlContent = readFileSync(swaggerYamlPath, 'utf8');
  const specs = YAML.parse(swaggerYamlContent);
  
  console.log('✅ Valid YAML file');
  console.log(`📋 API: ${specs.info.title} v${specs.info.version}`);
  console.log(`📝 Description: ${specs.info.description}`);
  
  // Validate basic structure
  const requiredSections = ['info', 'components', 'paths', 'tags'];
  const missingSections = requiredSections.filter(section => !specs[section]);
  
  if (missingSections.length > 0) {
    console.error('❌ Missing sections:', missingSections.join(', '));
    process.exit(1);
  }
  
  console.log('✅ Valid basic structure');
  
  // Statistics
  const stats = {
    endpoints: Object.keys(specs.paths).length,
    schemas: Object.keys(specs.components.schemas).length,
    tags: specs.tags.length,
    securitySchemes: Object.keys(specs.components.securitySchemes || {}).length
  };
  
  console.log('\n📊 Statistics:');
  console.log(`   • Endpoints: ${stats.endpoints}`);
  console.log(`   • Schemas: ${stats.schemas}`);
  console.log(`   • Tags: ${stats.tags}`);
  console.log(`   • Security Schemes: ${stats.securitySchemes}`);
  
  // Validate that all used tags are defined
  const definedTags = new Set(specs.tags.map(tag => tag.name));
  const usedTags = new Set();
  
  Object.values(specs.paths).forEach(pathMethods => {
    Object.values(pathMethods).forEach(method => {
      if (method.tags) {
        method.tags.forEach(tag => usedTags.add(tag));
      }
    });
  });
  
  const undefinedTags = [...usedTags].filter(tag => !definedTags.has(tag));
  
  if (undefinedTags.length > 0) {
    console.warn('⚠️  Tags used but not defined:', undefinedTags.join(', '));
  } else {
    console.log('✅ All tags are defined');
  }
  
  // Try to load Swagger configuration
  try {
    const { specs: configSpecs } = await import('../src/config/swagger.js');
    console.log('✅ Swagger configuration loaded successfully');
  } catch (configError) {
    console.error('❌ Error loading Swagger configuration:', configError.message);
    process.exit(1);
  }
  
  console.log('\n🎉 Validation completed successfully!');
  console.log('📖 Documentation is ready to be served at /api-docs');
  
} catch (error) {
  console.error('❌ Error during validation:', error.message);
  process.exit(1);
}