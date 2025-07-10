#!/usr/bin/env node

/**
 * Firebase Collections Audit Script
 * 
 * This script helps identify which Firebase collections are actively used
 * in the codebase and which ones might be safe to clean up.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (using existing service account)
if (!admin.apps.length) {
  try {
    // Try to use the service account from environment
    let serviceAccount;
    
    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;

      // Check if it's base64 encoded
      if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
      }

      serviceAccount = JSON.parse(jsonString);
    } else if (process.env.LOGGING_CLOUD_KEY_JSON) {
      // Fallback to LOGGING_CLOUD_KEY_JSON
      serviceAccount = JSON.parse(process.env.LOGGING_CLOUD_KEY_JSON);
    } else {
      console.error('❌ Neither GOOGLE_CLOUD_KEY_JSON nor LOGGING_CLOUD_KEY_JSON environment variable found');
      console.error('💡 Make sure you have a .env.local file with Firebase credentials');
      process.exit(1);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
    });
    
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

/**
 * Collections that are actively used in the codebase
 */
const ACTIVE_COLLECTIONS = {
  // Core application collections
  'pages': 'Main content pages and articles',
  'users': 'User profiles and authentication data',
  
  // Payment and subscription system
  'subscriptions': 'User subscription data (subcollection under users)',
  'tokenBalances': 'User token balances for pledging',
  'tokenAllocations': 'Token allocations to pages',
  'tokenEarnings': 'Token earnings for writers',
  'writerTokenBalances': 'Writer-specific token balances',
  'writerTokenEarnings': 'Writer-specific earnings',
  'tokenPayouts': 'Token payout records',
  'payouts': 'General payout records',
  'payoutRequests': 'Payout request tracking',
  'transactions': 'Financial transaction records',
  'paymentRecovery': 'Payment recovery and retry logic',
  
  // Analytics and monitoring
  'analytics': 'Analytics data storage',
  'analytics_counters': 'Global analytics counters',
  'analytics_daily': 'Daily analytics aggregations',
  'analytics_events': 'Analytics event tracking',
  'analytics_hourly': 'Hourly analytics aggregations',
  'activities': 'User activity tracking',
  'counters': 'User and page counters',
  'stats': 'Computed statistics',

  // Backlinks and page relationships
  'backlinks': 'Page backlink index',
  'pageFollowers': 'Page follower relationships',
  'pageViews': 'Page view tracking',

  // User features and history
  'readingHistory': 'User reading history',
  'sessions': 'User session tracking',
  'siteVisitors': 'Site visitor analytics',
  'userFollowerRelations': 'User follower relationships',
  'userFollowers': 'User followers',
  'userFollowing': 'User following lists',
  'userFollows': 'User follow relationships',
  'userStreaks': 'User activity streaks',
  'usernameHistory': 'Username change history',
  'usernames': 'Username to user ID mapping',

  // Feature management
  'featureHistory': 'Feature flag change history',
  'featureOverrides': 'Feature flag overrides',
  'ledger': 'Transaction ledger',
  
  // Configuration and admin
  'config': 'Application configuration (admin users, etc.)',
  
  // Development collections (with dev_ prefix)
  'dev_pages': 'Development pages',
  'dev_users': 'Development users',
  'dev_subscriptions': 'Development subscriptions',
  'dev_tokenBalances': 'Development token balances',
  'dev_tokenAllocations': 'Development token allocations',
  'dev_tokenEarnings': 'Development token earnings',
  'dev_writerTokenBalances': 'Development writer token balances',
  'dev_writerTokenEarnings': 'Development writer earnings',
  'dev_tokenPayouts': 'Development token payouts',
  'dev_payouts': 'Development payouts',
  'dev_payoutRequests': 'Development payout requests',
  'dev_transactions': 'Development transactions',
  'dev_paymentRecovery': 'Development payment recovery'
};

/**
 * Collections that might be safe to remove
 */
const POTENTIALLY_UNUSED_COLLECTIONS = [
  'test',
  'usernameDiscrepancies',
  'temp',
  'backup',
  'migration',
  'old_',
  'legacy_',
  'unused_'
];

