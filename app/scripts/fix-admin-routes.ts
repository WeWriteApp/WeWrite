#!/usr/bin/env tsx

/**
 * Fix Admin Routes Script
 * 
 * This script fixes admin routes that have broken Firebase queries
 * by converting them to proper Admin SDK syntax.
 */

import * as fs from 'fs';
import * as path from 'path';

// Files that need fixing (admin routes with broken queries)
const ADMIN_ROUTES_TO_FIX = [
  'app/api/admin/security-metrics/route.ts',
  'app/api/cron/financial-sync/route.ts', 
  'app/api/payouts/earnings/route.ts',
  'app/api/payouts/process-monthly/route.ts'
];

interface QueryFix {
  file: string;
  fixes: Array<{
    search: string;
    replace: string;
    description: string;
  }>;
}

const QUERY_FIXES: QueryFix[] = [
  {
    file: 'app/api/admin/security-metrics/route.ts',
    fixes: [
      {
        search: `collection(db, 'users'),
      limit(10000)
    );`,
        replace: `const usersQuery = db.collection(getCollectionName('users')).limit(10000);`,
        description: 'Fix users query'
      }
    ]
  },
  {
    file: 'app/api/cron/financial-sync/route.ts',
    fixes: [
      {
        search: `collection(db, 'writerTokenBalances'),
      limit(batchSize)
    );`,
        replace: `const balancesQuery = db.collection(getCollectionName('writerTokenBalances')).limit(batchSize);`,
        description: 'Fix token balances query'
      }
    ]
  },
  {
    file: 'app/api/payouts/earnings/route.ts',
    fixes: [
      {
        search: `        where('recipientId', '==', recipientId),
        orderBy('scheduledAt', 'desc'),
        limit(pageSize)
      );`,
        replace: `        .where('recipientId', '==', recipientId)
        .orderBy('scheduledAt', 'desc')
        .limit(pageSize);`,
        description: 'Fix payouts query'
      }
    ]
  },
  {
    file: 'app/api/payouts/process-monthly/route.ts',
    fixes: [
      {
        search: `import {
import { getCollectionName } from "../../../utils/environmentConfig";
  collection,`,
        replace: `import { getCollectionName } from "../../../utils/environmentConfig";
import {
  collection,`,
        description: 'Fix malformed import'
      }
    ]
  }
];

function fixFile(filePath: string, fixes: Array<{search: string, replace: string, description: string}>): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    let hasChanges = false;

    for (const fix of fixes) {
      if (content.includes(fix.search)) {
        content = content.replace(fix.search, fix.replace);
        console.log(`   ✅ ${fix.description}`);
        hasChanges = true;
      } else {
        console.log(`   ⚠️  Pattern not found: ${fix.description}`);
      }
    }

    if (hasChanges) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️  No changes needed for ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error);
    return false;
  }
}

async function main() {
  console.log('🔧 Fixing admin routes with broken Firebase queries...\n');

  let totalFixed = 0;
  let totalFiles = 0;

  for (const queryFix of QUERY_FIXES) {
    console.log(`📄 Processing ${queryFix.file}:`);
    totalFiles++;
    
    const wasFixed = fixFile(queryFix.file, queryFix.fixes);
    if (wasFixed) {
      totalFixed++;
    }
    console.log();
  }

  console.log(`\n🎉 Summary: Fixed ${totalFixed}/${totalFiles} admin route files`);
  
  if (totalFixed > 0) {
    console.log('\n🧪 Test the build to verify fixes:');
    console.log('   npm run build');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
