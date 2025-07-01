#!/usr/bin/env node

/**
 * Comprehensive script to find ALL files importing from globalStore and fix them
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findAllGlobalStoreFiles(dir = 'app', files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (!['node_modules', '.next', '.git'].includes(item)) {
        findAllGlobalStoreFiles(fullPath, files);
      }
    } else if (stat.isFile() && /\.(js|jsx|ts|tsx)$/.test(item)) {
      // Check if file contains globalStore import, useAuth usage, or syntax errors from migration
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('store/globalStore') ||
          (content.includes('useAuth') && content.includes('from')) ||
          content.includes('const { user }') ||
          content.includes('const { user,') ||
          content.includes('., sessionId') ||
          content.includes('., sessionname') ||
          content.includes('SessionZustandBridge') ||
          content.includes('PaymentFeatureGuard')) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

function getCorrectImportPath(filePath, targetPath) {
  const fileDir = path.dirname(filePath);
  const pathParts = fileDir.split('/');
  const appIndex = pathParts.indexOf('app');
  
  if (appIndex === -1) {
    console.error(`Could not find 'app' directory in path: ${filePath}`);
    return `../${targetPath}`;
  }
  
  const levelsUp = pathParts.length - appIndex - 1;
  const prefix = levelsUp === 0 ? './' : '../'.repeat(levelsUp);
  
  return `${prefix}${targetPath}`;
}

function fixGlobalStoreFile(filePath) {
  console.log(`🔧 Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  
  // 1. Fix imports - more comprehensive patterns
  const importReplacements = [
    // Single useAuth import
    {
      from: /import\s*{\s*useAuth\s*}\s*from\s*['"][^'"]*store\/globalStore['"];?\s*$/gm,
      to: () => {
        const correctPath = getCorrectImportPath(filePath, 'providers/CurrentSessionProvider');
        return `import { useCurrentSession } from '${correctPath}';`;
      }
    },
    // useAuth with other imports (comma separated)
    {
      from: /import\s*{\s*useAuth,\s*([^}]+)\s*}\s*from\s*['"][^'"]*store\/globalStore['"];?\s*$/gm,
      to: () => {
        const correctPath = getCorrectImportPath(filePath, 'providers/CurrentSessionProvider');
        return `import { useCurrentSession } from '${correctPath}';`;
      }
    },
    // useNotifications only
    {
      from: /import\s*{\s*useNotifications\s*}\s*from\s*['"][^'"]*store\/globalStore['"];?\s*$/gm,
      to: () => {
        const correctPath = getCorrectImportPath(filePath, 'providers/NotificationProvider');
        return `import { useNotifications } from '${correctPath}';`;
      }
    },
    // useTheme only
    {
      from: /import\s*{\s*useTheme\s*}\s*from\s*['"][^'"]*store\/globalStore['"];?\s*$/gm,
      to: () => '// Theme functionality moved to session store'
    },
    // Any remaining globalStore imports (catch-all)
    {
      from: /import\s*{[^}]*}\s*from\s*['"][^'"]*store\/globalStore['"];?\s*$/gm,
      to: () => {
        const correctPath = getCorrectImportPath(filePath, 'providers/CurrentSessionProvider');
        return `import { useCurrentSession } from '${correctPath}';`;
      }
    }
  ];
  
  importReplacements.forEach(replacement => {
    const newContent = content.replace(replacement.from, replacement.to());
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Fixed import`);
    }
  });
  
  // 2. Fix hook usage
  const hookReplacements = [
    { from: /const\s*{\s*user\s*}\s*=\s*useAuth\(\);?/g, to: 'const { session } = useCurrentSession();' },
    { from: /const\s*{\s*user,\s*isAuthenticated\s*}\s*=\s*useAuth\(\);?/g, to: 'const { session, isAuthenticated } = useCurrentSession();' },
    { from: /const\s*{\s*user,\s*loading:\s*authLoading\s*}\s*=\s*useAuth\(\);?/g, to: 'const { session, isLoading: authLoading } = useCurrentSession();' },
    { from: /const\s*{\s*user,\s*loading\s*}\s*=\s*useAuth\(\);?/g, to: 'const { session, isLoading } = useCurrentSession();' }
  ];
  
  hookReplacements.forEach(replacement => {
    const newContent = content.replace(replacement.from, replacement.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Fixed hook usage`);
    }
  });
  
  // 3. Fix variable references - more comprehensive
  const variableReplacements = [
    { from: /\buser\.uid\b/g, to: 'session.uid' },
    { from: /\buser\.email\b/g, to: 'session.email' },
    { from: /\buser\.displayName\b/g, to: 'session.displayName' },
    { from: /\buser\.photoURL\b/g, to: 'session.photoURL' },
    { from: /\buser\.emailVerified\b/g, to: 'session.emailVerified' },
    { from: /\buser\.username\b/g, to: 'session.username' },
    { from: /\buser\?\./g, to: 'session?.' },
    { from: /!\s*user\b/g, to: '!session' },
    { from: /\buser\s*&&/g, to: 'session &&' },
    { from: /&&\s*user\b/g, to: '&& session' },
    { from: /\(\s*user\s*\)/g, to: '(session)' },
    { from: /\buser\s*\?\s*user\./g, to: 'session?.'},
    // Fix syntax errors from previous replacements
    { from: /profile\.\s*,\s*sessionname/g, to: 'profile.username' },
    { from: /,\s*sessionname:/g, to: ', username:' },
    { from: /\bsessionname\b/g, to: 'username' }
  ];
  
  variableReplacements.forEach(replacement => {
    const newContent = content.replace(replacement.from, replacement.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Fixed variable reference`);
    }
  });
  
  // 4. Fix useEffect dependencies - more comprehensive
  const dependencyReplacements = [
    { from: /\[([^[\]]*),?\s*user([^[\]]*)\]/g, to: '[$1, session$2]' },
    { from: /\[([^[\]]*),?\s*user\.uid([^[\]]*)\]/g, to: '[$1, session?.uid$2]' },
    { from: /\[([^[\]]*),?\s*user\.email([^[\]]*)\]/g, to: '[$1, session?.email$2]' },
    { from: /\[user\]/g, to: '[session]' },
    { from: /\[user\.uid\]/g, to: '[session?.uid]' },
    { from: /\[user\.email\]/g, to: '[session?.email]' },
    // Fix malformed dependencies
    { from: /\[\s*,\s*session/g, to: '[session' },
    { from: /\[([^,\]]+),\s*,\s*session/g, to: '[$1, session' }
  ];
  
  dependencyReplacements.forEach(replacement => {
    const newContent = content.replace(replacement.from, replacement.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Fixed useEffect dependency`);
    }
  });

  // 5. Fix duplicate imports first
  const duplicateImportFixes = [
    // Remove duplicate useCurrentSession imports
    {
      from: /(import\s*{\s*[^}]*useCurrentSession[^}]*}\s*from\s*['"][^'"]*CurrentSessionProvider['"];?\s*\n)([\s\S]*?)(import\s*{\s*[^}]*useCurrentSession[^}]*}\s*from\s*['"][^'"]*CurrentSessionProvider['"];?\s*)/g,
      to: '$1$2'
    },
    // Remove duplicate useNotifications imports
    {
      from: /(import\s*{\s*[^}]*useNotifications[^}]*}\s*from\s*['"][^'"]*NotificationProvider['"];?\s*\n)([\s\S]*?)(import\s*{\s*[^}]*useNotifications[^}]*}\s*from\s*['"][^'"]*NotificationProvider['"];?\s*)/g,
      to: '$1$2'
    }
  ];

  duplicateImportFixes.forEach(fix => {
    const newContent = content.replace(fix.from, fix.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Fixed duplicate import`);
    }
  });

  // 6. Fix specific syntax errors and edge cases
  const syntaxFixes = [
    // Fix comma issues in object properties
    { from: /,\s*sessionname:\s*displayUsername/g, to: ', username: displayUsername' },
    { from: /,\s*sessionname:/g, to: ', username:' },
    // Fix malformed property access
    { from: /profile\.\s*,\s*sessionname/g, to: 'profile.username' },
    { from: /profile\.\s*,\s*username/g, to: 'profile.username' },
    { from: /\]\s*,\s*profile\.\s*,\s*/g, to: '], profile.' },
    // Fix loading variable names
    { from: /loading:\s*authLoading\s*}\s*=\s*useCurrentSession/g, to: 'isLoading: authLoading } = useCurrentSession' },
    { from: /loading\s*}\s*=\s*useCurrentSession/g, to: 'isLoading } = useCurrentSession' },
    // Fix incorrect import paths
    { from: /from\s*'\.\/providers\/CurrentSessionProvider'/g, to: "from './providers/CurrentSessionProvider'" },
    { from: /from\s*'\.\.\/providers\/CurrentSessionProvider'/g, to: "from '../providers/CurrentSessionProvider'" },
    { from: /from\s*'\.\.\/providers\/NotificationProvider'/g, to: "from '../../providers/NotificationProvider'" },
    { from: /from\s*'\.\/providers\/NotificationProvider'/g, to: "from '../providers/NotificationProvider'" }
  ];

  syntaxFixes.forEach(fix => {
    const newContent = content.replace(fix.from, fix.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Fixed syntax error`);
    }
  });

  // 7. Final cleanup pass - catch any remaining issues
  const finalCleanup = [
    // Fix any remaining malformed useEffect dependencies
    { from: /\[\s*([^,\]]+)\s*,\s*,\s*session/g, to: '[$1, session' },
    { from: /\[\s*,\s*session/g, to: '[session' },
    // Fix malformed property access patterns
    { from: /activity\.\s*,\s*sessionId/g, to: 'activity.userId' },
    { from: /session\?\.\s*,\s*sessionname/g, to: 'session?.username' },
    { from: /\.\s*,\s*sessionname/g, to: '.username' },
    { from: /\.\s*,\s*session/g, to: '.session' },
    // Fix any remaining user references that might have been missed
    { from: /\buser\s*\?\s*user\./g, to: 'session?.' },
    { from: /\(\s*user\s*\?\s*user\./g, to: '(session?.' },
    // Fix any remaining import issues
    { from: /import\s*{\s*useAuth\s*}/g, to: 'import { useCurrentSession }' },
    // Clean up any remaining globalStore references
    { from: /['"][^'"]*store\/globalStore['"]/g, to: "'../../providers/CurrentSessionProvider'" }
  ];

  finalCleanup.forEach(cleanup => {
    const newContent = content.replace(cleanup.from, cleanup.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Applied final cleanup`);
    }
  });

  if (hasChanges) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Successfully updated ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  No changes needed for ${filePath}`);
    return false;
  }
}

function main() {
  console.log('🔍 Finding all files with globalStore imports...\n');
  
  const globalStoreFiles = findAllGlobalStoreFiles();
  
  console.log(`Found ${globalStoreFiles.length} files with globalStore imports:`);
  globalStoreFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');
  
  if (globalStoreFiles.length === 0) {
    console.log('✅ No files found with globalStore imports!');
    return;
  }
  
  console.log('🚀 Starting comprehensive migration...\n');
  
  let totalFixed = 0;
  
  globalStoreFiles.forEach(file => {
    if (fixGlobalStoreFile(file)) {
      totalFixed++;
    }
    console.log('');
  });
  
  console.log(`📊 Migration Summary:`);
  console.log(`   Files found: ${globalStoreFiles.length}`);
  console.log(`   Files updated: ${totalFixed}`);
  console.log(`   Files unchanged: ${globalStoreFiles.length - totalFixed}`);
  
  if (totalFixed > 0) {
    console.log('\n✅ Migration completed! Run npm run build to verify fixes.');
  } else {
    console.log('\n✅ All files already up to date!');
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { fixGlobalStoreFile, findAllGlobalStoreFiles };
