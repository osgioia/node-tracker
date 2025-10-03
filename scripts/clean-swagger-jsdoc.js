#!/usr/bin/env node

/**
 * Script to remove Swagger JSDoc comments from router files
 * Now that we have static YAML documentation, these comments are redundant
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

console.log('🧹 Removing Swagger JSDoc comments...\n');

// Find all router files
const routerFiles = glob.sync('src/**/*.router.js');

let totalFilesProcessed = 0;
let totalCommentsRemoved = 0;

routerFiles.forEach(filePath => {
  console.log(`📁 Processing: ${filePath}`);
  
  let content = readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Counter for comments found in this file
  let commentsInFile = 0;
  
  // Regular expression to find Swagger JSDoc comment blocks
  // Searches from /** followed by * @swagger until the end of comment */
  const swaggerCommentRegex = /\/\*\*\s*\n\s*\*\s*@swagger[\s\S]*?\*\//g;
  
  // Count comments before removing
  const matches = content.match(swaggerCommentRegex);
  if (matches) {
    commentsInFile = matches.length;
    totalCommentsRemoved += commentsInFile;
  }
  
  // Remove all Swagger JSDoc comments
  content = content.replace(swaggerCommentRegex, '');
  
  // Clean up multiple empty lines that may remain
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Only write if there were changes
  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`   ✅ ${commentsInFile} JSDoc comments removed`);
    totalFilesProcessed++;
  } else {
    console.log(`   ℹ️  No Swagger JSDoc comments found`);
  }
});

console.log('\n📊 Summary:');
console.log(`   • Files processed: ${totalFilesProcessed}`);
console.log(`   • Total comments removed: ${totalCommentsRemoved}`);
console.log('\n🎉 Cleanup completed!');
console.log('💡 Documentation is now served exclusively from swagger.yaml');