#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting comprehensive import path fixes...');

// Define the import mappings based on the new directory structure
const importMappings = {
  // Fix quote mismatches and syntax errors - MOST CRITICAL
  'from "../ui/button\';': 'from "../ui/button";',
  'from "../../utils/pwa-detection\';': 'from "../../utils/pwa-detection";',
  'from "../../utils/analytics-service\';': 'from "../../utils/analytics-service";',
  'from "../ui/dialog\';': 'from "../ui/dialog";',
  'from "../../utils/accessibility\';': 'from "../../utils/accessibility";',

  // Fix missing provider paths
  'from "../providers/NotificationProvider"': 'from "../../providers/NotificationProvider"',
  'from "../../providers/AuthProvider"': 'from "../providers/AuthProvider"',
  'from "../providers/AuthProvider"': 'from "../../providers/AuthProvider"',
  'from "../../utils/feature-flags"': 'from "../utils/feature-flags"',
  'from "../utils/feature-flags"': 'from "../../utils/feature-flags"',
  'from "../utils/userUtils"': 'from "../../utils/userUtils"',
  'from "../utils/linkUtils"': 'from "../../utils/linkUtils"',

  // Components that moved to utils/
  '"../../utils/AccentColorSwitcher"': '"../utils/AccentColorSwitcher"',
  '"../../utils/PillStyleToggle"': '"../utils/PillStyleToggle"',
  '"../../utils/NotificationBadge"': '"../utils/NotificationBadge"',
  '"../../utils/DisabledLinkModal"': '"../utils/DisabledLinkModal"',
  '"../../utils/PillLink"': '"../utils/PillLink"',
  '"../../utils/SimpleSparkline"': '"../utils/SimpleSparkline"',

  // Components that moved to auth/
  '"./AuthNav"': '"../auth/AuthNav"',
  '"./Sidebar"': '"../layout/Sidebar"',
  '"./NotificationDot"': '"../utils/NotificationDot"',
  '"./SupportUsModal"': '"../payments/SupportUsModal"',

  // Fix common path issues and quote mismatches
  'from "../../firebase/follows\'': 'from "../../firebase/follows"',
  'from "../../firebase/database\'': 'from "../../firebase/database"',
  'from "../ui/skeleton\'': 'from "../ui/skeleton"',
  'from "../ui/card\'': 'from "../ui/card"',
  'from "../../firebase/streaks\'': 'from "../../firebase/streaks"',
  'from "../../hooks/useConfirmation\'': 'from "../../hooks/useConfirmation"',
  'from "../../utils/browser-compatibility-fixes\'': 'from "../../utils/browser-compatibility-fixes"',
  'from "../ui/use-toast\'': 'from "../ui/use-toast"',
  'from "../ui/error-display\'': 'from "../ui/error-display"',
  'from "../../utils/feature-flags\'': 'from "../../utils/feature-flags"',

  // Fix lib path issues
  'from "../lib/utils"': 'from "../../lib/utils"',
  'from \'../lib/utils\'': 'from \'../../lib/utils\'',

  // Additional component path fixes
  'import { PillLink } from "../../utils/PillLink"': 'import { PillLink } from "../utils/PillLink"',
  'import SimpleSparkline from "../../utils/SimpleSparkline"': 'import SimpleSparkline from "../utils/SimpleSparkline"',
  'import PillLink from "../../utils/PillLink"': 'import PillLink from "../utils/PillLink"',

  // Fix missing files that should exist
  '"../../utils/ClickableByline"': '"../utils/ClickableByline"',
};

