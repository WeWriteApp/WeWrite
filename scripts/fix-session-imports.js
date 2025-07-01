#!/usr/bin/env node

/**
 * Batch fix script to migrate all files from old globalStore to hybrid session management
 * Based on our session management architecture documentation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Files that still need fixing based on build errors
const FILES_TO_FIX = [
  'app/admin/payments/page.tsx',
  'app/components/utils/NotificationItem.tsx',
  'app/components/utils/NotificationDot.tsx',
  'app/components/utils/NotificationBadge.tsx',
  'app/contexts/SyncQueueContext.tsx',
  'app/hooks/useRecentActivity.js',
  'app/hooks/useStaticRecentActivity.js',
  'app/leaderboard/page.jsx',
  'app/hooks/useRoutePreloader.tsx',
  'app/components/pages/PageTabs.tsx',
  'app/components/pages/OptimizedSingleProfileView.tsx',
  'app/components/landing/SimpleActivityCarousel.tsx',
  'app/admin/setup-features/page.tsx',
  'app/admin/tools/page.tsx',
  'app/components/activity/ActivityCard.tsx',
  'app/components/admin/FeatureDetailPage.tsx',
  'app/components/admin/FeatureFlagCard.tsx'
];

function getCorrectImportPath(filePath, targetPath) {
  const fileDir = path.dirname(filePath);

  // Calculate relative path from file to app directory
  const pathParts = fileDir.split('/');
  const appIndex = pathParts.indexOf('app');

  if (appIndex === -1) {
    console.error(`Could not find 'app' directory in path: ${filePath}`);
    return `../${targetPath}`;
  }

  // Count levels from current file to app directory
  const levelsUp = pathParts.length - appIndex - 1;
  const prefix = levelsUp === 0 ? './' : '../'.repeat(levelsUp);

  return `${prefix}${targetPath}`;
}

// More comprehensive import patterns
const IMPORT_PATTERNS = [
  // Single useAuth import
  {
    pattern: /import\s*{\s*useAuth\s*}\s*from\s*['"][^'"]*store\/globalStore['"];?\s*$/gm,
    replacement: 'providers/CurrentSessionProvider',
    importName: 'useCurrentSession'
  },
  // useAuth with other imports
  {
    pattern: /import\s*{\s*useAuth,\s*([^}]+)\s*}\s*from\s*['"][^'"]*store\/globalStore['"];?\s*$/gm,
    replacement: 'providers/CurrentSessionProvider',
    importName: 'useCurrentSession',
    keepOtherImports: true
  },
  // useNotifications only
  {
    pattern: /import\s*{\s*useNotifications\s*}\s*from\s*['"][^'"]*store\/globalStore['"];?\s*$/gm,
    replacement: 'providers/NotificationProvider',
    importName: 'useNotifications'
  },
  // useTheme only
  {
    pattern: /import\s*{\s*useTheme\s*}\s*from\s*['"][^'"]*store\/globalStore['"];?\s*$/gm,
    replacement: null, // Will be commented out
    importName: null
  }
];

// Hook usage replacements
const HOOK_REPLACEMENTS = [
  {
    from: /const\s*{\s*user\s*}\s*=\s*useAuth\(\);?/g,
    to: "const { session } = useCurrentSession();"
  },
  {
    from: /const\s*{\s*user,\s*isAuthenticated\s*}\s*=\s*useAuth\(\);?/g,
    to: "const { session, isAuthenticated } = useCurrentSession();"
  },
  {
    from: /const\s*{\s*user,\s*loading:\s*authLoading\s*}\s*=\s*useAuth\(\);?/g,
    to: "const { session, isLoading: authLoading } = useCurrentSession();"
  },
  {
    from: /const\s*{\s*user,\s*loading\s*}\s*=\s*useAuth\(\);?/g,
    to: "const { session, isLoading } = useCurrentSession();"
  }
];

// Variable reference replacements
const VARIABLE_REPLACEMENTS = [
  {
    from: /\buser\.uid\b/g,
    to: "session.uid"
  },
  {
    from: /\buser\.email\b/g,
    to: "session.email"
  },
  {
    from: /\buser\.displayName\b/g,
    to: "session.displayName"
  },
  {
    from: /\buser\.photoURL\b/g,
    to: "session.photoURL"
  },
  {
    from: /\buser\.emailVerified\b/g,
    to: "session.emailVerified"
  },
  {
    from: /\buser\?\./g,
    to: "session?."
  },
  {
    from: /!\s*user\b/g,
    to: "!session"
  },
  {
    from: /\buser\s*&&/g,
    to: "session &&"
  },
  {
    from: /&&\s*user\b/g,
    to: "&& session"
  }
];

// useEffect dependency replacements
const DEPENDENCY_REPLACEMENTS = [
  {
    from: /\[([^[\]]*),?\s*user([^[\]]*)\]/g,
    to: "[$1, session$2]"
  },
  {
    from: /\[([^[\]]*),?\s*user\.uid([^[\]]*)\]/g,
    to: "[$1, session?.uid$2]"
  },
  {
    from: /\[user\]/g,
    to: "[session]"
  },
  {
    from: /\[user\.uid\]/g,
    to: "[session?.uid]"
  }
];

function fixFile(filePath) {
  console.log(`🔧 Fixing ${filePath}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;

  // Apply import replacements with correct relative paths
  IMPORT_PATTERNS.forEach(pattern => {
    if (pattern.replacement === null) {
      // Comment out the import
      const newContent = content.replace(pattern.pattern, '// Theme functionality moved to session store');
      if (newContent !== content) {
        content = newContent;
        hasChanges = true;
        console.log(`  ✅ Commented out theme import in ${filePath}`);
      }
    } else {
      // Replace with correct relative path
      const correctPath = getCorrectImportPath(filePath, pattern.replacement);
      const newImport = `import { ${pattern.importName} } from '${correctPath}';`;
      const newContent = content.replace(pattern.pattern, newImport);
      if (newContent !== content) {
        content = newContent;
        hasChanges = true;
        console.log(`  ✅ Fixed import in ${filePath} -> ${correctPath}`);
      }
    }
  });

  // Apply hook usage replacements
  HOOK_REPLACEMENTS.forEach(replacement => {
    const newContent = content.replace(replacement.from, replacement.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Fixed hook usage in ${filePath}`);
    }
  });

  // Apply variable reference replacements
  VARIABLE_REPLACEMENTS.forEach(replacement => {
    const newContent = content.replace(replacement.from, replacement.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Fixed variable references in ${filePath}`);
    }
  });

  // Apply dependency replacements
  DEPENDENCY_REPLACEMENTS.forEach(replacement => {
    const newContent = content.replace(replacement.from, replacement.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Fixed useEffect dependencies in ${filePath}`);
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
  console.log('🚀 Starting batch session management migration...\n');
  
  let totalFixed = 0;
  let totalFiles = FILES_TO_FIX.length;

  FILES_TO_FIX.forEach(file => {
    if (fixFile(file)) {
      totalFixed++;
    }
    console.log(''); // Empty line for readability
  });

  console.log(`\n📊 Migration Summary:`);
  console.log(`   Files processed: ${totalFiles}`);
  console.log(`   Files updated: ${totalFixed}`);
  console.log(`   Files unchanged: ${totalFiles - totalFixed}`);
  
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

export { fixFile, FILES_TO_FIX };
