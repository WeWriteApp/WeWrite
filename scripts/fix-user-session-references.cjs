#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to systematically fix undefined 'user' references that should be 'session'
 * This addresses the sign-in issue where components crash due to undefined variables
 */

// File extensions to search
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

// Directories to search
const SEARCH_DIRS = ['app/components', 'app/pages', 'app/providers', 'app/hooks', 'app/utils'];

// Patterns to find and replace
const PATTERNS = [
  // Common patterns where 'user' should be 'session'
  {
    find: /\buser\s*\?\s*`\/user\/\$\{session\.uid\}`/g,
    replace: 'session ? `/user/${session.uid}`',
    description: 'Fix user ? `/user/${session.uid}` patterns'
  },
  {
    find: /\buser\s*\?\s*64\s*:\s*0/g,
    replace: 'session ? 64 : 0',
    description: 'Fix user ? 64 : 0 patterns'
  },
  {
    find: /\buser\s*\?\s*256\s*:\s*user\s*\?\s*64\s*:\s*0/g,
    replace: 'session ? 256 : session ? 64 : 0',
    description: 'Fix complex user ternary patterns'
  },
  {
    find: /\buser\s*\?\s*\/user\/\$\{session\.uid\}/g,
    replace: 'session ? `/user/${session.uid}`',
    description: 'Fix user ? /user/${session.uid} patterns'
  },
  {
    find: /\buser\s*\?\s*session\.uid/g,
    replace: 'session ? session.uid',
    description: 'Fix user ? session.uid patterns'
  },
  {
    find: /\buser\s*\?\s*session\.email/g,
    replace: 'session ? session.email',
    description: 'Fix user ? session.email patterns'
  },
  {
    find: /\buser\s*\?\s*session\./g,
    replace: 'session ? session.',
    description: 'Fix user ? session.* patterns'
  }
];

// Files to exclude from processing
const EXCLUDE_FILES = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.env',
  'package-lock.json',
  'yarn.lock'
];

function shouldProcessFile(filePath) {
  // Check if file has valid extension
  const ext = path.extname(filePath);
  if (!EXTENSIONS.includes(ext)) return false;
  
  // Check if file is in excluded directories
  for (const exclude of EXCLUDE_FILES) {
    if (filePath.includes(exclude)) return false;
  }
  
  return true;
}

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directory not found: ${dir}`);
    return fileList;
  }
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip excluded directories
      if (!EXCLUDE_FILES.includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (shouldProcessFile(filePath)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    let hasChanges = false;
    const appliedPatterns = [];
    
    // Apply each pattern
    for (const pattern of PATTERNS) {
      const beforeLength = newContent.length;
      newContent = newContent.replace(pattern.find, pattern.replace);
      
      if (newContent.length !== beforeLength || newContent !== content) {
        hasChanges = true;
        appliedPatterns.push(pattern.description);
      }
    }
    
    // Write back if changes were made
    if (hasChanges) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      appliedPatterns.forEach(desc => console.log(`   - ${desc}`));
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔍 Searching for user/session reference issues...\n');
  
  let totalFiles = 0;
  let fixedFiles = 0;
  
  // Process each search directory
  for (const searchDir of SEARCH_DIRS) {
    console.log(`📁 Processing directory: ${searchDir}`);
    
    const files = getAllFiles(searchDir);
    totalFiles += files.length;
    
    for (const file of files) {
      if (processFile(file)) {
        fixedFiles++;
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files fixed: ${fixedFiles}`);
  
  if (fixedFiles > 0) {
    console.log(`\n✅ Fixed ${fixedFiles} files with user/session reference issues!`);
    console.log(`🔄 Please restart your development server to see the changes.`);
  } else {
    console.log(`\n✨ No user/session reference issues found!`);
  }
}

// Run the script
main();
