#!/usr/bin/env node

/**
 * Check WeWrite Migration Status
 * Verifies if the token to USD migration has been completed
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

async function checkMigrationStatus() {
  console.log('🔍 Checking WeWrite Migration Status');
  console.log('──────────────────────────────────────────────────');
  
  // Check token collections (should be empty after migration)
  console.log('\n📊 TOKEN COLLECTIONS (should be empty):');
  const tokenCollections = ['tokenBalances', 'DEV_tokenBalances', 'tokenAllocations', 'DEV_tokenAllocations'];
  
  let totalTokenDocs = 0;
  for (const collectionName of tokenCollections) {
    try {
      const snapshot = await db.collection(collectionName).get();
      console.log(`  ${collectionName}: ${snapshot.size} documents`);
      totalTokenDocs += snapshot.size;
    } catch (error) {
      console.log(`  ${collectionName}: Error - ${error.message}`);
    }
  }
  
  // Check USD collections (should have data after migration)
  console.log('\n💰 USD COLLECTIONS (should have data):');
  const usdCollections = ['usdBalances', 'DEV_usdBalances', 'usdAllocations', 'DEV_usdAllocations'];
  
  let totalUsdDocs = 0;
  for (const collectionName of usdCollections) {
    try {
      const snapshot = await db.collection(collectionName).get();
      console.log(`  ${collectionName}: ${snapshot.size} documents`);
      totalUsdDocs += snapshot.size;
      
      if (snapshot.size > 0) {
        // Show sample data
        const sampleDoc = snapshot.docs[0];
        const data = sampleDoc.data();
        console.log(`    Sample: ${sampleDoc.id}`);
        if (data.totalUsdCents !== undefined) {
          console.log(`    totalUsdCents: ${data.totalUsdCents} (${(data.totalUsdCents / 100).toFixed(2)} USD)`);
        }
        if (data.usdCents !== undefined) {
          console.log(`    usdCents: ${data.usdCents} (${(data.usdCents / 100).toFixed(2)} USD)`);
        }
      }
    } catch (error) {
      console.log(`  ${collectionName}: Error - ${error.message}`);
    }
  }
  
  // Check subscriptions (should be using USD amounts)
  console.log('\n💳 SUBSCRIPTIONS (should use USD amounts):');
  const subscriptionCollections = ['users', 'DEV_users'];
  
  for (const collectionName of subscriptionCollections) {
    try {
      const usersSnapshot = await db.collection(collectionName).limit(5).get();
      console.log(`  ${collectionName}: ${usersSnapshot.size} users checked`);
      
      for (const userDoc of usersSnapshot.docs) {
        const subscriptionSnapshot = await userDoc.ref.collection('subscriptions').get();
        if (subscriptionSnapshot.size > 0) {
          const subDoc = subscriptionSnapshot.docs[0];
          const subData = subDoc.data();
          console.log(`    User ${userDoc.id.substring(0, 8)}... has subscription:`);
          console.log(`      amount: ${subData.amount} USD`);
          console.log(`      status: ${subData.status}`);
        }
      }
    } catch (error) {
      console.log(`  ${collectionName}: Error - ${error.message}`);
    }
  }
  
  console.log('\n──────────────────────────────────────────────────');
  console.log('📋 MIGRATION STATUS SUMMARY:');
  console.log(`  Token collections: ${totalTokenDocs} documents`);
  console.log(`  USD collections: ${totalUsdDocs} documents`);
  
  if (totalTokenDocs === 0 && totalUsdDocs > 0) {
    console.log('✅ MIGRATION COMPLETE - System is using USD collections');
  } else if (totalTokenDocs > 0 && totalUsdDocs === 0) {
    console.log('❌ MIGRATION NEEDED - System still has token data');
  } else if (totalTokenDocs > 0 && totalUsdDocs > 0) {
    console.log('⚠️  HYBRID STATE - Both token and USD data exist');
  } else {
    console.log('❓ UNCLEAR STATE - No data found in either system');
  }
}

checkMigrationStatus().catch(console.error);
