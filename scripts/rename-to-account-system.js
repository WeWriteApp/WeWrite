#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Comprehensive script to rename session/user terminology to Account system
 * This addresses the architectural shift to a unified Account-based system
 */

// File extensions to search
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.md', '.mdx'];

// Directories to search
const SEARCH_DIRS = [
  'app',
  'docs', 
  'scripts',
  'README.md',
  'CONTRIBUTING.md'
];

// Files to exclude from processing
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.env',
  'package-lock.json',
  'yarn.lock',
  '.DS_Store'
];

// Comprehensive renaming patterns
const RENAMING_PATTERNS = [
  // Provider and Hook renames (exact matches)
  {
    find: /\bSessionBagProvider\b/g,
    replace: 'MultiAuthProvider',
    description: 'Rename SessionBagProvider to MultiAuthProvider'
  },
  {
    find: /\bActiveSessionProvider\b/g,
    replace: 'ActiveAccountProvider', 
    description: 'Rename ActiveSessionProvider to ActiveAccountProvider'
  },
  {
    find: /\buseSessionBag\b/g,
    replace: 'useMultiAuth',
    description: 'Rename useSessionBag hook to useMultiAuth'
  },
  {
    find: /\buseActiveSession\b/g,
    replace: 'useActiveAccount',
    description: 'Rename useActiveSession hook to useActiveAccount'
  },
  
  // CurrentSession -> CurrentAccount
  {
    find: /\bCurrentSessionProvider\b/g,
    replace: 'CurrentAccountProvider',
    description: 'Rename CurrentSessionProvider to CurrentAccountProvider'
  },
  {
    find: /\buseCurrentSession\b/g,
    replace: 'useCurrentAccount',
    description: 'Rename useCurrentSession hook to useCurrentAccount'
  },
  {
    find: /\bCurrentSessionState\b/g,
    replace: 'CurrentAccountState',
    description: 'Rename CurrentSessionState type to CurrentAccountState'
  },
  {
    find: /\bCurrentSessionActions\b/g,
    replace: 'CurrentAccountActions',
    description: 'Rename CurrentSessionActions type to CurrentAccountActions'
  },
  {
    find: /\bCurrentSessionContextValue\b/g,
    replace: 'CurrentAccountContextValue',
    description: 'Rename CurrentSessionContextValue type to CurrentAccountContextValue'
  },
  {
    find: /\bCurrentSessionContext\b/g,
    replace: 'CurrentAccountContext',
    description: 'Rename CurrentSessionContext to CurrentAccountContext'
  },
  
  // Session types and interfaces
  {
    find: /\bUserSession\b/g,
    replace: 'UserAccount',
    description: 'Rename UserSession type to UserAccount'
  },
  {
    find: /\bSessionData\b/g,
    replace: 'AccountData',
    description: 'Rename SessionData type to AccountData'
  },
  {
    find: /\bSessionState\b/g,
    replace: 'AccountState',
    description: 'Rename SessionState type to AccountState'
  },
  {
    find: /\bSessionBag\b/g,
    replace: 'MultiAuth',
    description: 'Rename SessionBag type to MultiAuth'
  },
  
  // Variable and property names
  {
    find: /\bcurrentSession\b/g,
    replace: 'currentAccount',
    description: 'Rename currentSession variable to currentAccount'
  },
  {
    find: /\bactiveSession\b/g,
    replace: 'activeAccount',
    description: 'Rename activeSession variable to activeAccount'
  },
  {
    find: /\bsessionBag\b/g,
    replace: 'multiAuth',
    description: 'Rename sessionBag variable to multiAuth'
  },
  {
    find: /\bsession\b(?=\s*[?.:,)\]\}])/g,
    replace: 'account',
    description: 'Rename session variable to account (when used as object)'
  },
  {
    find: /\buser\b(?=\s*[?.:,)\]\}])/g,
    replace: 'account',
    description: 'Rename user variable to account (when used as object)'
  },
  
  // Function and method names
  {
    find: /\bswitchToSession\b/g,
    replace: 'switchToAccount',
    description: 'Rename switchToSession method to switchToAccount'
  },
  {
    find: /\bswitchToSessionByUid\b/g,
    replace: 'switchToAccountByUid',
    description: 'Rename switchToSessionByUid method to switchToAccountByUid'
  },
  {
    find: /\bclearActiveSession\b/g,
    replace: 'clearActiveAccount',
    description: 'Rename clearActiveSession method to clearActiveAccount'
  },
  {
    find: /\brefreshActiveSession\b/g,
    replace: 'refreshActiveAccount',
    description: 'Rename refreshActiveSession method to refreshActiveAccount'
  },
  {
    find: /\bupdateActiveSession\b/g,
    replace: 'updateActiveAccount',
    description: 'Rename updateActiveSession method to updateActiveAccount'
  },
  {
    find: /\bgetUserSession\b/g,
    replace: 'getUserAccount',
    description: 'Rename getUserSession method to getUserAccount'
  },
  {
    find: /\bsetUserSession\b/g,
    replace: 'setUserAccount',
    description: 'Rename setUserSession method to setUserAccount'
  },
  
  // File and component names in imports/exports
  {
    find: /from\s+['"]([^'"]*\/)?SessionBagProvider['"]/g,
    replace: "from '$1MultiAuthProvider'",
    description: 'Update SessionBagProvider import paths'
  },
  {
    find: /from\s+['"]([^'"]*\/)?CurrentSessionProvider['"]/g,
    replace: "from '$1CurrentAccountProvider'",
    description: 'Update CurrentSessionProvider import paths'
  },
  
  // Comments and documentation
  {
    find: /session\s+management/gi,
    replace: 'account management',
    description: 'Update session management references in comments'
  },
  {
    find: /user\s+session/gi,
    replace: 'user account',
    description: 'Update user session references in comments'
  },
  {
    find: /current\s+session/gi,
    replace: 'current account',
    description: 'Update current session references in comments'
  },
  {
    find: /active\s+session/gi,
    replace: 'active account',
    description: 'Update active session references in comments'
  }
];

