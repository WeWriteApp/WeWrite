#!/usr/bin/env node

/**
 * EMERGENCY FIX SCRIPT - Fix all remaining session management issues immediately
 */

import fs from 'fs';
import path from 'path';

const EMERGENCY_FIXES = [
  // Remove deleted component imports
  {
    file: 'app/layout.tsx',
    fixes: [
      { from: /import SessionZustandBridge from.*?;?\s*$/gm, to: '// SessionZustandBridge removed - functionality integrated into hybrid session system' },
      { from: /<SessionZustandBridge\s*\/?>/, to: '{/* SessionZustandBridge removed */}' }
    ]
  },
  
  // Fix syntax errors in useRecentActivity.js
  {
    file: 'app/hooks/useRecentActivity.js',
    fixes: [
      { from: /activity\.\s*,\s*sessionId/g, to: 'activity.userId' },
      { from: /\.\s*,\s*sessionId/g, to: '.userId' }
    ]
  },
  
  // Fix syntax errors in PWAProvider.tsx
  {
    file: 'app/providers/PWAProvider.tsx',
    fixes: [
      { from: /session\?\.\s*,\s*sessionname/g, to: 'session?.username' },
      { from: /\.\s*,\s*sessionname/g, to: '.username' }
    ]
  },
  
  // Remove PaymentFeatureGuard imports (deleted component)
  {
    file: 'app/settings/subscription/manage/page.tsx',
    fixes: [
      { from: /import.*?PaymentFeatureGuard.*?;?\s*$/gm, to: '// PaymentFeatureGuard removed' },
      { from: /<PaymentFeatureGuard[^>]*>/, to: '{/* PaymentFeatureGuard removed - feature flags handled elsewhere */}' },
      { from: /<\/PaymentFeatureGuard>/, to: '' }
    ]
  },
  
  {
    file: 'app/settings/subscription/page.tsx',
    fixes: [
      { from: /import.*?PaymentFeatureGuard.*?;?\s*$/gm, to: '// PaymentFeatureGuard removed' },
      { from: /<PaymentFeatureGuard[^>]*>/, to: '{/* PaymentFeatureGuard removed - feature flags handled elsewhere */}' },
      { from: /<\/PaymentFeatureGuard>/, to: '' }
    ]
  }
];

function applyEmergencyFix(filePath, fixes) {
  console.log(`🚨 EMERGENCY FIX: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;

  fixes.forEach((fix, index) => {
    const newContent = content.replace(fix.from, fix.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Applied fix ${index + 1}`);
    }
  });

  if (hasChanges) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ FIXED: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  No changes needed: ${filePath}`);
    return false;
  }
}

function main() {
  console.log('🚨 EMERGENCY SESSION MANAGEMENT FIX - APPLYING ALL FIXES NOW\n');
  
  let totalFixed = 0;
  
  EMERGENCY_FIXES.forEach(({ file, fixes }) => {
    if (applyEmergencyFix(file, fixes)) {
      totalFixed++;
    }
    console.log('');
  });
  
  console.log(`📊 EMERGENCY FIX SUMMARY:`);
  console.log(`   Files processed: ${EMERGENCY_FIXES.length}`);
  console.log(`   Files fixed: ${totalFixed}`);
  
  console.log('\n🚀 RUNNING BUILD TEST...');
}

// Run immediately
main();
