#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to rename session/user system to Account-based multi-auth system
 * 
 * Architecture:
 * - MultiAuthProvider manages multiple Firebase App instances (one per user)
 * - ActiveAccountProvider tracks which user is currently active
 * - Each app instance uses unique name and storage key (e.g. firebase_user_jamie)
 */

// File extensions to search
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.md'];

// Directories to search
const SEARCH_DIRS = ['app', 'docs'];

// Files to exclude
const EXCLUDE_PATTERNS = ['node_modules', '.git', '.next', 'dist', 'build'];

// Specific renaming patterns for the multi-auth system
const RENAMING_PATTERNS = [
  // Provider renames (exact matches)
  {
    find: /\bSessionBagProvider\b/g,
    replace: 'MultiAuthProvider',
    description: 'SessionBagProvider → MultiAuthProvider'
  },
  {
    find: /\bActiveSessionProvider\b/g,
    replace: 'ActiveAccountProvider',
    description: 'ActiveSessionProvider → ActiveAccountProvider'
  },
  
  // Hook renames (exact matches)
  {
    find: /\buseSessionBag\b/g,
    replace: 'useMultiAuth',
    description: 'useSessionBag() → useMultiAuth()'
  },
  {
    find: /\buseActiveSession\b/g,
    replace: 'useActiveAccount',
    description: 'useActiveSession() → useActiveAccount()'
  },
  
  // CurrentSession system renames
  {
    find: /\bCurrentSessionProvider\b/g,
    replace: 'CurrentAccountProvider',
    description: 'CurrentSessionProvider → CurrentAccountProvider'
  },
  {
    find: /\buseCurrentSession\b/g,
    replace: 'useCurrentAccount',
    description: 'useCurrentSession() → useCurrentAccount()'
  },
  
  // Type and interface renames
  {
    find: /\bSessionBagState\b/g,
    replace: 'MultiAuthState',
    description: 'SessionBagState → MultiAuthState'
  },
  {
    find: /\bSessionBagActions\b/g,
    replace: 'MultiAuthActions',
    description: 'SessionBagActions → MultiAuthActions'
  },
  {
    find: /\bActiveSessionState\b/g,
    replace: 'ActiveAccountState',
    description: 'ActiveSessionState → ActiveAccountState'
  },
  {
    find: /\bActiveSessionActions\b/g,
    replace: 'ActiveAccountActions',
    description: 'ActiveSessionActions → ActiveAccountActions'
  },
  {
    find: /\bCurrentSessionState\b/g,
    replace: 'CurrentAccountState',
    description: 'CurrentSessionState → CurrentAccountState'
  },
  {
    find: /\bCurrentSessionActions\b/g,
    replace: 'CurrentAccountActions',
    description: 'CurrentSessionActions → CurrentAccountActions'
  },
  {
    find: /\bCurrentSessionContextValue\b/g,
    replace: 'CurrentAccountContextValue',
    description: 'CurrentSessionContextValue → CurrentAccountContextValue'
  },
  {
    find: /\bCurrentSessionContext\b/g,
    replace: 'CurrentAccountContext',
    description: 'CurrentSessionContext → CurrentAccountContext'
  },
  {
    find: /\bUserSession\b/g,
    replace: 'UserAccount',
    description: 'UserSession → UserAccount'
  },
  {
    find: /\bSessionData\b/g,
    replace: 'AccountData',
    description: 'SessionData → AccountData'
  },
  
  // Variable and property renames
  {
    find: /\bsessionBag\b/g,
    replace: 'multiAuth',
    description: 'sessionBag → multiAuth'
  },
  {
    find: /\bactiveSession\b/g,
    replace: 'activeAccount',
    description: 'activeSession → activeAccount'
  },
  {
    find: /\bcurrentSession\b/g,
    replace: 'currentAccount',
    description: 'currentSession → currentAccount'
  },
  
  // Method renames for multi-auth system
  {
    find: /\bswitchToSession\b/g,
    replace: 'switchAccount',
    description: 'switchToSession → switchAccount'
  },
  {
    find: /\bswitchToSessionByUid\b/g,
    replace: 'switchAccountByUid',
    description: 'switchToSessionByUid → switchAccountByUid'
  },
  {
    find: /\bclearActiveSession\b/g,
    replace: 'signOutCurrent',
    description: 'clearActiveSession → signOutCurrent'
  },
  {
    find: /\brefreshActiveSession\b/g,
    replace: 'refreshActiveAccount',
    description: 'refreshActiveSession → refreshActiveAccount'
  },
  {
    find: /\bupdateActiveSession\b/g,
    replace: 'updateActiveAccount',
    description: 'updateActiveSession → updateActiveAccount'
  },
  
  // Import path updates
  {
    find: /from\s+['"]([^'"]*\/)?SessionBagProvider['"]/g,
    replace: "from '$1MultiAuthProvider'",
    description: 'Update SessionBagProvider import paths'
  },
  {
    find: /from\s+['"]([^'"]*\/)?ActiveSessionProvider['"]/g,
    replace: "from '$1ActiveAccountProvider'",
    description: 'Update ActiveSessionProvider import paths'
  },
  {
    find: /from\s+['"]([^'"]*\/)?CurrentSessionProvider['"]/g,
    replace: "from '$1CurrentAccountProvider'",
    description: 'Update CurrentSessionProvider import paths'
  },
  
  // Documentation and comment updates
  {
    find: /session\s+bag/gi,
    replace: 'multi-auth',
    description: 'session bag → multi-auth in comments'
  },
  {
    find: /active\s+session/gi,
    replace: 'active account',
    description: 'active session → active account in comments'
  },
  {
    find: /current\s+session/gi,
    replace: 'current account',
    description: 'current session → current account in comments'
  },
  {
    find: /user\s+session/gi,
    replace: 'user account',
    description: 'user session → user account in comments'
  }
];

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  if (!EXTENSIONS.includes(ext)) return false;
  
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
    
    for (const pattern of RENAMING_PATTERNS) {
      const beforeContent = newContent;
      newContent = newContent.replace(pattern.find, pattern.replace);
      
      if (newContent !== beforeContent) {
        hasChanges = true;
        appliedPatterns.push(pattern.description);
      }
    }
    
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
  console.log('🔄 Renaming to Account-based Multi-Auth System...\n');
  console.log('🧠 Architecture:');
  console.log('   - MultiAuthProvider: manages multiple Firebase App instances');
  console.log('   - ActiveAccountProvider: tracks currently active user');
  console.log('   - Each app instance uses unique name and storage key\n');
  
  let totalFiles = 0;
  let updatedFiles = 0;
  
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
    console.log(`\n✅ Successfully renamed ${updatedFiles} files!`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Rename actual files:`);
    console.log(`      - SessionBagProvider.tsx → MultiAuthProvider.tsx`);
    console.log(`      - ActiveSessionProvider.tsx → ActiveAccountProvider.tsx`);
    console.log(`      - CurrentSessionProvider.tsx → CurrentAccountProvider.tsx`);
    console.log(`   2. Update any remaining import paths`);
    console.log(`   3. Test the multi-auth functionality`);
    console.log(`\n🔄 Restart your development server to see changes.`);
  } else {
    console.log(`\n✨ No files needed updating!`);
  }
}

main();
