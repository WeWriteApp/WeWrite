#!/usr/bin/env node

/**
 * Migration script to move subscription data from legacy user document fields to subcollections
 *
 * This script:
 * 1. Finds all users with legacy subscription fields (subscriptionStatus, subscriptionTier, etc.)
 * 2. Migrates this data to the standardized subcollection format (users/{userId}/subscriptions/current)
 * 3. Preserves all subscription data and metadata
 * 4. Optionally removes legacy fields after successful migration
 *
 * Usage:
 *   node scripts/migrate-subscription-data.js --dry-run
 *   node scripts/migrate-subscription-data.js --execute
 *   node scripts/migrate-subscription-data.js --execute --cleanup
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--execute');
const cleanup = args.includes('--cleanup');

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

/**
 * Find all users with legacy subscription data on their user documents
 */
async function findUsersWithLegacySubscriptions() {
  console.log('🔍 Scanning for users with legacy subscription data...');

  const users = [];
  const usersSnapshot = await db.collection('users').get();

  console.log(`📊 Scanning ${usersSnapshot.size} user documents...`);

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();

    // Check for legacy subscription fields
    const legacyFields = ['subscriptionStatus', 'subscriptionTier', 'subscriptionAmount', 'stripeCustomerId', 'stripeSubscriptionId'];
    const hasLegacyData = legacyFields.some(field => userData[field] !== undefined);

    if (hasLegacyData) {
      // Extract legacy subscription data
      const legacySubscription = {
        status: userData.subscriptionStatus || null,
        tier: userData.subscriptionTier || null,
        amount: userData.subscriptionAmount || null,
        stripeCustomerId: userData.stripeCustomerId || null,
        stripeSubscriptionId: userData.stripeSubscriptionId || null,
        // Add timestamps if available
        createdAt: userData.subscriptionCreatedAt || userData.createdAt || null,
        updatedAt: userData.subscriptionUpdatedAt || userData.lastModified || null
      };

      users.push({
        userId,
        userData,
        legacySubscription,
        legacyFields: legacyFields.filter(field => userData[field] !== undefined)
      });

      console.log(`📋 Found user ${userId} (${userData.email || 'no email'}) with legacy subscription:`);
      console.log(`    Status: ${legacySubscription.status}`);
      console.log(`    Tier: ${legacySubscription.tier}`);
      console.log(`    Amount: ${legacySubscription.amount}`);
      console.log(`    Stripe Customer: ${legacySubscription.stripeCustomerId}`);
    }
  }

  return users;
}

/**
 * Migrate a single user's legacy subscription data to subcollection
 */
async function migrateUserSubscription(user, dryRun) {
  const { userId, userData, legacySubscription, legacyFields } = user;

  console.log(`\n👤 Migrating user: ${userId}`);
  console.log(`   Email: ${userData.email || 'N/A'}`);
  console.log(`   Username: ${userData.username || 'N/A'}`);
  console.log(`   Legacy fields: ${legacyFields.join(', ')}`);

  if (dryRun) {
    console.log('   🔍 [DRY RUN] Would create subscription subcollection:');
    console.log(`       Path: users/${userId}/subscriptions/current`);
    console.log(`       Data:`, JSON.stringify(legacySubscription, null, 8));
    return { success: true, migrated: 1 };
  }

  try {
    // Check if subcollection already exists
    const userRef = db.collection('users').doc(userId);
    const existingSubDoc = await userRef.collection('subscriptions').doc('current').get();

    if (existingSubDoc.exists) {
      console.log('   ⚠️  Subscription subcollection already exists, skipping migration');
      console.log(`       Existing data:`, existingSubDoc.data());
      return { success: true, migrated: 0, skipped: true };
    }

    // Create subscription subcollection document
    await userRef.collection('subscriptions').doc('current').set({
      ...legacySubscription,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedFrom: 'legacy_user_document'
    });

    console.log('   ✅ Created subscription subcollection document');
    console.log(`       Path: users/${userId}/subscriptions/current`);

    return { success: true, migrated: 1 };
  } catch (error) {
    console.error(`   ❌ Error migrating user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up legacy subscription fields from user document after successful migration
 */
async function cleanupLegacyFields(user, dryRun) {
  const { userId, legacyFields } = user;

  if (dryRun) {
    console.log(`   🔍 [DRY RUN] Would remove legacy fields: ${legacyFields.join(', ')}`);
    return;
  }

  try {
    // Create update object to remove legacy fields
    const updateData = {};
    legacyFields.forEach(field => {
      updateData[field] = admin.firestore.FieldValue.delete();
    });

    // Update user document to remove legacy fields
    await db.collection('users').doc(userId).update(updateData);
    console.log(`   🗑️  Removed legacy fields: ${legacyFields.join(', ')}`);
  } catch (error) {
    console.error(`   ❌ Error cleaning up legacy fields for ${userId}:`, error);
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Subscription Data Migration Tool');
  console.log('=====================================\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
  } else {
    console.log('⚠️  LIVE MIGRATION MODE - Changes will be made to your database');
    console.log('   Make sure you have a backup before proceeding!');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  try {
    // Find users with legacy subscription data
    const users = await findUsersWithLegacySubscriptions();

    if (users.length === 0) {
      console.log('\n✅ No legacy subscription data found. Migration not needed.');
      return;
    }

    console.log(`\n📊 Found ${users.length} user(s) with legacy subscription data`);

    // Migrate each user
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const user of users) {
      const result = await migrateUserSubscription(user, dryRun);

      if (result.success) {
        if (result.skipped) {
          totalSkipped++;
        } else {
          totalMigrated += result.migrated;

          // Clean up legacy fields if requested and migration was successful
          if (cleanup && !dryRun && result.migrated > 0) {
            await cleanupLegacyFields(user, dryRun);
          }
        }
      } else {
        totalErrors++;
      }

      // Small delay between users
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Users processed: ${users.length}`);
    console.log(`   Subscriptions migrated: ${totalMigrated}`);
    console.log(`   Subscriptions skipped (already exist): ${totalSkipped}`);
    console.log(`   Errors: ${totalErrors}`);

    if (dryRun) {
      console.log('\n💡 To perform the actual migration, run:');
      console.log('   node scripts/migrate-subscription-data.js --execute');
      if (!cleanup) {
        console.log('\n💡 To also clean up legacy fields after migration, add:');
        console.log('   node scripts/migrate-subscription-data.js --execute --cleanup');
      }
    } else {
      console.log('\n✅ Migration completed!');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);
