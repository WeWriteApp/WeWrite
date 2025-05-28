#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Starting import statement updates...');

// Define the import mappings based on the reorganization
const importMappings: Record<string, string> = {
  // Components that were moved
  './AccentColorSelector': './utils/AccentColorSelector',
  '../components/AccentColorSelector': '../components/utils/AccentColorSelector',
  './components/AccentColorSelector': './components/utils/AccentColorSelector',
  
  './AdminFeaturesWrapper': './utils/AdminFeaturesWrapper',
  '../components/AdminFeaturesWrapper': '../components/utils/AdminFeaturesWrapper',
  './components/AdminFeaturesWrapper': './components/utils/AdminFeaturesWrapper',
  
  './AdminPanel': './utils/AdminPanel',
  '../components/AdminPanel': '../components/utils/AdminPanel',
  './components/AdminPanel': './components/utils/AdminPanel',
  
  './AdminSection': './utils/AdminSection',
  '../components/AdminSection': '../components/utils/AdminSection',
  './components/AdminSection': './components/utils/AdminSection',
  
  './Drawer': './utils/Drawer',
  '../components/Drawer': '../components/utils/Drawer',
  './components/Drawer': './components/utils/Drawer',
  
  './EmptyContentState': './utils/EmptyContentState',
  '../components/EmptyContentState': '../components/utils/EmptyContentState',
  './components/EmptyContentState': './components/utils/EmptyContentState',
  
  './FollowedPages': './pages/FollowedPages',
  '../components/FollowedPages': '../components/pages/FollowedPages',
  './components/FollowedPages': './components/pages/FollowedPages',
  
  './FollowingList': './utils/FollowingList',
  '../components/FollowingList': '../components/utils/FollowingList',
  './components/FollowingList': './components/utils/FollowingList',
  
  './FollowingTabContent': './utils/FollowingTabContent',
  '../components/FollowingTabContent': '../components/utils/FollowingTabContent',
  './components/FollowingTabContent': './components/utils/FollowingTabContent',
  
  './PageMetadataMap': './pages/PageMetadataMap',
  '../components/PageMetadataMap': '../components/pages/PageMetadataMap',
  './components/PageMetadataMap': './components/pages/PageMetadataMap',
  
  './RandomPagesTable': './pages/RandomPagesTable',
  '../components/RandomPagesTable': '../components/pages/RandomPagesTable',
  './components/RandomPagesTable': './components/pages/RandomPagesTable',
  
  './UserBioTab': './utils/UserBioTab',
  '../components/UserBioTab': '../components/utils/UserBioTab',
  './components/UserBioTab': './components/utils/UserBioTab',
  
  './UserProfileTabs': './utils/UserProfileTabs',
  '../components/UserProfileTabs': '../components/utils/UserProfileTabs',
  './components/UserProfileTabs': './components/utils/UserProfileTabs',
  
  './auth-layout': './layout/auth-layout',
  '../components/auth-layout': '../components/layout/auth-layout',
  './components/auth-layout': './components/layout/auth-layout',
  
  './icons': './utils/icons',
  '../components/icons': '../components/utils/icons',
  './components/icons': './components/utils/icons',
  
  './modern-auth-layout': './layout/modern-auth-layout',
  '../components/modern-auth-layout': '../components/layout/modern-auth-layout',
  './components/modern-auth-layout': './components/layout/modern-auth-layout',
};

// Get all files that might contain imports
function getAllFiles(): string[] {
  const files: string[] = [];
  
  function scanDirectory(dir: string): void {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and .next directories
        if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(item)) {
          scanDirectory(fullPath);
        }
      } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.jsx') || item.endsWith('.ts') || item.endsWith('.tsx'))) {
        // Exclude certain file types
        if (!item.includes('.test.') && !item.includes('.spec.') && !item.includes('.d.ts')) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scanDirectory('app');
  return files;
}

// Update imports in a single file
function updateImportsInFile(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let updatedContent = content;
    let hasChanges = false;
    
    // Update import statements
    for (const [oldImport, newImport] of Object.entries(importMappings)) {
      // Handle different import patterns
      const patterns = [
        // import Component from 'path'
        new RegExp(`import\\s+([^\\s]+)\\s+from\\s+['"]${oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
        // import { Component } from 'path'
        new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+['"]${oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
        // import * as Component from 'path'
        new RegExp(`import\\s+\\*\\s+as\\s+([^\\s]+)\\s+from\\s+['"]${oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
        // const Component = require('path')
        new RegExp(`require\\(['"]${oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`, 'g'),
        // dynamic import
        new RegExp(`import\\(['"]${oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`, 'g'),
      ];
      
      patterns.forEach((pattern, index) => {
        if (pattern.test(updatedContent)) {
          if (index === 0) {
            updatedContent = updatedContent.replace(pattern, `import $1 from '${newImport}'`);
          } else if (index === 1) {
            updatedContent = updatedContent.replace(pattern, `import {$1} from '${newImport}'`);
          } else if (index === 2) {
            updatedContent = updatedContent.replace(pattern, `import * as $1 from '${newImport}'`);
          } else if (index === 3) {
            updatedContent = updatedContent.replace(pattern, `require('${newImport}')`);
          } else if (index === 4) {
            updatedContent = updatedContent.replace(pattern, `import('${newImport}')`);
          }
          hasChanges = true;
        }
      });
    }
    
    if (hasChanges) {
      fs.writeFileSync(filePath, updatedContent);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error);
    return false;
  }
}

// Update all import statements
function updateAllImports(): void {
  console.log('\n📝 Updating import statements...');
  const allFiles = getAllFiles();
  let updatedCount = 0;
  
  for (const filePath of allFiles) {
    if (updateImportsInFile(filePath)) {
      console.log(`✅ Updated imports in: ${filePath}`);
      updatedCount++;
    }
  }
  
  console.log(`\n📊 Updated ${updatedCount} files out of ${allFiles.length} total files`);
}

// Main execution
function main(): void {
  try {
    updateAllImports();
    console.log('\n🎉 Import statement updates completed!');
    console.log('\n⚠️  Next steps:');
    console.log('1. Test the application for any remaining broken imports');
    console.log('2. Check for any dynamic imports that might need manual updates');
    console.log('3. Run the development server to verify everything works');
  } catch (error) {
    console.error('❌ Error during import updates:', error);
    process.exit(1);
  }
}

main();
