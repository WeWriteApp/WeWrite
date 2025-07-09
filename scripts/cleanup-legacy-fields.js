#!/usr/bin/env node

/**
 * Script to clean up legacy subscription fields from user documents
 * Run this after migration is complete and verified working
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || !args.includes('--execute');

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

async function cleanupLegacyFields() {
  console.log('🧹 Cleaning up legacy subscription fields...');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
  } else {
    console.log('⚠️  LIVE CLEANUP MODE - Legacy fields will be removed');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  const legacyFields = ['subscriptionStatus', 'subscriptionTier', 'subscriptionAmount', 'stripeCustomerId', 'stripeSubscriptionId'];
  
  try {
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Scanning ${usersSnapshot.size} user documents...`);
    
    let usersWithLegacyFields = 0;
    let totalFieldsRemoved = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      // Check which legacy fields exist
      const existingLegacyFields = legacyFields.filter(field => userData[field] !== undefined);
      
      if (existingLegacyFields.length > 0) {
        usersWithLegacyFields++;
        
        console.log(`\n👤 User: ${userId} (${userData.email || 'no email'})`);
        console.log(`   Legacy fields: ${existingLegacyFields.join(', ')}`);
        
        if (dryRun) {
          console.log(`   🔍 [DRY RUN] Would remove ${existingLegacyFields.length} legacy fields`);
        } else {
          // Create update object to remove legacy fields
          const updateData = {};
          existingLegacyFields.forEach(field => {
            updateData[field] = admin.firestore.FieldValue.delete();
          });
          
          // Update user document to remove legacy fields
          await db.collection('users').doc(userId).update(updateData);
          console.log(`   🗑️  Removed ${existingLegacyFields.length} legacy fields`);
          totalFieldsRemoved += existingLegacyFields.length;
        }
      }
    }
    
    console.log('\n📈 Cleanup Summary:');
    console.log(`   Users with legacy fields: ${usersWithLegacyFields}`);
    if (!dryRun) {
      console.log(`   Total fields removed: ${totalFieldsRemoved}`);
    }
    
    if (dryRun) {
      console.log('\n💡 To perform the actual cleanup, run:');
      console.log('   node scripts/cleanup-legacy-fields.js --execute');
    } else {
      console.log('\n✅ Legacy field cleanup completed!');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupLegacyFields().catch(console.error);
