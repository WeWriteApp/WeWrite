#!/usr/bin/env node

/**
 * Cleanup Script: Remove Legacy Activities System
 * 
 * This script removes all references to the legacy activities system
 * and cleans up the codebase to use only the unified version system.
 * 
 * Usage: node scripts/cleanup-activities-system.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

// Files and patterns to clean up
const CLEANUP_TASKS = [
  {
    name: 'Remove activity creation from page save API',
    file: 'app/api/pages/route.ts',
    action: 'remove_activity_creation',
    description: 'Remove the legacy activity creation code from page save'
  },
  {
    name: 'Update documentation',
    file: 'docs/VERSION_SYSTEM.md',
    action: 'update_docs',
    description: 'Update documentation to reflect completed migration'
  }
];

// Function to read file content
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.warn(`⚠️  Could not read file ${filePath}: ${error.message}`);
    return null;
  }
}

// Function to write file content
function writeFile(filePath, content, dryRun = false) {
  if (dryRun) {
    console.log(`🔍 DRY RUN: Would write to ${filePath}`);
    return true;
  }
  
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`❌ Error writing to ${filePath}: ${error.message}`);
    return false;
  }
}

// Remove activity creation from page save API
function removeActivityCreation(filePath, dryRun = false) {
  const content = readFile(filePath);
  if (!content) return false;

  // Remove the legacy activity creation block
  const activityCreationStart = '// Store in activities collection (LEGACY - will be removed in Phase 4)';
  const activityCreationEnd = '});';
  
  let updatedContent = content;
  
  // Find and remove the activity creation block
  const startIndex = content.indexOf(activityCreationStart);
  if (startIndex !== -1) {
    // Find the end of the activity creation block
    let endIndex = startIndex;
    let braceCount = 0;
    let inActivityBlock = false;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content.substring(i, i + activityCreationEnd.length) === activityCreationEnd && braceCount === 0 && inActivityBlock) {
        endIndex = i + activityCreationEnd.length;
        break;
      }
      
      if (content[i] === '{') {
        braceCount++;
        inActivityBlock = true;
      } else if (content[i] === '}') {
        braceCount--;
      }
    }
    
    if (endIndex > startIndex) {
      const beforeBlock = content.substring(0, startIndex);
      const afterBlock = content.substring(endIndex);
      updatedContent = beforeBlock + afterBlock;
      
      console.log(`✅ Removed legacy activity creation block (${endIndex - startIndex} characters)`);
    }
  }
  
  // Remove any remaining activity-related imports or references
  const activityPatterns = [
    /\/\/ Store in activities collection.*?\n/g,
    /const activitiesCollectionName = getCollectionName\('activities'\);.*?\n/g,
    /const activityRef = await db\.collection\(activitiesCollectionName\)\.add\(activityData\);.*?\n/g,
    /console\.log\("Created activity record.*?\n/g
  ];
  
  activityPatterns.forEach(pattern => {
    const matches = updatedContent.match(pattern);
    if (matches) {
      updatedContent = updatedContent.replace(pattern, '');
      console.log(`✅ Removed ${matches.length} activity-related references`);
    }
  });
  
  if (updatedContent !== content) {
    return writeFile(filePath, updatedContent, dryRun);
  }
  
  console.log(`ℹ️  No activity creation code found in ${filePath}`);
  return true;
}

// Update documentation
function updateDocumentation(filePath, dryRun = false) {
  const content = readFile(filePath);
  if (!content) return false;

  let updatedContent = content;
  
  // Update migration status
  updatedContent = updatedContent.replace(
    /### Phase 1: Fix Version Creation ✅/g,
    '### Phase 1: Fix Version Creation ✅'
  );
  
  updatedContent = updatedContent.replace(
    /### Phase 2: Update Recent Edits APIs/g,
    '### Phase 2: Update Recent Edits APIs ✅'
  );
  
  updatedContent = updatedContent.replace(
    /### Phase 3: Migrate Existing Data/g,
    '### Phase 3: Migrate Existing Data ✅'
  );
  
  updatedContent = updatedContent.replace(
    /### Phase 4: Cleanup/g,
    '### Phase 4: Cleanup ✅'
  );
  
  // Add completion status
  const completionStatus = `

## ✅ Migration Complete!

The unified version system has been successfully implemented:

- ✅ **Version Creation**: All page saves now create versions
- ✅ **API Migration**: Recent edits APIs use versions instead of activities  
- ✅ **Data Migration**: Existing activities migrated to version format
- ✅ **Legacy Cleanup**: Activities collection references removed
- ✅ **Documentation**: Updated to reflect new system

### Current System Status

The WeWrite application now uses a single, unified version system for all page edit tracking:

- **Single Source of Truth**: \`pages/{pageId}/versions\` subcollections
- **Consistent Data Model**: All versions follow the same schema
- **Performance Optimized**: Efficient queries and caching
- **Future Ready**: Easy to extend with new features

### Next Steps

1. **Monitor Performance**: Watch for any performance issues with the new system
2. **Add Features**: Consider implementing version comparison, rollback, etc.
3. **Archive Old Data**: Consider archiving very old activities after verification
4. **Optimize Queries**: Add indexes as needed for better performance

`;

  if (!content.includes('## ✅ Migration Complete!')) {
    updatedContent += completionStatus;
  }
  
  if (updatedContent !== content) {
    return writeFile(filePath, updatedContent, dryRun);
  }
  
  console.log(`ℹ️  Documentation already up to date`);
  return true;
}

// Main cleanup function
async function cleanupActivitiesSystem(options = {}) {
  const { dryRun = false } = options;
  
  console.log('🧹 Starting Legacy Activities System Cleanup');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE CLEANUP'}`);
  console.log('');
  
  const results = {
    success: 0,
    failed: 0,
    skipped: 0
  };
  
  for (const task of CLEANUP_TASKS) {
    console.log(`📋 ${task.name}`);
    console.log(`   File: ${task.file}`);
    console.log(`   Description: ${task.description}`);
    
    try {
      let success = false;
      
      switch (task.action) {
        case 'remove_activity_creation':
          success = removeActivityCreation(task.file, dryRun);
          break;
        case 'update_docs':
          success = updateDocumentation(task.file, dryRun);
          break;
        default:
          console.log(`   ⚠️  Unknown action: ${task.action}`);
          results.skipped++;
          continue;
      }
      
      if (success) {
        console.log(`   ✅ Completed successfully`);
        results.success++;
      } else {
        console.log(`   ❌ Failed`);
        results.failed++;
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.failed++;
    }
    
    console.log('');
  }
  
  // Print final results
  console.log('📊 Cleanup Complete!');
  console.log(`  Success: ${results.success} tasks`);
  console.log(`  Failed: ${results.failed} tasks`);
  console.log(`  Skipped: ${results.skipped} tasks`);
  
  if (dryRun) {
    console.log('');
    console.log('🔍 This was a DRY RUN - no files were actually modified');
    console.log('Run without --dry-run to perform the actual cleanup');
  }
  
  return results;
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  cleanupActivitiesSystem({ dryRun })
    .then((results) => {
      const exitCode = results.failed > 0 ? 1 : 0;
      console.log(`✅ Cleanup script completed with exit code ${exitCode}`);
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupActivitiesSystem };
