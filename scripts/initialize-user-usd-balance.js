#!/usr/bin/env node

/**
 * Initialize USD Balance for Existing Subscription Users
 * 
 * This script finds users with active subscriptions but missing USD balances
 * and initializes their USD balances based on their subscription amount.
 * 
 * Usage:
 *   node scripts/initialize-user-usd-balance.js [--user-id=USER_ID] [--dry-run]
 */

const admin = require('firebase-admin');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Use environment variables like the main app
    if (process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON) {
      let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON || process.env.LOGGING_CLOUD_KEY_JSON;
      console.log('Using service account from environment variable');

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

// Helper function to get collection name based on environment
function getCollectionName(baseName) {
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev';
  return environment === 'production' ? baseName : `${baseName}_dev`;
}

// Convert dollars to cents
function dollarsToCents(dollars) {
  return Math.round(dollars * 100);
}

// Get current month in YYYY-MM format
function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Initialize USD balance for a user with active subscription
 */
async function initializeUserUsdBalance(userId, subscriptionAmount, dryRun = false) {
  try {
    console.log(`\n🔄 Processing user ${userId}...`);
    
    // Check if USD balance already exists
    const usdBalanceRef = db.collection(getCollectionName('usdBalances')).doc(userId);
    const usdBalanceDoc = await usdBalanceRef.get();
    
    if (usdBalanceDoc.exists) {
      console.log(`✅ User ${userId} already has USD balance`);
      return { status: 'exists', userId };
    }
    
    // Calculate USD amounts
    const totalUsdCents = dollarsToCents(subscriptionAmount);
    const currentMonth = getCurrentMonth();
    
    const usdBalanceData = {
      userId,
      totalUsdCents,
      allocatedUsdCents: 0,
      availableUsdCents: totalUsdCents,
      monthlyAllocationCents: totalUsdCents,
      lastAllocationDate: currentMonth,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (!dryRun) {
      await usdBalanceRef.set(usdBalanceData);
      console.log(`✅ Created USD balance for user ${userId}: $${subscriptionAmount} (${totalUsdCents} cents)`);
    } else {
      console.log(`🔍 [DRY RUN] Would create USD balance for user ${userId}: $${subscriptionAmount} (${totalUsdCents} cents)`);
    }
    
    return { status: 'created', userId, amount: subscriptionAmount };
    
  } catch (error) {
    console.error(`❌ Error processing user ${userId}:`, error.message);
    return { status: 'error', userId, error: error.message };
  }
}

/**
 * Find users with active subscriptions but missing USD balances
 */
async function findUsersNeedingUsdBalance(specificUserId = null) {
  try {
    console.log('🔍 Finding users with active subscriptions...');
    
    const usersToProcess = [];
    
    if (specificUserId) {
      // Process specific user
      console.log(`🎯 Processing specific user: ${specificUserId}`);
      
      // Get user's subscription
      const subscriptionRef = db.collection(getCollectionName('users'))
        .doc(specificUserId)
        .collection(getCollectionName('subscriptions'))
        .doc('current');
      
      const subscriptionDoc = await subscriptionRef.get();
      
      if (!subscriptionDoc.exists) {
        console.log(`❌ No subscription found for user ${specificUserId}`);
        return [];
      }
      
      const subscriptionData = subscriptionDoc.data();
      if (subscriptionData.status !== 'active') {
        console.log(`❌ User ${specificUserId} has inactive subscription (${subscriptionData.status})`);
        return [];
      }
      
      usersToProcess.push({
        userId: specificUserId,
        amount: subscriptionData.amount || 0
      });
      
    } else {
      // Find all users with active subscriptions
      const usersSnapshot = await db.collection(getCollectionName('users')).get();
      
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        
        // Check for active subscription
        const subscriptionRef = userDoc.ref.collection(getCollectionName('subscriptions')).doc('current');
        const subscriptionDoc = await subscriptionRef.get();
        
        if (subscriptionDoc.exists) {
          const subscriptionData = subscriptionDoc.data();
          if (subscriptionData.status === 'active' && subscriptionData.amount > 0) {
            usersToProcess.push({
              userId,
              amount: subscriptionData.amount
            });
          }
        }
      }
    }
    
    console.log(`📊 Found ${usersToProcess.length} users with active subscriptions`);
    return usersToProcess;
    
  } catch (error) {
    console.error('❌ Error finding users:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const userIdArg = args.find(arg => arg.startsWith('--user-id='));
  const specificUserId = userIdArg ? userIdArg.split('=')[1] : null;
  
  console.log('🚀 Starting USD Balance Initialization');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Environment: ${process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev'}`);
  console.log(`Target: ${specificUserId ? `User ${specificUserId}` : 'All users with active subscriptions'}`);
  console.log('─'.repeat(60));
  
  try {
    // Find users needing USD balance initialization
    const usersToProcess = await findUsersNeedingUsdBalance(specificUserId);
    
    if (usersToProcess.length === 0) {
      console.log('✅ No users need USD balance initialization');
      return;
    }
    
    // Process each user
    const results = {
      created: 0,
      exists: 0,
      errors: 0,
      details: []
    };
    
    for (const { userId, amount } of usersToProcess) {
      const result = await initializeUserUsdBalance(userId, amount, dryRun);
      results.details.push(result);
      
      switch (result.status) {
        case 'created':
          results.created++;
          break;
        case 'exists':
          results.exists++;
          break;
        case 'error':
          results.errors++;
          break;
      }
    }
    
    // Summary
    console.log('\n' + '─'.repeat(60));
    console.log('📊 SUMMARY');
    console.log(`✅ Created: ${results.created}`);
    console.log(`ℹ️  Already existed: ${results.exists}`);
    console.log(`❌ Errors: ${results.errors}`);
    console.log(`📋 Total processed: ${usersToProcess.length}`);
    
    if (results.errors > 0) {
      console.log('\n❌ ERRORS:');
      results.details
        .filter(r => r.status === 'error')
        .forEach(r => console.log(`  - ${r.userId}: ${r.error}`));
    }
    
    if (dryRun) {
      console.log('\n🔍 This was a dry run. Use without --dry-run to actually create USD balances.');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
