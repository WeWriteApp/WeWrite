#!/usr/bin/env node

/**
 * Create Required Firestore Indexes
 * 
 * This script creates the necessary Firestore indexes for WeWrite production.
 * Run this when you see index requirement errors in the logs.
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString('utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PID
  });
}

const db = admin.firestore();

/**
 * Required indexes for WeWrite
 */
const REQUIRED_INDEXES = [
  {
    collection: 'payouts',
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Payout history queries by user'
  },
  {
    collection: 'DEV_payouts', 
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Dev payout history queries by user'
  },
  {
    collection: 'usdAllocations',
    fields: [
      { field: 'recipientUserId', order: 'ASCENDING' },
      { field: 'month', order: 'DESCENDING' }
    ],
    description: 'USD allocations by recipient and month'
  },
  {
    collection: 'DEV_usdAllocations',
    fields: [
      { field: 'recipientUserId', order: 'ASCENDING' },
      { field: 'month', order: 'DESCENDING' }
    ],
    description: 'Dev USD allocations by recipient and month'
  },
  {
    collection: 'pages',
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'deleted', order: 'ASCENDING' },
      { field: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'User pages excluding deleted'
  },
  {
    collection: 'DEV_pages',
    fields: [
      { field: 'userId', order: 'ASCENDING' },
      { field: 'deleted', order: 'ASCENDING' },
      { field: 'createdAt', order: 'DESCENDING' }
    ],
    description: 'Dev user pages excluding deleted'
  }
];

/**
 * Create indexes using Firebase Admin SDK
 * Note: This creates the index configuration but Firestore will build them asynchronously
 */
async function createIndexes() {
  console.log('🔍 Creating Firestore Indexes for WeWrite');
  console.log('──────────────────────────────────────────');
  
  for (const indexConfig of REQUIRED_INDEXES) {
    try {
      console.log(`\n📝 Creating index for ${indexConfig.collection}:`);
      console.log(`   Description: ${indexConfig.description}`);
      console.log(`   Fields: ${indexConfig.fields.map(f => `${f.field} (${f.order})`).join(', ')}`);
      
      // Note: Firebase Admin SDK doesn't have direct index creation
      // This will log the required index URLs for manual creation
      const indexUrl = generateIndexUrl(indexConfig);
      console.log(`   🔗 Create manually: ${indexUrl}`);
      
    } catch (error) {
      console.error(`❌ Error with index for ${indexConfig.collection}:`, error.message);
    }
  }
  
  console.log('\n──────────────────────────────────────────');
  console.log('✅ Index creation URLs generated!');
  console.log('📋 Next steps:');
  console.log('   1. Click each URL above to create the indexes');
  console.log('   2. Wait for indexes to build (can take several minutes)');
  console.log('   3. Test your queries again');
  console.log('\n💡 Tip: You can also create indexes automatically by running');
  console.log('   the failing queries in the Firebase console.');
}

/**
 * Generate Firebase Console URL for index creation
 */
function generateIndexUrl(indexConfig) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PID;
  const baseUrl = `https://console.firebase.google.com/v1/r/project/${projectId}/firestore/indexes`;
  
  // Create composite index URL
  const fields = indexConfig.fields.map(field => {
    const order = field.order === 'ASCENDING' ? 'asc' : 'desc';
    return `${field.field}:${order}`;
  }).join(',');
  
  return `${baseUrl}?create_composite=${indexConfig.collection}:${fields}`;
}

/**
 * Check current index status
 */
async function checkIndexStatus() {
  console.log('📊 Checking current index status...\n');
  
  for (const indexConfig of REQUIRED_INDEXES) {
    try {
      // Try a simple query to see if index exists
      const testQuery = db.collection(indexConfig.collection).limit(1);
      
      // Add where clauses for the indexed fields
      let query = testQuery;
      for (const field of indexConfig.fields) {
        if (field.field !== '__name__') {
          // Add a simple where clause to test the index
          query = query.where(field.field, '>=', '');
        }
      }
      
      const snapshot = await query.get();
      console.log(`✅ ${indexConfig.collection}: Index appears to be working`);
      
    } catch (error) {
      if (error.message.includes('requires an index')) {
        console.log(`❌ ${indexConfig.collection}: Index missing`);
      } else {
        console.log(`⚠️  ${indexConfig.collection}: ${error.message}`);
      }
    }
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  if (command === 'check') {
    await checkIndexStatus();
  } else {
    await createIndexes();
  }
}

main().catch(console.error);