// Get all JavaScript/TypeScript files recursively
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and .next directories
      if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (file.match(/\.(js|jsx|ts|tsx)$/)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Fix imports in a single file
function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;

    // Apply all import mappings
    for (const [oldImport, newImport] of Object.entries(importMappings)) {
      if (content.includes(oldImport)) {
        content = content.replace(new RegExp(escapeRegExp(oldImport), 'g'), newImport);
        hasChanges = true;
      }
    }

    // Additional fixes for common patterns

    // Fix unterminated string constants (missing quotes)
    content = content.replace(/from "([^"]*)'$/gm, 'from "$1"');
    content = content.replace(/from '([^']*)";$/gm, "from '$1';");
    content = content.replace(/from "([^"]*)'([^;])/gm, 'from "$1"$2');
    content = content.replace(/from '([^']*)";/gm, "from '$1';");

    // Fix import paths based on file location
    if (filePath.includes('app/components/')) {
      const relativePath = path.relative('app/components', filePath);
      const depth = relativePath.split(path.sep).length - 1;

      // For files in components subdirectories, fix utils imports
      if (depth > 0) {
        // Fix utils imports - should be ../utils/ not ../../utils/
        content = content.replace(/from "\.\.\/\.\.\/utils\//g, 'from "../utils/');
        content = content.replace(/from '\.\.\/\.\.\/utils\//g, "from '../utils/");

        // Fix component imports within components directory
        content = content.replace(/from "\.\.\/\.\.\/components\/utils\//g, 'from "../utils/');
        content = content.replace(/from '\.\.\/\.\.\/components\/utils\//g, "from '../utils/");
      }

      // Fix lib imports for components (should always be ../../lib/utils)
      content = content.replace(/from "\.\.\/lib\/utils"/g, 'from "../../lib/utils"');
      content = content.replace(/from '\.\.\/lib\/utils'/g, "from '../../lib/utils'");
    }

    // Fix specific component import patterns
    content = content.replace(/import\s+(\{[^}]+\}|\w+)\s+from\s+"\.\.\/\.\.\/utils\/([^"]+)"/g,
      (match, importName, moduleName) => {
        if (filePath.includes('app/components/') && !filePath.includes('app/components/utils/')) {
          return `import ${importName} from "../utils/${moduleName}"`;
        }
        return match;
      });

    // Fix quote consistency issues
    content = content.replace(/import\s+([^;]+)\s+from\s+"([^"]+)';/g, 'import $1 from "$2";');
    content = content.replace(/import\s+([^;]+)\s+from\s+'([^']+)";/g, "import $1 from '$2';");

    // Fix specific component imports based on file location
    const relativePath = path.relative('./app', filePath);

    // Fix imports for files in layout directory
    if (relativePath.includes('components/layout/')) {
      content = content.replace(/from "\.\/AuthNav"/g, 'from "../auth/AuthNav"');
      content = content.replace(/from "\.\/SupportUsModal"/g, 'from "../payments/SupportUsModal"');
    }

    // Fix imports for files in auth directory
    if (relativePath.includes('components/auth/')) {
      content = content.replace(/from "\.\/Sidebar"/g, 'from "../layout/Sidebar"');
      content = content.replace(/from "\.\/NotificationDot"/g, 'from "../utils/NotificationDot"');
    }

    // Fix missing file extensions and common typos
    content = content.replace(/import DisabledLinkModal from "([^"]*DisabledLinkModal)';/g, 'import DisabledLinkModal from "$1";');

    // Fix PillLink imports specifically
    if (content.includes('PillLink')) {
      content = content.replace(/from "\.\.\/\.\.\/utils\/PillLink"/g, 'from "../utils/PillLink"');
      content = content.replace(/from '\.\.\/\.\.\/utils\/PillLink'/g, "from '../utils/PillLink'");
    }

    if (hasChanges) {
      fs.writeFileSync(filePath, content);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Main execution
function main() {
  const startTime = Date.now();

  // Get all files in the app directory
  const allFiles = getAllFiles('./app');

  console.log(`📁 Found ${allFiles.length} files to process`);

  let fixedFiles = 0;
  let totalFiles = 0;

  allFiles.forEach(filePath => {
    totalFiles++;
    const wasFixed = fixImportsInFile(filePath);

    if (wasFixed) {
      fixedFiles++;
      console.log(`✅ Fixed: ${filePath}`);
    }
  });

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n📊 Summary:');
  console.log(`   Total files processed: ${totalFiles}`);
  console.log(`   Files with fixes: ${fixedFiles}`);
  console.log(`   Duration: ${duration}s`);
  console.log('\n🏁 Import fixing completed!');

  if (fixedFiles > 0) {
    console.log('\n💡 Next steps:');
    console.log('   1. Run `npm run build` to check for remaining issues');
    console.log('   2. Review the changes with `git diff`');
    console.log('   3. Test the application to ensure everything works');
  }
}

main();
