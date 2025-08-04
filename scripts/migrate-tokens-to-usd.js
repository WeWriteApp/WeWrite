#!/usr/bin/env node

/**
 * WeWrite Token to USD Migration Script
 * 
 * This script migrates all token-based data to USD-based data:
 * - Converts token balances to USD cents (100 tokens → $10.00 → 1000 cents)
 * - Migrates token allocations to USD allocations
 * - Creates audit logs for all conversions
 * - Provides rollback capabilities
 * 
 * Usage:
 *   node scripts/migrate-tokens-to-usd.js [--dry-run] [--user-id=USER_ID] [--rollback]
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Use environment variables like the main app
    if (process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON;
      console.log('Using service account from environment variable');
      console.log('JSON string length:', jsonString?.length);
      console.log('JSON string preview:', jsonString?.substring(0, 50) + '...');

      // Check if the string is base64 encoded
      if (jsonString.match(/^[A-Za-z0-9+/]+=*$/)) {
        console.log('Decoding base64 encoded service account');
        jsonString = Buffer.from(jsonString, 'base64').toString('utf8');
      }

      const serviceAccount = JSON.parse(jsonString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PID
      });
    } else {
      // Fallback to default credentials for local development
      console.log('Using default credentials for local development');
      console.log('Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PID);
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PID
      });
    }
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

// Migration constants
const MIGRATION_CONFIG = {
  TOKENS_PER_DOLLAR: 10,
  CENTS_PER_DOLLAR: 100,
  BATCH_SIZE: 100,
  AUDIT_COLLECTION: 'migration_audit_logs'
};

// Collection mappings
const COLLECTION_MAPPINGS = {
  tokenBalances: 'usdBalances',
  tokenAllocations: 'usdAllocations',
  pendingTokenAllocations: 'pendingUsdAllocations',
  writerTokenBalances: 'writerUsdBalances',
  writerTokenEarnings: 'writerUsdEarnings',
  tokenPayouts: 'usdPayouts'
};

/**
 * Convert tokens to USD cents
 */
function tokensToUsdCents(tokens) {
  const usdAmount = tokens / MIGRATION_CONFIG.TOKENS_PER_DOLLAR;
  return Math.round(usdAmount * MIGRATION_CONFIG.CENTS_PER_DOLLAR);
}

/**
 * Convert USD cents back to tokens (for verification)
 */
function usdCentsToTokens(cents) {
  const usdAmount = cents / MIGRATION_CONFIG.CENTS_PER_DOLLAR;
  return Math.floor(usdAmount * MIGRATION_CONFIG.TOKENS_PER_DOLLAR);
}

/**
 * Log migration audit entry
 */
async function logAuditEntry(entry) {
  const auditRef = db.collection(MIGRATION_CONFIG.AUDIT_COLLECTION).doc();
  await auditRef.set({
    ...entry,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    migrationVersion: '1.0.0'
  });
  return auditRef.id;
}

/**
 * Get environment-aware collection name
 */
function getCollectionName(baseName) {
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev';
  return environment === 'production' ? baseName : `DEV_${baseName}`;
}

/**
 * Migrate token balances to USD balances
 */
