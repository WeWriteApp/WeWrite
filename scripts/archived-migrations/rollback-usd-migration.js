#!/usr/bin/env node

/**
 * WeWrite USD to Token Rollback Script
 * 
 * This script rolls back the USD migration by:
 * - Restoring token balances from USD balances
 * - Restoring token allocations from USD allocations
 * - Using audit logs to verify rollback accuracy
 * - Cleaning up USD collections after successful rollback
 * 
 * Usage:
 *   node scripts/rollback-usd-migration.js [--dry-run] [--user-id=USER_ID] [--keep-usd-data]
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Rollback constants
const ROLLBACK_CONFIG = {
  TOKENS_PER_DOLLAR: 10,
  CENTS_PER_DOLLAR: 100,
  BATCH_SIZE: 100,
  AUDIT_COLLECTION: 'migration_audit_logs'
};

/**
 * Convert USD cents back to tokens
 */
function usdCentsToTokens(cents) {
  const usdAmount = cents / ROLLBACK_CONFIG.CENTS_PER_DOLLAR;
  return Math.floor(usdAmount * ROLLBACK_CONFIG.TOKENS_PER_DOLLAR);
}

/**
 * Log rollback audit entry
 */
async function logRollbackAuditEntry(entry) {
  const auditRef = db.collection(ROLLBACK_CONFIG.AUDIT_COLLECTION).doc();
  await auditRef.set({
    ...entry,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    rollbackVersion: '1.0.0'
  });
  return auditRef.id;
}

/**
 * Rollback USD balances to token balances
 */
async function rollbackUsdBalances(dryRun = false, specificUserId = null) {
  console.log('🔄 Rolling back USD balances to token balances...');
  
  let query = db.collection('usdBalances');
  if (specificUserId) {
    query = query.where('userId', '==', specificUserId);
  }
  
  const snapshot = await query.get();
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const doc of snapshot.docs) {
    try {
      const usdData = doc.data();
      const userId = usdData.userId;

      // Convert USD cents back to token amounts
      const tokenData = {
        userId,
        totalTokens: usdCentsToTokens(usdData.totalUsdCents || 0),
        allocatedTokens: usdCentsToTokens(usdData.allocatedUsdCents || 0),
        availableTokens: usdCentsToTokens(usdData.availableUsdCents || 0),
        monthlyAllocation: usdCentsToTokens(usdData.monthlyAllocationCents || 0),
        lastAllocationDate: usdData.lastAllocationDate,
        createdAt: usdData.createdAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (!dryRun) {
        // Restore token balance record
        await db.collection('tokenBalances').doc(userId).set(tokenData);

        // Log rollback audit entry
        await logRollbackAuditEntry({
          type: 'usd_balance_rollback',
          userId,
          originalUsdData: usdData,
          restoredTokenData: tokenData,
          conversionRate: ROLLBACK_CONFIG.TOKENS_PER_DOLLAR,
          status: 'completed'
        });
      }

      results.successful++;
      console.log(`✅ Rolled back balance for user ${userId}: $${(usdData.totalUsdCents / 100).toFixed(2)} → ${tokenData.totalTokens} tokens`);

    } catch (error) {
      results.failed++;
      results.errors.push({
        userId: doc.id,
        error: error.message
      });
      console.error(`❌ Failed to rollback balance for user ${doc.id}:`, error.message);
    }

    results.processed++;
  }

  console.log(`📊 USD Balance Rollback Results:`, results);
  return results;
}

/**
 * Rollback USD allocations to token allocations
 */
async function rollbackUsdAllocations(dryRun = false, specificUserId = null) {
  console.log('🔄 Rolling back USD allocations to token allocations...');
  
  let query = db.collection('usdAllocations');
  if (specificUserId) {
    query = query.where('userId', '==', specificUserId);
  }
  
  const snapshot = await query.get();
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const doc of snapshot.docs) {
    try {
      const usdData = doc.data();

      // Convert USD allocation back to tokens
      const tokenData = {
        userId: usdData.userId,
        recipientUserId: usdData.recipientUserId,
        resourceType: usdData.resourceType,
        resourceId: usdData.resourceId,
        tokens: usdCentsToTokens(usdData.usdCents || 0),
        month: usdData.month,
        status: usdData.status,
        createdAt: usdData.createdAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (!dryRun) {
        // Restore token allocation record
        await db.collection('tokenAllocations').doc(doc.id).set(tokenData);

        // Log rollback audit entry
        await logRollbackAuditEntry({
          type: 'usd_allocation_rollback',
          allocationId: doc.id,
          userId: usdData.userId,
          originalUsdData: usdData,
          restoredTokenData: tokenData,
          conversionRate: ROLLBACK_CONFIG.TOKENS_PER_DOLLAR,
          status: 'completed'
        });
      }

      results.successful++;
      console.log(`✅ Rolled back allocation ${doc.id}: $${(usdData.usdCents / 100).toFixed(2)} → ${tokenData.tokens} tokens`);

    } catch (error) {
      results.failed++;
      results.errors.push({
        allocationId: doc.id,
        error: error.message
      });
      console.error(`❌ Failed to rollback allocation ${doc.id}:`, error.message);
    }

    results.processed++;
  }

  console.log(`📊 USD Allocation Rollback Results:`, results);
  return results;
}

