#!/usr/bin/env node
/**
 * Icon Migration Script
 * Migrates Lucide React icons to the new Icon component
 */

const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', 'app');

// Size mappings from Tailwind classes to pixel values
const SIZE_MAP = {
  'h-3 w-3': 12, 'w-3 h-3': 12,
  'h-4 w-4': 16, 'w-4 h-4': 16,
  'h-5 w-5': 20, 'w-5 h-5': 20,
  'h-6 w-6': 24, 'w-6 h-6': 24,
  'h-7 w-7': 28, 'w-7 h-7': 28,
  'h-8 w-8': 32, 'w-8 h-8': 32,
  'h-10 w-10': 40, 'w-10 h-10': 40,
  'h-12 w-12': 48, 'w-12 h-12': 48,
  'h-16 w-16': 64, 'w-16 h-16': 64,
  'size-3': 12, 'size-4': 16, 'size-5': 20, 'size-6': 24, 'size-8': 32,
};

// Find all TSX files with lucide-react imports
function findFilesToMigrate() {
  const files = [];

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walkDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if ((content.includes("from 'lucide-react'") || content.includes('from "lucide-react"')) && !fullPath.includes('Icon.tsx')) {
          files.push(fullPath);
        }
      }
    }
  }

  walkDir(APP_DIR);
  return files;
}

// Extract icon names from import statement
function extractIconNames(importLine) {
  const match = importLine.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim()).filter(s => s && !s.includes(' as '));
}

// Convert a file
function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Find lucide-react import
  const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?\n?/);
  if (!importMatch) return { changed: false };

  const iconNames = extractIconNames(importMatch[0]);
  if (iconNames.length === 0) return { changed: false };

  // Check if Icon import already exists
  const hasIconImport = content.includes("from '@/components/ui/Icon'") ||
                        content.includes('from "@/components/ui/Icon"');

  // Replace each icon usage
  let replacements = 0;
  for (const iconName of iconNames) {
    // Pattern 1: <IconName className="h-X w-X other-classes" />
    const selfClosingRegex = new RegExp(
      `<${iconName}\\s+className=["']([^"']*?)["']\\s*/>`,
      'g'
    );

    content = content.replace(selfClosingRegex, (match, classNames) => {
      let size = 24; // default
      let remainingClasses = classNames;

      // Extract size from className
      for (const [sizeClass, pixels] of Object.entries(SIZE_MAP)) {
        if (classNames.includes(sizeClass)) {
          size = pixels;
          remainingClasses = remainingClasses.replace(sizeClass, '').trim();
          break;
        }
      }

      // Clean up multiple spaces
      remainingClasses = remainingClasses.replace(/\s+/g, ' ').trim();

      replacements++;
      if (remainingClasses) {
        return `<Icon name="${iconName}" size={${size}} className="${remainingClasses}" />`;
      }
      return `<Icon name="${iconName}" size={${size}} />`;
    });

    // Pattern 2: <IconName className="..." /> (with potential newlines)
    const multilineRegex = new RegExp(
      `<${iconName}\\s*\\n?\\s*className=["']([^"']*?)["']\\s*\\n?\\s*/>`,
      'g'
    );

    content = content.replace(multilineRegex, (match, classNames) => {
      let size = 24;
      let remainingClasses = classNames;

      for (const [sizeClass, pixels] of Object.entries(SIZE_MAP)) {
        if (classNames.includes(sizeClass)) {
          size = pixels;
          remainingClasses = remainingClasses.replace(sizeClass, '').trim();
          break;
        }
      }

      remainingClasses = remainingClasses.replace(/\s+/g, ' ').trim();
      replacements++;

      if (remainingClasses) {
        return `<Icon name="${iconName}" size={${size}} className="${remainingClasses}" />`;
      }
      return `<Icon name="${iconName}" size={${size}} />`;
    });

    // Pattern 3: <IconName /> (no className)
    const bareRegex = new RegExp(`<${iconName}\\s*/>`, 'g');
    content = content.replace(bareRegex, () => {
      replacements++;
      return `<Icon name="${iconName}" size={24} />`;
    });

    // Pattern 4: <IconName size={X} />
    const sizeRegex = new RegExp(`<${iconName}\\s+size=\\{(\\d+)\\}\\s*/>`, 'g');
    content = content.replace(sizeRegex, (match, size) => {
      replacements++;
      return `<Icon name="${iconName}" size={${size}} />`;
    });

    // Pattern 5: <IconName size={X} className="..." />
    const sizeClassRegex = new RegExp(
      `<${iconName}\\s+size=\\{(\\d+)\\}\\s+className=["']([^"']*?)["']\\s*/>`,
      'g'
    );
    content = content.replace(sizeClassRegex, (match, size, classNames) => {
      replacements++;
      if (classNames.trim()) {
        return `<Icon name="${iconName}" size={${size}} className="${classNames}" />`;
      }
      return `<Icon name="${iconName}" size={${size}} />`;
    });
  }

  // Only proceed if we made replacements
  if (replacements === 0) {
    return { changed: false, reason: 'no icon usages found' };
  }

  // Remove lucide-react import
  content = content.replace(/import\s*\{[^}]+\}\s*from\s*['"]lucide-react['"];?\n?/, '');

  // Add Icon import if not present
  if (!hasIconImport) {
    // Find the first import statement to add after
    const firstImportMatch = content.match(/^(import .+\n)/m);
    if (firstImportMatch) {
      const insertPos = content.indexOf(firstImportMatch[0]) + firstImportMatch[0].length;
      content = content.slice(0, insertPos) +
                "import { Icon } from '@/components/ui/Icon';\n" +
                content.slice(insertPos);
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { changed: true, replacements, icons: iconNames };
  }

  return { changed: false };
}

// Main
console.log('🔍 Finding files to migrate...\n');
const files = findFilesToMigrate();
console.log(`Found ${files.length} files with lucide-react imports\n`);

let migrated = 0;
let failed = 0;
const errors = [];

for (const file of files) {
  const relativePath = path.relative(APP_DIR, file);
  try {
    const result = migrateFile(file);
    if (result.changed) {
      console.log(`✅ ${relativePath} (${result.replacements} icons: ${result.icons.join(', ')})`);
      migrated++;
    } else {
      // console.log(`⏭️  ${relativePath} - ${result.reason || 'skipped'}`);
    }
  } catch (err) {
    console.log(`❌ ${relativePath} - ${err.message}`);
    errors.push({ file: relativePath, error: err.message });
    failed++;
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Migration complete!`);
console.log(`✅ Migrated: ${migrated} files`);
console.log(`⏭️  Skipped: ${files.length - migrated - failed} files`);
console.log(`❌ Failed: ${failed} files`);

if (errors.length > 0) {
  console.log(`\nErrors:`);
  errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
}