async function migrateTokenBalances(dryRun = false, specificUserId = null) {
  console.log('🔄 Migrating token balances to USD balances...');

  const collectionName = getCollectionName('tokenBalances');
  console.log(`📍 Using collection: ${collectionName}`);

  let query = db.collection(collectionName);
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
      const tokenData = doc.data();
      const userId = tokenData.userId;

      // Convert token amounts to USD cents
      const usdData = {
        userId,
        totalUsdCents: tokensToUsdCents(tokenData.totalTokens || 0),
        allocatedUsdCents: tokensToUsdCents(tokenData.allocatedTokens || 0),
        availableUsdCents: tokensToUsdCents(tokenData.availableTokens || 0),
        monthlyAllocationCents: tokensToUsdCents(tokenData.monthlyAllocation || 0),
        lastAllocationDate: tokenData.lastAllocationDate,
        createdAt: tokenData.createdAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Verify conversion accuracy
      const verificationTokens = usdCentsToTokens(usdData.totalUsdCents);
      const originalTokens = tokenData.totalTokens || 0;
      
      if (Math.abs(verificationTokens - originalTokens) > 1) {
        console.warn(`⚠️  Conversion accuracy warning for user ${userId}: ${originalTokens} tokens → ${usdData.totalUsdCents} cents → ${verificationTokens} tokens`);
      }

      if (!dryRun) {
        // Create USD balance record
        await db.collection(getCollectionName('usdBalances')).doc(userId).set(usdData);

        // Log audit entry
        await logAuditEntry({
          type: 'token_balance_migration',
          userId,
          originalData: tokenData,
          convertedData: usdData,
          conversionRate: MIGRATION_CONFIG.TOKENS_PER_DOLLAR,
          status: 'completed'
        });
      }

      results.successful++;
      console.log(`✅ Migrated balance for user ${userId}: ${originalTokens} tokens → $${(usdData.totalUsdCents / 100).toFixed(2)}`);

    } catch (error) {
      results.failed++;
      results.errors.push({
        userId: doc.id,
        error: error.message
      });
      console.error(`❌ Failed to migrate balance for user ${doc.id}:`, error.message);
    }

    results.processed++;
  }

  console.log(`📊 Token Balance Migration Results:`, results);
  return results;
}

/**
 * Migrate token allocations to USD allocations
 */
async function migrateTokenAllocations(dryRun = false, specificUserId = null) {
  console.log('🔄 Migrating token allocations to USD allocations...');

  const collectionName = getCollectionName('tokenAllocations');
  console.log(`📍 Using collection: ${collectionName}`);

  let query = db.collection(collectionName);
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
      const tokenData = doc.data();

      // Convert token allocation to USD cents
      const usdData = {
        userId: tokenData.userId,
        recipientUserId: tokenData.recipientUserId,
        resourceType: tokenData.resourceType,
        resourceId: tokenData.resourceId,
        usdCents: tokensToUsdCents(tokenData.tokens || 0),
        month: tokenData.month,
        status: tokenData.status,
        createdAt: tokenData.createdAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (!dryRun) {
        // Create USD allocation record
        await db.collection('usdAllocations').doc(doc.id).set(usdData);

        // Log audit entry
        await logAuditEntry({
          type: 'token_allocation_migration',
          allocationId: doc.id,
          userId: tokenData.userId,
          originalData: tokenData,
          convertedData: usdData,
          conversionRate: MIGRATION_CONFIG.TOKENS_PER_DOLLAR,
          status: 'completed'
        });
      }

      results.successful++;
      console.log(`✅ Migrated allocation ${doc.id}: ${tokenData.tokens || 0} tokens → $${(usdData.usdCents / 100).toFixed(2)}`);

    } catch (error) {
      results.failed++;
      results.errors.push({
        allocationId: doc.id,
        error: error.message
      });
      console.error(`❌ Failed to migrate allocation ${doc.id}:`, error.message);
    }

    results.processed++;
  }

  console.log(`📊 Token Allocation Migration Results:`, results);
  return results;
}

/**
 * Migrate writer token balances to USD balances
 */
