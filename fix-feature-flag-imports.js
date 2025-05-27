#!/usr/bin/env node

// Script to fix feature flag import paths
const fs = require('fs');
const path = require('path');

// Files that need to be fixed
const filesToFix = [
  'app/components/SubscriptionsTable.js',
  'app/admin/features/[id]/page.tsx',
  'app/components/PageMetadata.js',
  'app/components/PledgeBarModal.js',
  'app/account/page.tsx',
  'app/admin/setup-features/page.tsx',
  'app/components/PayoutsTable.js'
];

function fixImports() {
  console.log('🔧 Fixing feature flag import paths...');
  
  filesToFix.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace .ts extension imports
        const oldImport = "from '../utils/feature-flags.ts'";
        const newImport = "from '../utils/feature-flags'";
        
        if (content.includes(oldImport)) {
          content = content.replace(oldImport, newImport);
          fs.writeFileSync(filePath, content);
          console.log(`✅ Fixed ${filePath}`);
        } else {
          console.log(`⚠️  ${filePath} - no .ts import found`);
        }
      } else {
        console.log(`❌ ${filePath} - file not found`);
      }
    } catch (error) {
      console.error(`❌ Error fixing ${filePath}:`, error.message);
    }
  });
  
  console.log('🏁 Import fixing completed');
}

fixImports();
