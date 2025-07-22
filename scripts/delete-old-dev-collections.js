#!/usr/bin/env node

/**
 * Delete Old dev_ Collections Script
 * 
 * This script automatically deletes old dev_ collections that are inconsistent
 * with the new DEV_ naming standard.
 * 
 * WARNING: This will permanently delete data!
 */

const admin = require('firebase-admin');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
function initializeFirebase() {
  try {
    let serviceAccount;

    if (process.env.GOOGLE_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
      
      // Handle base64 encoded credentials
      if (process.env.GOOGLE_CLOUD_KEY_BASE64 === 'True' && !jsonString.includes(' ') && !jsonString.startsWith('{')) {
        console.log('🔓 Decoding base64-encoded credentials...');
        jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
      }
      
      serviceAccount = JSON.parse(jsonString);
      console.log('✅ Using GOOGLE_CLOUD_KEY_JSON credentials');
    } else if (process.env.LOGGING_CLOUD_KEY_JSON) {
      serviceAccount = JSON.parse(process.env.LOGGING_CLOUD_KEY_JSON);
      console.log('✅ Using LOGGING_CLOUD_KEY_JSON credentials');
    } else {
      console.error('❌ No Firebase credentials found');
      process.exit(1);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL || 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
    });

    console.log('✅ Firebase Admin initialized');
    return admin.firestore();
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    process.exit(1);
  }
}

// Delete all documents in a collection
async function deleteCollection(db, collectionName) {
  const batchSize = 100;
  let deletedCount = 0;

  try {
    console.log(`🗑️  Deleting collection: ${collectionName}`);
    
    while (true) {
      const snapshot = await db.collection(collectionName).limit(batchSize).get();
      
      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deletedCount += snapshot.docs.length;
      console.log(`   Deleted ${snapshot.docs.length} documents (total: ${deletedCount})`);
    }

    console.log(`✅ Deleted collection ${collectionName} (${deletedCount} documents)`);
    return deletedCount;
  } catch (error) {
    console.error(`❌ Failed to delete collection ${collectionName}:`, error);
    return 0;
  }
}

// Get all collections
async function getAllCollections(db) {
  try {
    const collections = await db.listCollections();
    return collections.map(col => col.id);
  } catch (error) {
    console.error('❌ Failed to list collections:', error);
    return [];
  }
}

// Main cleanup function
async function cleanupOldCollections() {
  console.log('🧹 WeWrite Collection Cleanup');
  console.log('=============================');
  console.log('⚠️  WARNING: This will permanently delete old dev_ collections!');
  
  const db = initializeFirebase();
  
  console.log('\n📊 Getting collections...');
  const collections = await getAllCollections(db);
  
  if (collections.length === 0) {
    console.log('❌ No collections found');
    return;
  }

  // Find old dev_ collections
  let devCollections = collections.filter(name => name.startsWith('dev_'));
  const DEVCollections = collections.filter(name => name.startsWith('DEV_'));

  console.log(`\n📋 Found ${collections.length} total collections:`);
  console.log(`  • ${devCollections.length} old dev_ collections`);
  console.log(`  • ${DEVCollections.length} correct DEV_ collections`);

  if (devCollections.length === 0) {
    console.log('\n🎉 No old dev_ collections found! Everything is clean.');
    return;
  }

  console.log('\n🗑️  Old dev_ collections to delete:');
  devCollections.forEach(col => console.log(`  • ${col}`));

  // Check for conflicts (both dev_ and DEV_ versions exist)
  const conflicts = [];
  devCollections.forEach(devCol => {
    const baseName = devCol.substring(4); // Remove 'dev_'
    const devUpperCase = `DEV_${baseName}`;
    if (DEVCollections.includes(devUpperCase)) {
      conflicts.push({ old: devCol, new: devUpperCase });
    }
  });

  if (conflicts.length > 0) {
    console.log('\n⚠️  CONFLICTS DETECTED:');
    console.log('Both dev_ and DEV_ versions exist for:');
    conflicts.forEach(conflict => {
      console.log(`  • ${conflict.old} AND ${conflict.new}`);
    });
    console.log('\n🚨 MANUAL REVIEW REQUIRED!');
    console.log('Please manually check these collections and decide which data to keep.');
    console.log('This script will NOT delete collections that have conflicts.');
    
    // Only delete non-conflicting collections
    const safeToDelete = devCollections.filter(devCol => {
      const baseName = devCol.substring(4);
      const devUpperCase = `DEV_${baseName}`;
      return !DEVCollections.includes(devUpperCase);
    });

    if (safeToDelete.length === 0) {
      console.log('\n❌ No collections are safe to delete due to conflicts.');
      return;
    }

    console.log(`\n✅ Safe to delete (${safeToDelete.length} collections):`);
    safeToDelete.forEach(col => console.log(`  • ${col}`));
    devCollections = safeToDelete;
  }

  // Delete old collections
  console.log('\n🗑️  Starting deletion...');
  let totalDeleted = 0;

  for (const collectionName of devCollections) {
    const deleted = await deleteCollection(db, collectionName);
    totalDeleted += deleted;
  }

  console.log('\n🎉 CLEANUP COMPLETE!');
  console.log(`  • Deleted ${devCollections.length} collections`);
  console.log(`  • Removed ${totalDeleted} total documents`);
  console.log('  • All remaining collections use correct DEV_ naming');

  process.exit(0);
}

// Run the cleanup
if (require.main === module) {
  cleanupOldCollections().catch(error => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
}