/**
 * Rollback writer USD balances to token balances
 */
async function rollbackWriterUsdBalances(dryRun = false, specificUserId = null) {
  console.log('🔄 Rolling back writer USD balances to token balances...');
  
  let query = db.collection('writerUsdBalances');
  if (specificUserId) {
    query = query.where('userId', '==', specificUserId);
  }
  
  const snapshot = await query.get();
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const doc of snapshot.docs) {
    try {
      const usdData = doc.data();
      const userId = usdData.userId;

      // Convert writer USD balance back to tokens
      const tokenData = {
        userId,
        totalTokensEarned: usdCentsToTokens(usdData.totalUsdCentsEarned || 0),
        totalUsdEarned: (usdData.totalUsdCentsEarned || 0) / 100,
        pendingTokens: usdCentsToTokens(usdData.pendingUsdCents || 0),
        pendingUsdValue: (usdData.pendingUsdCents || 0) / 100,
        availableTokens: usdCentsToTokens(usdData.availableUsdCents || 0),
        availableUsdValue: (usdData.availableUsdCents || 0) / 100,
        paidOutTokens: usdCentsToTokens(usdData.paidOutUsdCents || 0),
        paidOutUsdValue: (usdData.paidOutUsdCents || 0) / 100,
        lastProcessedMonth: usdData.lastProcessedMonth,
        createdAt: usdData.createdAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (!dryRun) {
        // Restore writer token balance record
        await db.collection('writerTokenBalances').doc(userId).set(tokenData);

        // Log rollback audit entry
        await logRollbackAuditEntry({
          type: 'writer_usd_balance_rollback',
          userId,
          originalUsdData: usdData,
          restoredTokenData: tokenData,
          conversionRate: ROLLBACK_CONFIG.TOKENS_PER_DOLLAR,
          status: 'completed'
        });
      }

      results.successful++;
      console.log(`✅ Rolled back writer balance for user ${userId}: $${(usdData.totalUsdCentsEarned / 100).toFixed(2)} → ${tokenData.totalTokensEarned} tokens`);

    } catch (error) {
      results.failed++;
      results.errors.push({
        userId: doc.id,
        error: error.message
      });
      console.error(`❌ Failed to rollback writer balance for user ${doc.id}:`, error.message);
    }

    results.processed++;
  }

  console.log(`📊 Writer USD Balance Rollback Results:`, results);
  return results;
}

/**
 * Clean up USD collections after successful rollback
 */
async function cleanupUsdCollections(dryRun = false, specificUserId = null) {
  console.log('🧹 Cleaning up USD collections...');
  
  const collections = ['usdBalances', 'usdAllocations', 'writerUsdBalances'];
  const results = {
    deleted: 0,
    failed: 0,
    errors: []
  };

  for (const collectionName of collections) {
    try {
      let query = db.collection(collectionName);
      if (specificUserId) {
        query = query.where('userId', '==', specificUserId);
      }
      
      const snapshot = await query.get();
      
      if (!dryRun) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      results.deleted += snapshot.size;
      console.log(`✅ ${dryRun ? 'Would delete' : 'Deleted'} ${snapshot.size} documents from ${collectionName}`);

    } catch (error) {
      results.failed++;
      results.errors.push({
        collection: collectionName,
        error: error.message
      });
      console.error(`❌ Failed to clean up ${collectionName}:`, error.message);
    }
  }

  console.log(`📊 Cleanup Results:`, results);
  return results;
}

/**
 * Main rollback function
 */
async function runRollback() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const keepUsdData = args.includes('--keep-usd-data');
  const userIdArg = args.find(arg => arg.startsWith('--user-id='));
  const specificUserId = userIdArg ? userIdArg.split('=')[1] : null;

  console.log('🔄 Starting WeWrite USD to Token Rollback');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE ROLLBACK'}`);
  console.log(`Target: ${specificUserId ? `User ${specificUserId}` : 'All users'}`);
  console.log(`Keep USD Data: ${keepUsdData ? 'YES' : 'NO'}`);
  console.log('─'.repeat(50));

  try {
    const startTime = Date.now();

    // Run rollbacks
    const balanceResults = await rollbackUsdBalances(dryRun, specificUserId);
    const allocationResults = await rollbackUsdAllocations(dryRun, specificUserId);
    const writerBalanceResults = await rollbackWriterUsdBalances(dryRun, specificUserId);

    // Clean up USD collections if requested
    if (!keepUsdData) {
      await cleanupUsdCollections(dryRun, specificUserId);
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('─'.repeat(50));
    console.log('✅ Rollback completed successfully!');
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Total processed: ${balanceResults.processed + allocationResults.processed + writerBalanceResults.processed} records`);

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

// Run rollback if called directly
if (require.main === module) {
  runRollback().catch(console.error);
}

module.exports = {
  runRollback,
  rollbackUsdBalances,
  rollbackUsdAllocations,
  rollbackWriterUsdBalances,
  cleanupUsdCollections,
  usdCentsToTokens
};
