#!/usr/bin/env node

/**
 * Simple WeWrite Token to USD Migration Script
 * Migrates token data to USD data for both dev and production
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

// Migration constants
const TOKENS_PER_DOLLAR = 10;
const CENTS_PER_DOLLAR = 100;

function tokensToUsdCents(tokens) {
  const usdAmount = tokens / TOKENS_PER_DOLLAR;
  return Math.round(usdAmount * CENTS_PER_DOLLAR);
}

async function migrateCollection(sourceCollection, targetCollection, transformFn) {
  console.log(`\n🔄 Migrating ${sourceCollection} → ${targetCollection}`);
  
  try {
    const snapshot = await db.collection(sourceCollection).get();
    console.log(`📊 Found ${snapshot.size} documents in ${sourceCollection}`);
    
    if (snapshot.size === 0) {
      console.log(`⚪ No documents to migrate in ${sourceCollection}`);
      return { processed: 0, successful: 0, failed: 0 };
    }
    
    let successful = 0;
    let failed = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const sourceData = doc.data();
        const targetData = transformFn(sourceData, doc.id);
        
        await db.collection(targetCollection).doc(doc.id).set(targetData);
        successful++;
        
        console.log(`✅ Migrated ${doc.id}`);
      } catch (error) {
        failed++;
        console.error(`❌ Failed to migrate ${doc.id}:`, error.message);
      }
    }
    
    console.log(`📊 ${sourceCollection} migration: ${successful} successful, ${failed} failed`);
    return { processed: snapshot.size, successful, failed };
    
  } catch (error) {
    console.error(`❌ Error accessing ${sourceCollection}:`, error.message);
    return { processed: 0, successful: 0, failed: 1 };
  }
}

// Transform functions
function transformTokenBalance(tokenData, docId) {
  return {
    userId: tokenData.userId,
    totalUsdCents: tokensToUsdCents(tokenData.totalTokens || 0),
    allocatedUsdCents: tokensToUsdCents(tokenData.allocatedTokens || 0),
    availableUsdCents: tokensToUsdCents(tokenData.availableTokens || 0),
    monthlyAllocationCents: tokensToUsdCents(tokenData.monthlyAllocation || 0),
    lastAllocationDate: tokenData.lastAllocationDate,
    createdAt: tokenData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function transformTokenAllocation(tokenData, docId) {
  return {
    id: tokenData.id || docId,
    userId: tokenData.userId,
    recipientUserId: tokenData.recipientUserId,
    resourceType: tokenData.resourceType,
    resourceId: tokenData.resourceId,
    usdCents: tokensToUsdCents(tokenData.tokens || 0),
    month: tokenData.month,
    status: tokenData.status,
    createdAt: tokenData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

async function runMigration() {
  console.log('🚀 Starting WeWrite Token to USD Migration');
  console.log('──────────────────────────────────────────────────');
  
  const results = {
    tokenBalances: { processed: 0, successful: 0, failed: 0 },
    devTokenBalances: { processed: 0, successful: 0, failed: 0 },
    tokenAllocations: { processed: 0, successful: 0, failed: 0 },
    devTokenAllocations: { processed: 0, successful: 0, failed: 0 }
  };
  
  // Migrate production token balances
  results.tokenBalances = await migrateCollection(
    'tokenBalances', 
    'usdBalances', 
    transformTokenBalance
  );
  
  // Migrate dev token balances
  results.devTokenBalances = await migrateCollection(
    'DEV_tokenBalances', 
    'DEV_usdBalances', 
    transformTokenBalance
  );
  
  // Migrate production token allocations
  results.tokenAllocations = await migrateCollection(
    'tokenAllocations', 
    'usdAllocations', 
    transformTokenAllocation
  );
  
  // Migrate dev token allocations
  results.devTokenAllocations = await migrateCollection(
    'DEV_tokenAllocations', 
    'DEV_usdAllocations', 
    transformTokenAllocation
  );
  
  console.log('\n──────────────────────────────────────────────────');
  console.log('✅ Migration completed!');
  console.log('📊 Summary:');
  
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  
  Object.entries(results).forEach(([collection, result]) => {
    if (result.processed > 0) {
      console.log(`  ${collection}: ${result.successful}/${result.processed} successful`);
    }
    totalProcessed += result.processed;
    totalSuccessful += result.successful;
    totalFailed += result.failed;
  });
  
  console.log(`\n🎯 Total: ${totalSuccessful}/${totalProcessed} documents migrated successfully`);
  
  if (totalFailed > 0) {
    console.log(`⚠️  ${totalFailed} documents failed to migrate`);
  }
}

// Run migration
runMigration().catch(console.error);
