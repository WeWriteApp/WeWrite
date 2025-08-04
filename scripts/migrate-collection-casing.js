#!/usr/bin/env node

/**
 * Migrate Collection Casing Script
 * 
 * Safely migrates data from snake_case collections to camelCase collections
 * Specifically handles: DEV_usd_balances → DEV_usdBalances
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
 * Check if collection exists and count documents
 */
async function checkCollection(collectionName) {
  try {
    const snapshot = await db.collection(collectionName).limit(1).get();
    const count = await db.collection(collectionName).count().get();
    return {
      exists: !snapshot.empty,
      documentCount: count.data().count
    };
  } catch (error) {
    return {
      exists: false,
      documentCount: 0,
      error: error.message
    };
  }
}

/**
 * Migrate data from source to target collection
 */
async function migrateCollection(sourceCollection, targetCollection, dryRun = true) {
  console.log(`\n🔄 Migrating: ${sourceCollection} → ${targetCollection}`);
  console.log(`📋 Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  
  try {
    // Check source collection
    const sourceInfo = await checkCollection(sourceCollection);
    if (!sourceInfo.exists) {
      console.log(`ℹ️  Source collection ${sourceCollection} is empty or doesn't exist`);
      return { success: true, migrated: 0 };
    }
    
    console.log(`📊 Source collection has ${sourceInfo.documentCount} documents`);
    
    // Check target collection
    const targetInfo = await checkCollection(targetCollection);
    if (targetInfo.exists && targetInfo.documentCount > 0) {
      console.log(`⚠️  Target collection ${targetCollection} already has ${targetInfo.documentCount} documents`);
      console.log(`🤔 Do you want to merge or skip? (This is a ${dryRun ? 'dry run' : 'live migration'})`);
    }
    
    // Get all documents from source
    const sourceSnapshot = await db.collection(sourceCollection).get();
    
    if (sourceSnapshot.empty) {
      console.log(`ℹ️  Source collection ${sourceCollection} is empty`);
      return { success: true, migrated: 0 };
    }
    
    console.log(`📄 Found ${sourceSnapshot.docs.length} documents to migrate`);
    
    if (dryRun) {
      console.log('\n📋 DOCUMENTS TO MIGRATE:');
      sourceSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  ${index + 1}. ${doc.id} (${Object.keys(data).length} fields)`);
        
        // Show sample data for first few documents
        if (index < 3) {
          console.log(`     Sample fields: ${Object.keys(data).slice(0, 5).join(', ')}`);
        }
      });
      
      console.log(`\n✅ DRY RUN: Would migrate ${sourceSnapshot.docs.length} documents`);
      return { success: true, migrated: sourceSnapshot.docs.length };
    }
    
    // Live migration
    console.log('\n🚀 Starting live migration...');
    
    const batch = db.batch();
    let batchCount = 0;
    let totalMigrated = 0;
    
    for (const doc of sourceSnapshot.docs) {
      const targetRef = db.collection(targetCollection).doc(doc.id);
      batch.set(targetRef, doc.data());
      batchCount++;
      
      // Commit batch every 500 documents
      if (batchCount >= 500) {
        await batch.commit();
        totalMigrated += batchCount;
        console.log(`✅ Migrated ${totalMigrated} documents...`);
        batchCount = 0;
      }
    }
    
    // Commit remaining documents
    if (batchCount > 0) {
      await batch.commit();
      totalMigrated += batchCount;
    }
    
    console.log(`✅ Migration complete: ${totalMigrated} documents migrated`);
    
    // Verify migration
    const verifyInfo = await checkCollection(targetCollection);
    console.log(`🔍 Verification: Target collection now has ${verifyInfo.documentCount} documents`);
    
    return { success: true, migrated: totalMigrated };
    
  } catch (error) {
    console.error(`❌ Migration failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Delete source collection after successful migration
 */
async function deleteSourceCollection(collectionName, dryRun = true) {
  console.log(`\n🗑️  Deleting source collection: ${collectionName}`);
  console.log(`📋 Mode: ${dryRun ? 'DRY RUN' : 'LIVE DELETION'}`);
  
  if (dryRun) {
    console.log(`✅ DRY RUN: Would delete collection ${collectionName}`);
    return { success: true };
  }
  
  try {
    // Delete all documents in batches
    const snapshot = await db.collection(collectionName).get();
    
    if (snapshot.empty) {
      console.log(`ℹ️  Collection ${collectionName} is already empty`);
      return { success: true };
    }
    
    console.log(`🗑️  Deleting ${snapshot.docs.length} documents...`);
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`✅ Deleted ${snapshot.docs.length} documents from ${collectionName}`);
    
    return { success: true };
    
  } catch (error) {
    console.error(`❌ Deletion failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('\n🔧 WeWrite Collection Casing Migration');
  console.log('=====================================');
  
  const migrations = [
    {
      source: 'DEV_usd_balances',
      target: 'DEV_usdBalances',
      description: 'USD Balances (Development)'
    },
    {
      source: 'DEV_user_preferences',
      target: 'DEV_userPreferences',
      description: 'User Preferences (Development)'
    }
  ];
  
  // Check if we should run in dry-run mode
  const dryRun = !process.argv.includes('--live');
  
  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode');
    console.log('   Add --live flag to perform actual migration');
  } else {
    console.log('🚀 Running in LIVE mode');
    console.log('   This will modify your database!');
  }
  
  for (const migration of migrations) {
    console.log(`\n📋 Processing: ${migration.description}`);
    
    // Check both collections first
    const sourceInfo = await checkCollection(migration.source);
    const targetInfo = await checkCollection(migration.target);
    
    console.log(`📊 Source (${migration.source}): ${sourceInfo.documentCount} documents`);
    console.log(`📊 Target (${migration.target}): ${targetInfo.documentCount} documents`);
    
    if (!sourceInfo.exists) {
      console.log(`✅ Source collection is empty, nothing to migrate`);
      continue;
    }
    
    // Perform migration
    const result = await migrateCollection(migration.source, migration.target, dryRun);
    
    if (result.success && result.migrated > 0 && !dryRun) {
      console.log(`\n🤔 Migration successful. Delete source collection? (${migration.source})`);
      console.log(`   This is irreversible! Make sure you have backups.`);
      
      // For now, don't auto-delete. Require manual confirmation.
      console.log(`   To delete manually, run:`);
      console.log(`   npx firebase firestore:delete --collection-path ${migration.source} --yes`);
    }
  }
  
  console.log('\n✅ Migration process complete!');
  
  if (dryRun) {
    console.log('\n🔄 To run the actual migration:');
    console.log('   node scripts/migrate-collection-casing.js --live');
  }
}

// Run the migration
runMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
