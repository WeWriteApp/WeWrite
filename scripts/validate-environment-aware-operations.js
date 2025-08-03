#!/usr/bin/env node

/**
 * Environment-Aware Operations Validator
 * 
 * This script validates that all database operations go through environment-aware APIs
 * and checks for any remaining direct Firebase calls that bypass the API layer.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

// Patterns to check for
const VALIDATION_PATTERNS = {
  // Direct Firebase imports (should be avoided in components)
  directFirebaseImports: {
    pattern: /from\s+['"].*firebase\/(firestore|database|auth)['"]/g,
    severity: 'error',
    message: 'Direct Firebase imports found - should use API client'
  },
  
  // Direct collection references (should use getCollectionName)
  hardcodedCollections: {
    pattern: /collection\(['"](?:pages|users|subscriptions|siteVisitors|activities)['"\)]/g,
    severity: 'error',
    message: 'Hardcoded collection names found - should use getCollectionName()'
  },
  
  // Direct Firebase function calls
  directFirebaseCalls: {
    pattern: /\b(getDoc|getDocs|onSnapshot|addDoc|updateDoc|deleteDoc|setDoc)\s*\(/g,
    severity: 'warning',
    message: 'Direct Firebase function calls found - consider using API endpoints'
  },
  
  // Old database imports
  oldDatabaseImports: {
    pattern: /from\s+['"].*firebase\/database['"]/g,
    severity: 'error',
    message: 'Old Firebase database imports found - should use apiClient'
  },
  
  // Environment-aware API usage (good patterns)
  environmentAwareAPIs: {
    pattern: /getCollectionName\(['"].*['"]\)/g,
    severity: 'info',
    message: 'Environment-aware collection naming found'
  },
  
  // API client usage (good patterns)
  apiClientUsage: {
    pattern: /from\s+['"].*utils\/apiClient['"]/g,
    severity: 'info',
    message: 'API client usage found'
  }
};

// Directories to scan
const SCAN_DIRECTORIES = [
  'app/components',
  'app/hooks',
  'app/providers',
  'app/utils',
  'app/services'
];

// Files to exclude from scanning
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.next/,
  /app\/firebase\//,  // Firebase config files are allowed to have direct imports
  /app\/api\//,       // API routes are allowed to have direct Firebase calls
  /\.test\./,         // Test files
  /\.spec\./          // Spec files
];

class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.filesScanned = 0;
    this.issuesFound = 0;
  }

  addIssue(type, file, line, lineNumber, pattern, message) {
    const issue = {
      file: file.replace(process.cwd(), ''),
      line: line.trim(),
      lineNumber,
      pattern: pattern.toString(),
      message
    };

    switch (type) {
      case 'error':
        this.errors.push(issue);
        break;
      case 'warning':
        this.warnings.push(issue);
        break;
      case 'info':
        this.info.push(issue);
        break;
    }
    
    this.issuesFound++;
  }

  printResults() {
    console.log(`\n${colors.cyan}=== Environment-Aware Operations Validation Results ===${colors.reset}\n`);
    
    console.log(`Files scanned: ${colors.blue}${this.filesScanned}${colors.reset}`);
    console.log(`Issues found: ${colors.yellow}${this.issuesFound}${colors.reset}\n`);

    // Print errors
    if (this.errors.length > 0) {
      console.log(`${colors.red}❌ ERRORS (${this.errors.length}):${colors.reset}`);
      this.errors.forEach(error => {
        console.log(`  ${colors.red}•${colors.reset} ${error.file}:${error.lineNumber}`);
        console.log(`    ${colors.white}${error.message}${colors.reset}`);
        console.log(`    ${colors.yellow}${error.line}${colors.reset}\n`);
      });
    }

    // Print warnings
    if (this.warnings.length > 0) {
      console.log(`${colors.yellow}⚠️  WARNINGS (${this.warnings.length}):${colors.reset}`);
      this.warnings.forEach(warning => {
        console.log(`  ${colors.yellow}•${colors.reset} ${warning.file}:${warning.lineNumber}`);
        console.log(`    ${colors.white}${warning.message}${colors.reset}`);
        console.log(`    ${colors.yellow}${warning.line}${colors.reset}\n`);
      });
    }

    // Print info (good patterns)
    if (this.info.length > 0) {
      console.log(`${colors.green}✅ GOOD PATTERNS (${this.info.length}):${colors.reset}`);
      this.info.forEach(info => {
        console.log(`  ${colors.green}•${colors.reset} ${info.file}:${info.lineNumber}`);
        console.log(`    ${colors.white}${info.message}${colors.reset}\n`);
      });
    }

    // Summary
    console.log(`${colors.cyan}=== SUMMARY ===${colors.reset}`);
    if (this.errors.length === 0) {
      console.log(`${colors.green}✅ No critical errors found!${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ ${this.errors.length} critical errors need to be fixed${colors.reset}`);
    }
    
    if (this.warnings.length > 0) {
      console.log(`${colors.yellow}⚠️  ${this.warnings.length} warnings should be reviewed${colors.reset}`);
    }
    
    console.log(`${colors.green}✅ ${this.info.length} good patterns found${colors.reset}\n`);

    return this.errors.length === 0;
  }
}

function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function scanFile(filePath, result) {
  if (shouldExcludeFile(filePath)) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    result.filesScanned++;

    lines.forEach((line, index) => {
      Object.entries(VALIDATION_PATTERNS).forEach(([patternName, config]) => {
        const matches = line.match(config.pattern);
        if (matches) {
          result.addIssue(
            config.severity,
            filePath,
            line,
            index + 1,
            config.pattern,
            config.message
          );
        }
      });
    });
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
  }
}

function scanDirectory(dirPath, result) {
  if (!fs.existsSync(dirPath)) {
    console.log(`${colors.yellow}Warning: Directory ${dirPath} does not exist${colors.reset}`);
    return;
  }

  const items = fs.readdirSync(dirPath);
  
  items.forEach(item => {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      scanDirectory(itemPath, result);
    } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js') || item.endsWith('.jsx'))) {
      scanFile(itemPath, result);
    }
  });
}

function main() {
  console.log(`${colors.cyan}🔍 Starting Environment-Aware Operations Validation...${colors.reset}\n`);
  
  const result = new ValidationResult();
  
  SCAN_DIRECTORIES.forEach(dir => {
    console.log(`Scanning ${colors.blue}${dir}${colors.reset}...`);
    scanDirectory(dir, result);
  });
  
  const success = result.printResults();
  
  if (success) {
    console.log(`${colors.green}🎉 Validation passed! All operations are environment-aware.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}💥 Validation failed! Please fix the errors above.${colors.reset}`);
    process.exit(1);
  }
}

// Run the validation
main();