async function listAllCollections() {
  try {
    console.log('\n🔍 Scanning all Firebase collections...\n');
    
    const collections = await db.listCollections();
    const collectionNames = collections.map(col => col.id).sort();
    
    console.log(`📊 Found ${collectionNames.length} total collections:\n`);
    
    const analysis = {
      active: [],
      potentiallyUnused: [],
      unknown: []
    };
    
    for (const name of collectionNames) {
      if (ACTIVE_COLLECTIONS[name]) {
        analysis.active.push({ name, description: ACTIVE_COLLECTIONS[name] });
      } else if (POTENTIALLY_UNUSED_COLLECTIONS.some(pattern => name.includes(pattern))) {
        analysis.potentiallyUnused.push(name);
      } else {
        analysis.unknown.push(name);
      }
    }
    
    // Display active collections
    console.log('✅ ACTIVE COLLECTIONS (used in codebase):');
    console.log('=' .repeat(50));
    analysis.active.forEach(({ name, description }) => {
      console.log(`📁 ${name.padEnd(25)} - ${description}`);
    });
    
    // Display potentially unused collections
    if (analysis.potentiallyUnused.length > 0) {
      console.log('\n⚠️  POTENTIALLY UNUSED COLLECTIONS:');
      console.log('=' .repeat(50));
      analysis.potentiallyUnused.forEach(name => {
        console.log(`🗑️  ${name}`);
      });
    }
    
    // Display unknown collections
    if (analysis.unknown.length > 0) {
      console.log('\n❓ UNKNOWN COLLECTIONS (need manual review):');
      console.log('=' .repeat(50));
      analysis.unknown.forEach(name => {
        console.log(`❔ ${name}`);
      });
    }
    
    return { collectionNames, analysis };
    
  } catch (error) {
    console.error('❌ Error listing collections:', error);
    throw error;
  }
}

async function analyzeCollectionSizes(collectionNames) {
  console.log('\n📊 Analyzing collection sizes...\n');
  
  const sizes = [];
  
  for (const name of collectionNames) {
    try {
      const snapshot = await db.collection(name).limit(1).get();
      const isEmpty = snapshot.empty;
      
      if (!isEmpty) {
        // Get approximate count (limited to avoid expensive operations)
        const countSnapshot = await db.collection(name).limit(100).get();
        const approximateCount = countSnapshot.size;
        const hasMore = countSnapshot.size === 100;
        
        sizes.push({
          name,
          count: hasMore ? `${approximateCount}+` : approximateCount,
          isEmpty: false
        });
      } else {
        sizes.push({
          name,
          count: 0,
          isEmpty: true
        });
      }
    } catch (error) {
      console.warn(`⚠️  Could not analyze ${name}:`, error.message);
      sizes.push({
        name,
        count: 'Error',
        isEmpty: null
      });
    }
  }
  
  // Sort by count (empty collections last)
  sizes.sort((a, b) => {
    if (a.isEmpty && !b.isEmpty) return 1;
    if (!a.isEmpty && b.isEmpty) return -1;
    if (typeof a.count === 'number' && typeof b.count === 'number') {
      return b.count - a.count;
    }
    return 0;
  });
  
  console.log('Collection sizes:');
  console.log('-'.repeat(40));
  sizes.forEach(({ name, count, isEmpty }) => {
    const status = isEmpty ? '(EMPTY)' : '';
    console.log(`${name.padEnd(25)} ${String(count).padStart(8)} docs ${status}`);
  });
  
  return sizes;
}

async function main() {
  try {
    console.log('🧹 Firebase Collections Audit');
    console.log('=' .repeat(50));
    
    const { collectionNames, analysis } = await listAllCollections();
    const sizes = await analyzeCollectionSizes(collectionNames);
    
    // Generate cleanup recommendations
    console.log('\n💡 CLEANUP RECOMMENDATIONS:');
    console.log('=' .repeat(50));
    
    const emptyCollections = sizes.filter(s => s.isEmpty);
    if (emptyCollections.length > 0) {
      console.log('\n🗑️  Empty collections (safe to delete):');
      emptyCollections.forEach(({ name }) => {
        console.log(`   - ${name}`);
      });
    }
    
    if (analysis.potentiallyUnused.length > 0) {
      console.log('\n⚠️  Collections to review (potentially unused):');
      analysis.potentiallyUnused.forEach(name => {
        const size = sizes.find(s => s.name === name);
        console.log(`   - ${name} (${size?.count || 'unknown'} docs)`);
      });
    }
    
    if (analysis.unknown.length > 0) {
      console.log('\n❓ Collections needing manual review:');
      analysis.unknown.forEach(name => {
        const size = sizes.find(s => s.name === name);
        console.log(`   - ${name} (${size?.count || 'unknown'} docs)`);
      });
    }
    
    console.log('\n✅ Audit complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Review empty collections and delete if confirmed unused');
    console.log('2. Investigate unknown collections to determine their purpose');
    console.log('3. Consider archiving old test/development data');
    console.log('4. Set up automated cleanup policies for temporary collections');
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run the audit
if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { listAllCollections, analyzeCollectionSizes };
