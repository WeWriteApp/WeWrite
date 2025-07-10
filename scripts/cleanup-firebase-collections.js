#!/usr/bin/env node

/**
 * Firebase Collections Cleanup Script
 * 
 * This script safely removes unused Firebase collections identified by the audit.
 * It includes safety checks and dry-run mode to prevent accidental data loss.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (using existing service account)
if (!admin.apps.length) {
  try {
    let serviceAccount;
    
    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
      
      if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
        jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
      }
      
      serviceAccount = JSON.parse(jsonString);
    } else if (process.env.LOGGING_CLOUD_KEY_JSON) {
      serviceAccount = JSON.parse(process.env.LOGGING_CLOUD_KEY_JSON);
    } else {
      console.error('❌ Firebase credentials not found');
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
 * Collections that are safe to delete
 */
const SAFE_TO_DELETE = [
  'dev_users',           // Empty development collection
  'test',                // Test collection
  'usernameDiscrepancies' // Legacy collection
];

/**
 * Collections that should NEVER be deleted (safety check)
 */
const PROTECTED_COLLECTIONS = [
  'users',
  'pages',
  'subscriptions',
  'tokenBalances',
  'tokenAllocations',
  'tokenEarnings',
  'writerTokenBalances',
  'activities',
  'config'
];

async function deleteCollection(collectionName, dryRun = true) {
  try {
    console.log(`\n🔍 Processing collection: ${collectionName}`);
    
    // Safety check - never delete protected collections
    if (PROTECTED_COLLECTIONS.includes(collectionName)) {
      console.error(`❌ SAFETY CHECK FAILED: ${collectionName} is a protected collection!`);
      return false;
    }
    
    // Get collection reference
    const collectionRef = db.collection(collectionName);
    
    // Check if collection exists and get document count
    const snapshot = await collectionRef.limit(1).get();
    
    if (snapshot.empty) {
      console.log(`📭 Collection ${collectionName} is empty`);
      
      if (dryRun) {
        console.log(`🔍 DRY RUN: Would delete empty collection ${collectionName}`);
        return true;
      } else {
        console.log(`🗑️  Deleting empty collection ${collectionName}...`);
        // Note: Firestore doesn't have a direct way to delete empty collections
        // They are automatically cleaned up when all documents are removed
        console.log(`✅ Collection ${collectionName} marked for cleanup`);
        return true;
      }
    }
    
    // Get all documents for non-empty collections
    const allDocs = await collectionRef.get();
    const docCount = allDocs.size;
    
    console.log(`📊 Collection ${collectionName} has ${docCount} documents`);
    
    if (dryRun) {
      console.log(`🔍 DRY RUN: Would delete ${docCount} documents from ${collectionName}`);
      
      // Show sample documents for review
      if (docCount > 0 && docCount <= 5) {
        console.log(`📋 Sample documents:`);
        allDocs.forEach((doc, index) => {
          if (index < 3) { // Show max 3 samples
            const data = doc.data();
            const preview = JSON.stringify(data, null, 2).substring(0, 200);
            console.log(`   ${doc.id}: ${preview}${preview.length >= 200 ? '...' : ''}`);
          }
        });
      }
      
      return true;
    } else {
      console.log(`🗑️  Deleting ${docCount} documents from ${collectionName}...`);
      
      // Delete documents in batches
      const batchSize = 500;
      let deletedCount = 0;
      
      while (deletedCount < docCount) {
        const batch = db.batch();
        const docsToDelete = await collectionRef.limit(batchSize).get();
        
        if (docsToDelete.empty) break;
        
        docsToDelete.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedCount += docsToDelete.size;
        
        console.log(`   Deleted ${deletedCount}/${docCount} documents...`);
      }
      
      console.log(`✅ Successfully deleted all documents from ${collectionName}`);
      return true;
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${collectionName}:`, error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const force = args.includes('--force');
  
  console.log('🧹 Firebase Collections Cleanup');
  console.log('=' .repeat(50));
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No actual deletions will be performed');
    console.log('💡 Use --execute flag to perform actual cleanup');
  } else {
    console.log('⚠️  EXECUTE MODE - Collections will be permanently deleted!');
    
    if (!force) {
      console.log('\n❓ Are you sure you want to proceed? This action cannot be undone.');
      console.log('💡 Use --force flag to skip this confirmation');
      
      // In a real implementation, you'd want to add readline for confirmation
      console.log('❌ Aborting - use --force flag to proceed without confirmation');
      process.exit(1);
    }
  }
  
  console.log('\n📋 Collections to be cleaned up:');
  SAFE_TO_DELETE.forEach(name => {
    console.log(`   - ${name}`);
  });
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const collectionName of SAFE_TO_DELETE) {
    const success = await deleteCollection(collectionName, dryRun);
    
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }
  
  console.log('\n📊 CLEANUP SUMMARY:');
  console.log('=' .repeat(30));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  
  if (dryRun) {
    console.log('\n💡 To execute the cleanup, run:');
    console.log('npm run firebase:cleanup -- --execute --force');
  } else {
    console.log('\n✅ Cleanup completed!');
    
    if (successCount > 0) {
      console.log('\n📋 Next steps:');
      console.log('1. Verify that your application still works correctly');
      console.log('2. Monitor for any errors in the logs');
      console.log('3. Consider setting up automated cleanup policies');
    }
  }
}

// Run the cleanup
if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { deleteCollection };
