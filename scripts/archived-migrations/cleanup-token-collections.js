#!/usr/bin/env node

/**
 * WeWrite Token Collections Cleanup Script
 * 
 * This script safely deletes old token collections after successful USD migration.
 * It includes safety checks and backup creation before deletion.
 * 
 * Usage:
 *   node scripts/cleanup-token-collections.js [--dry-run] [--force]
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

// Initialize Firebase Admin
if (!admin.apps.length) {
  let serviceAccount;
  
  if (process.env.GOOGLE_CLOUD_KEY_JSON) {
    console.log('Using service account from environment variable');
    const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON;
    console.log('JSON string length:', keyJson.length);
    console.log('JSON string preview:', keyJson.substring(0, 50) + '...');
    
    try {
      console.log('Decoding base64 encoded service account');
      serviceAccount = JSON.parse(Buffer.from(keyJson, 'base64').toString());
    } catch (error) {
      console.log('Failed to decode base64, trying direct JSON parse');
      serviceAccount = JSON.parse(keyJson);
    }
  } else {
    console.log('Using service account from file');
    serviceAccount = require('../wewrite-ccd82-firebase-adminsdk-ggkxs-2a9c8b5c8e.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
  
  console.log('Firebase Admin initialized successfully');
}

const db = admin.firestore();

// Collections to clean up
const TOKEN_COLLECTIONS = [
  'tokenBalances',
  'tokenAllocations', 
  'pendingTokenAllocations',
  'writerTokenBalances',
  'writerTokenEarnings',
  'tokenPayouts'
];

// DEV collections (with DEV_ prefix)
const DEV_TOKEN_COLLECTIONS = TOKEN_COLLECTIONS.map(name => `DEV_${name}`);

/**
 * Create backup of collections before deletion
 */
async function createBackup(collections) {
  console.log('📦 Creating backup of token collections...');
  
  const backupDir = path.join(__dirname, '..', 'backups', `token-collections-${Date.now()}`);
  
  if (!dryRun) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const backupSummary = {
    timestamp: new Date().toISOString(),
    collections: {},
    totalDocuments: 0
  };

  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).get();
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
      
      backupSummary.collections[collectionName] = {
        documentCount: docs.length,
        sampleDoc: docs.length > 0 ? docs[0] : null
      };
      backupSummary.totalDocuments += docs.length;
      
      if (!dryRun && docs.length > 0) {
        const backupFile = path.join(backupDir, `${collectionName}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(docs, null, 2));
        console.log(`✅ Backed up ${docs.length} documents from ${collectionName}`);
      } else if (docs.length > 0) {
        console.log(`📋 Would backup ${docs.length} documents from ${collectionName}`);
      } else {
        console.log(`📋 Collection ${collectionName} is empty`);
      }
      
    } catch (error) {
      console.log(`⚠️  Collection ${collectionName} not found or error: ${error.message}`);
      backupSummary.collections[collectionName] = {
        error: error.message
      };
    }
  }
  
  if (!dryRun) {
    const summaryFile = path.join(backupDir, 'backup-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(backupSummary, null, 2));
    console.log(`📊 Backup summary saved to: ${summaryFile}`);
  }
  
  return backupSummary;
}

/**
 * Verify USD collections exist and have data
 */
async function verifyUsdCollections() {
  console.log('🔍 Verifying USD collections exist...');
  
  const usdCollections = [
    'DEV_usdBalances',
    'DEV_usdAllocations', 
    'DEV_writerUsdBalances'
  ];
  
  let totalUsdDocs = 0;
  
  for (const collectionName of usdCollections) {
    try {
      const snapshot = await db.collection(collectionName).limit(1).get();
      if (snapshot.size > 0) {
        const fullSnapshot = await db.collection(collectionName).get();
        totalUsdDocs += fullSnapshot.size;
        console.log(`✅ ${collectionName}: ${fullSnapshot.size} documents`);
      } else {
        console.log(`⚠️  ${collectionName}: No documents found`);
      }
    } catch (error) {
      console.log(`❌ ${collectionName}: Error - ${error.message}`);
      return false;
    }
  }
  
  if (totalUsdDocs === 0) {
    console.log('❌ No USD collections found with data. Migration may not be complete.');
    return false;
  }
  
  console.log(`✅ Found ${totalUsdDocs} total documents in USD collections`);
  return true;
}

/**
 * Delete a collection safely
 */
async function deleteCollection(collectionName) {
  try {
    const snapshot = await db.collection(collectionName).get();
    
    if (snapshot.empty) {
      console.log(`📋 Collection ${collectionName} is already empty`);
      return { deleted: 0, errors: 0 };
    }
    
    console.log(`🗑️  Deleting ${snapshot.size} documents from ${collectionName}...`);
    
    if (dryRun) {
      console.log(`📋 Would delete ${snapshot.size} documents from ${collectionName}`);
      return { deleted: snapshot.size, errors: 0 };
    }
    
    // Delete in batches
    const batch = db.batch();
    let deleteCount = 0;
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });
    
    await batch.commit();
    console.log(`✅ Deleted ${deleteCount} documents from ${collectionName}`);
    
    return { deleted: deleteCount, errors: 0 };
    
  } catch (error) {
    console.error(`❌ Error deleting collection ${collectionName}:`, error.message);
    return { deleted: 0, errors: 1 };
  }
}

/**
 * Main cleanup function
 */
async function cleanupTokenCollections() {
  console.log('🚀 Starting WeWrite Token Collections Cleanup');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE CLEANUP'}`);
  console.log(`Force: ${force ? 'YES' : 'NO'}`);
  console.log('─'.repeat(50));
  
  // Safety check: Verify USD collections exist
  if (!force) {
    const usdVerified = await verifyUsdCollections();
    if (!usdVerified) {
      console.log('❌ USD collections verification failed. Use --force to override.');
      process.exit(1);
    }
  }
  
  // Determine which collections to clean up
  const collectionsToCleanup = [...DEV_TOKEN_COLLECTIONS, ...TOKEN_COLLECTIONS];
  
  // Create backup
  const backupSummary = await createBackup(collectionsToCleanup);
  
  if (backupSummary.totalDocuments === 0) {
    console.log('✅ No token collections found with data. Cleanup not needed.');
    return;
  }
  
  // Confirm deletion (unless dry run or force)
  if (!dryRun && !force) {
    console.log('\n⚠️  WARNING: This will permanently delete all token collections!');
    console.log(`📊 Total documents to delete: ${backupSummary.totalDocuments}`);
    console.log('💾 Backup has been created');
    console.log('\nTo proceed, run with --force flag:');
    console.log('node scripts/cleanup-token-collections.js --force');
    return;
  }
  
  // Delete collections
  console.log('\n🗑️  Deleting token collections...');
  
  const results = {
    totalDeleted: 0,
    totalErrors: 0,
    collections: {}
  };
  
  for (const collectionName of collectionsToCleanup) {
    const result = await deleteCollection(collectionName);
    results.collections[collectionName] = result;
    results.totalDeleted += result.deleted;
    results.totalErrors += result.errors;
  }
  
  console.log('─'.repeat(50));
  console.log('✅ Token collections cleanup completed!');
  console.log(`📊 Total documents deleted: ${results.totalDeleted}`);
  console.log(`❌ Total errors: ${results.totalErrors}`);
  
  if (results.totalErrors > 0) {
    console.log('⚠️  Some collections had errors. Check logs above.');
  }
}

// Run the cleanup
cleanupTokenCollections().catch(error => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});