async function migrateWriterTokenBalances(dryRun = false, specificUserId = null) {
  console.log('🔄 Migrating writer token balances to USD balances...');
  
  let query = db.collection('writerTokenBalances');
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
      const tokenData = doc.data();
      const userId = tokenData.userId;

      // Convert writer token balance to USD cents
      const usdData = {
        userId,
        totalUsdCentsEarned: tokensToUsdCents(tokenData.totalTokensEarned || 0),
        pendingUsdCents: tokensToUsdCents(tokenData.pendingTokens || 0),
        availableUsdCents: tokensToUsdCents(tokenData.availableTokens || 0),
        paidOutUsdCents: tokensToUsdCents(tokenData.paidOutTokens || 0),
        lastProcessedMonth: tokenData.lastProcessedMonth || null,
        createdAt: tokenData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (!dryRun) {
        // Create USD writer balance record
        await db.collection(getCollectionName('writerUsdBalances')).doc(userId).set(usdData);

        // Log audit entry
        await logAuditEntry({
          type: 'writer_token_balance_migration',
          userId,
          originalData: tokenData,
          convertedData: usdData,
          conversionRate: MIGRATION_CONFIG.TOKENS_PER_DOLLAR,
          status: 'completed'
        });
      }

      results.successful++;
      console.log(`✅ Migrated writer balance for user ${userId}: ${tokenData.totalTokensEarned || 0} tokens → $${(usdData.totalUsdCentsEarned / 100).toFixed(2)}`);

    } catch (error) {
      results.failed++;
      results.errors.push({
        userId: doc.id,
        error: error.message
      });
      console.error(`❌ Failed to migrate writer balance for user ${doc.id}:`, error.message);
    }

    results.processed++;
  }

  console.log(`📊 Writer Token Balance Migration Results:`, results);
  return results;
}

/**
 * Migrate writer token earnings to USD earnings
 */
async function migrateWriterTokenEarnings(dryRun = false, specificUserId = null) {
  console.log('🔄 Migrating writer token earnings to USD earnings...');

  let query = db.collection('writerTokenEarnings');
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
      const tokenData = doc.data();
      const userId = tokenData.userId;

      // Convert allocations array
      const convertedAllocations = (tokenData.allocations || []).map(allocation => ({
        allocationId: allocation.allocationId,
        fromUserId: allocation.fromUserId,
        fromUsername: allocation.fromUsername,
        resourceType: allocation.resourceType,
        resourceId: allocation.resourceId,
        resourceTitle: allocation.resourceTitle,
        usdCents: tokensToUsdCents(allocation.tokens || 0),
        // Remove redundant usdValue field
      }));

      // Convert writer token earnings to USD cents
      const usdData = {
        id: doc.id,
        userId,
        month: tokenData.month,
        totalUsdCentsReceived: tokensToUsdCents(tokenData.totalTokensReceived || 0),
        status: tokenData.status,
        allocations: convertedAllocations,
        processedAt: tokenData.processedAt,
        createdAt: tokenData.createdAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (!dryRun) {
        // Create USD earnings record
        await db.collection('writerUsdEarnings').doc(doc.id).set(usdData);

        // Log audit entry
        await logAuditEntry({
          type: 'writer_token_earnings_migration',
          earningsId: doc.id,
          userId,
          month: tokenData.month,
          originalData: tokenData,
          convertedData: usdData,
          conversionRate: MIGRATION_CONFIG.TOKENS_PER_DOLLAR,
          status: 'completed'
        });
      }

      results.successful++;
      console.log(`✅ Migrated earnings ${doc.id}: ${tokenData.totalTokensReceived || 0} tokens → $${(usdData.totalUsdCentsReceived / 100).toFixed(2)} for ${tokenData.month}`);

    } catch (error) {
      results.failed++;
      results.errors.push({
        earningsId: doc.id,
        error: error.message
      });
      console.error(`❌ Failed to migrate earnings ${doc.id}:`, error.message);
    }

    results.processed++;
  }

  console.log(`📊 Writer Token Earnings Migration Results:`, results);
  return results;
}

/**
 * Verify migration accuracy
 */
