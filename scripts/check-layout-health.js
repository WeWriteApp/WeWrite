#!/usr/bin/env node

/**
 * Layout Health Check Script
 *
 * This script scans the codebase for deprecated layout patterns
 * and ensures the modern layout structure is being used correctly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns to detect deprecated layout usage
const DEPRECATED_PATTERNS = [
  {
    pattern: /import.*DashboardLayout/g,
    message: 'DashboardLayout import detected',
    severity: 'error'
  },
  {
    pattern: /<DashboardLayout>/g,
    message: 'DashboardLayout JSX usage detected',
    severity: 'error'
  },
  {
    pattern: /const Layout = user \? DashboardLayout/g,
    message: 'Deprecated layout conditional detected',
    severity: 'error'
  },
  {
    pattern: /from ["'].*DashboardLayout["']/g,
    message: 'DashboardLayout import path detected',
    severity: 'error'
  }
];

// Required modern layout patterns
const REQUIRED_PATTERNS = [
  {
    file: 'app/ClientLayout.js',
    pattern: /SidebarProvider/g,
    message: 'SidebarProvider should be present in ClientLayout'
  },
  {
    file: 'app/ClientLayout.js', 
    pattern: /SidebarLayout/g,
    message: 'SidebarLayout should be present in ClientLayout'
  },
  {
    file: 'app/ClientLayout.js',
    pattern: /MobileBottomNav/g,
    message: 'MobileBottomNav should be present in ClientLayout'
  }
];

// Files to scan
const SCAN_DIRECTORIES = ['app'];
const FILE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];
const EXCLUDE_FILES = [
  'app/utils/eslint-layout-rules.js', // Contains examples
  'app/utils/layoutValidation.js',    // Contains examples
  'app/DashboardLayout.tsx'           // Deprecated but kept for warnings
];

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .next directories
      if (!['node_modules', '.next', '.git'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (FILE_EXTENSIONS.includes(path.extname(file))) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Scan a file for deprecated patterns
 */
function scanFile(filePath) {
  // Skip excluded files
  if (EXCLUDE_FILES.includes(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  DEPRECATED_PATTERNS.forEach(({ pattern, message, severity }) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
        issues.push({
          file: filePath,
          line: lineNumber,
          message,
          severity,
          match: match.trim()
        });
      });
    }
  });
  
  return issues;
}

/**
 * Check for required modern layout patterns
 */
function checkRequiredPatterns() {
  const issues = [];
  
  REQUIRED_PATTERNS.forEach(({ file, pattern, message }) => {
    const filePath = path.join(process.cwd(), file);
    
    if (!fs.existsSync(filePath)) {
      issues.push({
        file: filePath,
        message: `Required file ${file} not found`,
        severity: 'error'
      });
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    if (!pattern.test(content)) {
      issues.push({
        file: filePath,
        message,
        severity: 'warning'
      });
    }
  });
  
  return issues;
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Running Layout Health Check...\n');
  
  let allIssues = [];
  
  // Scan all files for deprecated patterns
  SCAN_DIRECTORIES.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = getAllFiles(dir);
      console.log(`📁 Scanning ${files.length} files in ${dir}/`);
      
      files.forEach(file => {
        const issues = scanFile(file);
        allIssues = allIssues.concat(issues);
      });
    }
  });
  
  // Check for required patterns
  const requiredIssues = checkRequiredPatterns();
  allIssues = allIssues.concat(requiredIssues);
  
  // Report results
  console.log('\n📊 Results:');
  
  if (allIssues.length === 0) {
    console.log('✅ No layout issues detected! Modern layout structure is properly implemented.');
    process.exit(0);
  }
  
  const errors = allIssues.filter(issue => issue.severity === 'error');
  const warnings = allIssues.filter(issue => issue.severity === 'warning');
  
  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} Error(s) Found:`);
    errors.forEach(issue => {
      console.log(`  📄 ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
      console.log(`     ${issue.message}`);
      if (issue.match) {
        console.log(`     Code: ${issue.match}`);
      }
      console.log('');
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} Warning(s) Found:`);
    warnings.forEach(issue => {
      console.log(`  📄 ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
      console.log(`     ${issue.message}`);
      console.log('');
    });
  }
  
  console.log('\n💡 To fix these issues:');
  console.log('   1. Remove DashboardLayout imports and JSX usage');
  console.log('   2. Return content directly from page components');
  console.log('   3. Use React.Fragment for authenticated users');
  console.log('   4. Use PublicLayout only for public pages');
  console.log('   5. The modern layout is handled automatically by ClientLayout.js');
  
  process.exit(errors.length > 0 ? 1 : 0);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, scanFile, checkRequiredPatterns };
