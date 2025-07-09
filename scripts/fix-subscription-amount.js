#!/usr/bin/env node

/**
 * Script to fix missing subscription amount for specific user
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

async function fixSubscriptionAmount() {
  const userId = 'fWNeCuussPgYgkN2LGohFRCPXiy1'; // Your user ID
  const correctAmount = 10; // $10/mo
  
  console.log('🔧 Fixing subscription amount...');
  console.log(`User ID: ${userId}`);
  console.log(`Setting amount to: $${correctAmount}/mo`);
  
  try {
    // Get current subscription data
    const subRef = db.collection('users').doc(userId).collection('subscriptions').doc('current');
    const subDoc = await subRef.get();
    
    if (!subDoc.exists) {
      console.log('❌ Subscription document not found');
      return;
    }
    
    const currentData = subDoc.data();
    console.log('\n📋 Current subscription data:', JSON.stringify(currentData, null, 2));
    
    // Update with correct amount
    await subRef.update({
      amount: correctAmount,
      tier: 'tier1', // $10 = tier1
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      amountFixedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('\n✅ Updated subscription with correct amount');
    
    // Verify the update
    const updatedDoc = await subRef.get();
    const updatedData = updatedDoc.data();
    console.log('\n📋 Updated subscription data:', JSON.stringify(updatedData, null, 2));
    
  } catch (error) {
    console.error('❌ Error fixing subscription amount:', error);
  }
}

fixSubscriptionAmount().catch(console.error);