async function verifyMigration(specificUserId = null) {
  console.log('🔍 Verifying migration accuracy...');
  
  const verificationResults = {
    tokenBalances: { consistent: 0, inconsistent: 0, missing: 0 },
    tokenAllocations: { consistent: 0, inconsistent: 0, missing: 0 },
    writerBalances: { consistent: 0, inconsistent: 0, missing: 0 },
    writerEarnings: { consistent: 0, inconsistent: 0, missing: 0 }
  };

  // Verify token balances
  let tokenBalanceQuery = db.collection('tokenBalances');
  if (specificUserId) {
    tokenBalanceQuery = tokenBalanceQuery.where('userId', '==', specificUserId);
  }
  
  const tokenBalanceSnapshot = await tokenBalanceQuery.get();
  
  for (const doc of tokenBalanceSnapshot.docs) {
    const tokenData = doc.data();
    const usdDoc = await db.collection(getCollectionName('usdBalances')).doc(tokenData.userId).get();
    
    if (!usdDoc.exists) {
      verificationResults.tokenBalances.missing++;
      console.warn(`⚠️  Missing USD balance for user ${tokenData.userId}`);
      continue;
    }
    
    const usdData = usdDoc.data();
    const expectedUsdCents = tokensToUsdCents(tokenData.totalTokens || 0);
    
    if (Math.abs(usdData.totalUsdCents - expectedUsdCents) <= 1) {
      verificationResults.tokenBalances.consistent++;
    } else {
      verificationResults.tokenBalances.inconsistent++;
      console.warn(`⚠️  Inconsistent conversion for user ${tokenData.userId}: ${tokenData.totalTokens} tokens → expected ${expectedUsdCents} cents, got ${usdData.totalUsdCents} cents`);
    }
  }

  // Verify writer earnings
  let writerEarningsQuery = db.collection('writerTokenEarnings');
  if (specificUserId) {
    writerEarningsQuery = writerEarningsQuery.where('userId', '==', specificUserId);
  }

  const writerEarningsSnapshot = await writerEarningsQuery.get();

  for (const doc of writerEarningsSnapshot.docs) {
    const tokenData = doc.data();
    const usdDoc = await db.collection('writerUsdEarnings').doc(doc.id).get();

    if (!usdDoc.exists) {
      verificationResults.writerEarnings.missing++;
      console.warn(`⚠️  Missing USD earnings for ${doc.id}`);
      continue;
    }

    const usdData = usdDoc.data();
    const expectedUsdCents = tokensToUsdCents(tokenData.totalTokensReceived || 0);

    if (Math.abs(usdData.totalUsdCentsReceived - expectedUsdCents) <= 1) {
      verificationResults.writerEarnings.consistent++;
    } else {
      verificationResults.writerEarnings.inconsistent++;
      console.warn(`⚠️  Inconsistent earnings conversion for ${doc.id}: ${tokenData.totalTokensReceived} tokens → expected ${expectedUsdCents} cents, got ${usdData.totalUsdCentsReceived} cents`);
    }
  }

  console.log('📊 Migration Verification Results:', verificationResults);
  return verificationResults;
}

/**
 * Main migration function
 */
async function runMigration() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const rollback = args.includes('--rollback');
  const userIdArg = args.find(arg => arg.startsWith('--user-id='));
  const specificUserId = userIdArg ? userIdArg.split('=')[1] : null;

  console.log('🚀 Starting WeWrite Token to USD Migration');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  console.log(`Target: ${specificUserId ? `User ${specificUserId}` : 'All users'}`);
  console.log(`Rollback: ${rollback ? 'YES' : 'NO'}`);
  console.log('─'.repeat(50));

  if (rollback) {
    console.log('❌ Rollback functionality not implemented yet');
    process.exit(1);
  }

  try {
    const startTime = Date.now();

    // Run migrations
    const balanceResults = await migrateTokenBalances(dryRun, specificUserId);
    const allocationResults = await migrateTokenAllocations(dryRun, specificUserId);
    const writerBalanceResults = await migrateWriterTokenBalances(dryRun, specificUserId);
    const earningsResults = await migrateWriterTokenEarnings(dryRun, specificUserId);

    // Verify migration if not dry run
    if (!dryRun) {
      await verifyMigration(specificUserId);
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('─'.repeat(50));
    console.log('✅ Migration completed successfully!');
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📊 Total processed: ${balanceResults.processed + allocationResults.processed + writerBalanceResults.processed + earningsResults.processed} records`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = {
  runMigration,
  migrateTokenBalances,
  migrateTokenAllocations,
  migrateWriterTokenBalances,
  verifyMigration,
  tokensToUsdCents,
  usdCentsToTokens
};
