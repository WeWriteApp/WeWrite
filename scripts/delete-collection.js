#!/usr/bin/env node

/**
 * Delete Collection Script
 * 
 * Safely deletes a Firestore collection using Admin SDK
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  let serviceAccount;
  
  if (process.env.GOOGLE_CLOUD_KEY_JSON) {
    try {
      const base64Key = process.env.GOOGLE_CLOUD_KEY_JSON;
      const decodedKey = Buffer.from(base64Key, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decodedKey);
      console.log('✅ Decoded base64-encoded credentials');
    } catch (error) {
      console.error('❌ Failed to decode GOOGLE_CLOUD_KEY_JSON:', error.message);
      process.exit(1);
    }
  } else {
    console.error('❌ GOOGLE_CLOUD_KEY_JSON environment variable not found');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  });
  
  console.log('✅ Firebase Admin initialized');
}

const db = admin.firestore();

/**
 * Delete all documents in a collection
 */
async function deleteCollection(collectionName, dryRun = true) {
  console.log(`\n🗑️  Deleting collection: ${collectionName}`);
  console.log(`📋 Mode: ${dryRun ? 'DRY RUN' : 'LIVE DELETION'}`);
  
  try {
    // Get all documents
    const snapshot = await db.collection(collectionName).get();
    
    if (snapshot.empty) {
      console.log(`ℹ️  Collection ${collectionName} is already empty`);
      return { success: true, deleted: 0 };
    }
    
    console.log(`📄 Found ${snapshot.docs.length} documents to delete`);
    
    if (dryRun) {
      console.log('\n📋 DOCUMENTS TO DELETE:');
      snapshot.docs.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.id}`);
      });
      
      console.log(`\n✅ DRY RUN: Would delete ${snapshot.docs.length} documents`);
      return { success: true, deleted: snapshot.docs.length };
    }
    
    // Live deletion
    console.log('\n🚀 Starting live deletion...');
    
    const batch = db.batch();
    let batchCount = 0;
    let totalDeleted = 0;
    
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      batchCount++;
      
      // Commit batch every 500 documents
      if (batchCount >= 500) {
        await batch.commit();
        totalDeleted += batchCount;
        console.log(`✅ Deleted ${totalDeleted} documents...`);
        batchCount = 0;
      }
    }
    
    // Commit remaining documents
    if (batchCount > 0) {
      await batch.commit();
      totalDeleted += batchCount;
    }
    
    console.log(`✅ Deletion complete: ${totalDeleted} documents deleted`);
    
    // Verify deletion
    const verifySnapshot = await db.collection(collectionName).limit(1).get();
    if (verifySnapshot.empty) {
      console.log(`🔍 Verification: Collection ${collectionName} is now empty`);
    } else {
      console.log(`⚠️  Warning: Collection ${collectionName} still has documents`);
    }
    
    return { success: true, deleted: totalDeleted };
    
  } catch (error) {
    console.error(`❌ Deletion failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main function
 */
async function runDeletion() {
  console.log('\n🗑️  WeWrite Collection Deletion');
  console.log('===============================');
  
  const collectionName = process.argv[2];
  const dryRun = !process.argv.includes('--live');
  
  if (!collectionName) {
    console.error('❌ Please provide a collection name');
    console.log('Usage: node scripts/delete-collection.js <collection-name> [--live]');
    console.log('Example: node scripts/delete-collection.js DEV_usd_balances --live');
    process.exit(1);
  }
  
  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode');
    console.log('   Add --live flag to perform actual deletion');
  } else {
    console.log('🚀 Running in LIVE mode');
    console.log('   This will permanently delete data!');
  }
  
  const result = await deleteCollection(collectionName, dryRun);
  
  if (result.success) {
    console.log('\n✅ Deletion process complete!');
    
    if (dryRun) {
      console.log('\n🔄 To run the actual deletion:');
      console.log(`   node scripts/delete-collection.js ${collectionName} --live`);
    }
  } else {
    console.error('\n❌ Deletion failed:', result.error);
    process.exit(1);
  }
}

// Run the deletion
runDeletion()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Deletion failed:', error);
    process.exit(1);
  });