function shouldProcessFile(filePath) {
  // Check if file has valid extension
  const ext = path.extname(filePath);
  if (!EXTENSIONS.includes(ext)) return false;
  
  // Check if file is in excluded patterns
  for (const exclude of EXCLUDE_PATTERNS) {
    if (filePath.includes(exclude)) return false;
  }
  
  return true;
}

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directory not found: ${dir}`);
    return fileList;
  }
  
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (shouldProcessFile(dir)) {
      fileList.push(dir);
    }
    return fileList;
  }
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip excluded directories
      if (!EXCLUDE_PATTERNS.some(pattern => file.includes(pattern))) {
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
    for (const pattern of RENAMING_PATTERNS) {
      const beforeContent = newContent;
      newContent = newContent.replace(pattern.find, pattern.replace);
      
      if (newContent !== beforeContent) {
        hasChanges = true;
        appliedPatterns.push(pattern.description);
      }
    }
    
    // Write back if changes were made
    if (hasChanges) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
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
  console.log('🔄 Starting comprehensive session/user → Account system rename...\n');
  
  let totalFiles = 0;
  let updatedFiles = 0;
  
  // Process each search directory/file
  for (const searchPath of SEARCH_DIRS) {
    console.log(`📁 Processing: ${searchPath}`);
    
    const files = getAllFiles(searchPath);
    totalFiles += files.length;
    
    for (const file of files) {
      if (processFile(file)) {
        updatedFiles++;
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files updated: ${updatedFiles}`);
  
  if (updatedFiles > 0) {
    console.log(`\n✅ Successfully renamed ${updatedFiles} files to Account system!`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Rename actual files:`);
    console.log(`      - SessionBagProvider.tsx → MultiAuthProvider.tsx`);
    console.log(`      - CurrentSessionProvider.tsx → CurrentAccountProvider.tsx`);
    console.log(`      - session.ts → account.ts (types file)`);
    console.log(`   2. Update import paths in affected files`);
    console.log(`   3. Update documentation and README files`);
    console.log(`   4. Test the application thoroughly`);
    console.log(`   5. Update any remaining references manually`);
    console.log(`\n🔄 Please restart your development server to see the changes.`);
  } else {
    console.log(`\n✨ No session/user references found to rename!`);
  }
}

// Run the script
main();
