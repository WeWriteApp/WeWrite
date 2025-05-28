#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Starting TypeScript component reorganization...');

// Define the new directory structure
const directories: string[] = [
  'app/components/layout',
  'app/components/forms', 
  'app/components/pages',
  'app/components/features',
  'app/components/auth',
  'app/components/editor',
  'app/components/activity',
  'app/components/groups',
  'app/components/payments',
  'app/components/utils'
];

// Interface for component mapping
interface ComponentMove {
  from: string;
  to: string;
  category: string;
}

// Create directories
function createDirectories(): void {
  console.log('📁 Creating new directory structure...');
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created: ${dir}`);
    } else {
      console.log(`⏭️  Already exists: ${dir}`);
    }
  });
}

// Get all component files in the directory
function getAllComponents(): string[] {
  const components: string[] = [];
  
  function scanDirectory(dir: string): void {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip certain directories
        if (!['ui', 'daily-notes', 'landing', 'marketing', 'server', 'skeletons', 'examples', '__tests__', 'layout', 'forms', 'pages', 'features', 'auth', 'editor', 'activity', 'groups', 'payments', 'utils'].includes(item)) {
          scanDirectory(fullPath);
        }
      } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.jsx') || item.endsWith('.ts') || item.endsWith('.tsx'))) {
        // Exclude CSS files and certain patterns
        if (!item.endsWith('.css') && !item.includes('.module.') && !item.includes('.test.') && !item.includes('.spec.')) {
          components.push(fullPath);
        }
      }
    }
  }
  
  scanDirectory('app/components');
  return components;
}

// Define components to remove (duplicates and unused)
const componentsToRemove: string[] = [
  // Duplicate .js versions (keeping .tsx)
  'app/components/AccentColorSelector.js',
  'app/components/CompositionBar.js', 
  'app/components/DisabledLinkModal.js',
  'app/components/ErrorBoundary.js',
  'app/components/FollowedPages.js',
  
  // Unused/test components
  'app/components/TestReplyEditor.js',
  'app/components/ToastTester.tsx',
  'app/components/PolyfillTester.js',
  'app/components/GADebugger.js',
  'app/components/RenderTracker.js',
  'app/components/WindsurfOverlay.js',
  'app/components/ConstructionChip.js',
  
  // Legacy components
  'app/components/ThemeSwitcher.js',
  'app/components/Tooltip.tsx', // Duplicate of ui/tooltip.tsx
  'app/components/Tabs.js', // Replaced by ui/tabs.tsx
];

// Categorize components based on their functionality
function categorizeComponent(componentPath: string): string {
  const fileName = path.basename(componentPath).toLowerCase();
  const content = fs.existsSync(componentPath) ? fs.readFileSync(componentPath, 'utf8') : '';
  
  // Layout components
  if (fileName.includes('header') || fileName.includes('sidebar') || fileName.includes('footer') || fileName.includes('layout') || fileName.includes('nav')) {
    return 'layout';
  }
  
  // Form components
  if (fileName.includes('form') || fileName.includes('login') || fileName.includes('register') || fileName.includes('payment')) {
    return 'forms';
  }
  
  // Page components
  if (fileName.includes('page') || fileName.includes('singlepage') || fileName.includes('allpages') || fileName.includes('pageaction') || fileName.includes('pagemenu')) {
    return 'pages';
  }
  
  // Authentication components
  if (fileName.includes('auth') || fileName.includes('account') || fileName.includes('username') || fileName.includes('login')) {
    return 'auth';
  }
  
  // Editor components
  if (fileName.includes('editor') || fileName.includes('text') || fileName.includes('slate') || fileName.includes('reply') || fileName.includes('map')) {
    return 'editor';
  }
  
  // Activity components
  if (fileName.includes('activity') || fileName.includes('diff') || fileName.includes('history') || fileName.includes('version')) {
    return 'activity';
  }
  
  // Group components
  if (fileName.includes('group')) {
    return 'groups';
  }
  
  // Payment components
  if (fileName.includes('payment') || fileName.includes('pledge') || fileName.includes('donation') || fileName.includes('subscription') || fileName.includes('support')) {
    return 'payments';
  }
  
  // Search components
  if (fileName.includes('search') || fileName.includes('typeahead')) {
    return 'search';
  }
  
  // Feature components (dashboard, trending, etc.)
  if (fileName.includes('dashboard') || fileName.includes('trending') || fileName.includes('topuser') || fileName.includes('recent') || fileName.includes('related') || fileName.includes('similar') || fileName.includes('backlink') || fileName.includes('random')) {
    return 'features';
  }
  
  // Utility components
  if (fileName.includes('error') || fileName.includes('loader') || fileName.includes('performance') || fileName.includes('hydration') || fileName.includes('pending') || fileName.includes('feature')) {
    return 'utils';
  }
  
  // Default to utils for unclassified components
  return 'utils';
}

// Generate component moves based on categorization
function generateComponentMoves(): ComponentMove[] {
  const allComponents = getAllComponents();
  const moves: ComponentMove[] = [];
  
  for (const componentPath of allComponents) {
    // Skip components already in subdirectories or that should be removed
    if (componentPath.includes('/') && componentPath.split('/').length > 3) continue;
    if (componentsToRemove.includes(componentPath)) continue;
    
    const category = categorizeComponent(componentPath);
    const fileName = path.basename(componentPath);
    const newPath = `app/components/${category}/${fileName}`;
    
    // Only move if it's not already in the right place
    if (componentPath !== newPath) {
      moves.push({
        from: componentPath,
        to: newPath,
        category
      });
    }
  }
  
  return moves;
}

// Remove duplicate and unused components
function removeComponents(): void {
  console.log('\n🗑️  Removing duplicate and unused components...');
  componentsToRemove.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Removed: ${filePath}`);
    } else {
      console.log(`⚠️  Not found: ${filePath}`);
    }
  });
}

// Move components to new locations
function moveComponents(): void {
  console.log('\n📦 Moving components to new locations...');
  const moves = generateComponentMoves();
  
  moves.forEach(({ from, to, category }) => {
    if (fs.existsSync(from)) {
      // Ensure target directory exists
      const targetDir = path.dirname(to);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Move the file
      fs.renameSync(from, to);
      console.log(`✅ Moved: ${from} → ${to} (${category})`);
    } else {
      console.log(`⚠️  Not found: ${from}`);
    }
  });
}

// Main execution
function main(): void {
  try {
    createDirectories();
    removeComponents();
    moveComponents();
    console.log('\n🎉 TypeScript component reorganization completed!');
    console.log('\n⚠️  Next steps:');
    console.log('1. Update import statements throughout the codebase');
    console.log('2. Test the application for any broken imports');
    console.log('3. Update documentation');
  } catch (error) {
    console.error('❌ Error during reorganization:', error);
    process.exit(1);
  }
}

main();
