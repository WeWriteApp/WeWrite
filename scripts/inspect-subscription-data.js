#!/usr/bin/env node

/**
 * Script to inspect subscription data across all collections
 * This helps debug where subscription data is actually stored
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!process.env.GOOGLE_CLOUD_KEY_JSON) {
  console.log('❌ GOOGLE_CLOUD_KEY_JSON not found in environment');
  process.exit(1);
}

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString());
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.log('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function findUserWithSubscriptions() {
  console.log('🔍 Searching for users with subscription data...\n');

  const collectionsToCheck = [
    'users',
    'dev_users'
  ];

  for (const collectionName of collectionsToCheck) {
    console.log(`📂 Checking collection: ${collectionName}`);

    try {
      const snapshot = await db.collection(collectionName).get();

      if (snapshot.empty) {
        console.log(`   ❌ Collection '${collectionName}' is empty or doesn't exist\n`);
        continue;
      }

      console.log(`   ✅ Found ${snapshot.size} total documents`);

      let usersWithSubscriptions = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Check for subscription fields directly on user document
        const subscriptionFields = ['subscription', 'subscriptionTier', 'subscriptionStatus', 'stripeCustomerId', 'stripeSubscriptionId'];
        const hasDirectSubscriptionData = subscriptionFields.some(field => data[field] !== undefined);

        if (hasDirectSubscriptionData) {
          console.log(`   👤 User: ${doc.id} (has direct subscription fields)`);
          console.log(`      Email: ${data.email || 'N/A'}`);
          console.log(`      Username: ${data.username || 'N/A'}`);
          subscriptionFields.forEach(field => {
            if (data[field] !== undefined) {
              console.log(`      ${field}: ${data[field]}`);
            }
          });
          console.log('');
          usersWithSubscriptions++;
        }

        // Check for subscription subcollections
        const subCollections = ['subscriptions'];

        for (const subCol of subCollections) {
          try {
            const subSnapshot = await db.collection(collectionName)
              .doc(doc.id)
              .collection(subCol)
              .get();

            if (!subSnapshot.empty) {
              usersWithSubscriptions++;

              console.log(`   👤 User: ${doc.id} (has ${subCol} subcollection)`);
              console.log(`      Email: ${data.email || 'N/A'}`);
              console.log(`      Username: ${data.username || 'N/A'}`);
              console.log(`      📋 ${subCol}: ${subSnapshot.size} subscription(s)`);

              subSnapshot.docs.forEach(subDoc => {
                const subData = subDoc.data();
                console.log(`         - ${subDoc.id}:`);
                console.log(`           status: ${subData.status}`);
                console.log(`           tier: ${subData.tier}`);
                console.log(`           amount: ${subData.amount}`);
                console.log(`           stripeCustomerId: ${subData.stripeCustomerId}`);
                console.log(`           migratedAt: ${subData.migratedAt?.toDate?.() || subData.migratedAt}`);
                console.log(`           migratedFrom: ${subData.migratedFrom}`);
              });
              console.log('');
            }
          } catch (subError) {
            // Subcollection doesn't exist, which is fine
          }
        }
      }

      if (usersWithSubscriptions === 0) {
        console.log(`   ❌ No users with subscriptions found in ${collectionName}\n`);
      } else {
        console.log(`   ✅ Found ${usersWithSubscriptions} users with subscriptions\n`);
      }

    } catch (error) {
      console.log(`   ❌ Error accessing collection '${collectionName}':`, error.message);
    }
  }
}

async function main() {
  try {
    await findUserWithSubscriptions();
    console.log('✅ Inspection completed!');
  } catch (error) {
    console.error('❌ Inspection failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
