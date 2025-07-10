#!/usr/bin/env node

/**
 * Script to fix missing stripeSubscriptionId fields by looking them up from Stripe
 */

const admin = require('firebase-admin');
const Stripe = require('stripe');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString());
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
  });
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = admin.firestore();

async function fixMissingSubscriptionIds() {
  console.log('🔧 Fixing missing stripeSubscriptionId fields...');
  
  try {
    // Get all users with subscription subcollections
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Check if user has subscription subcollection
      const subDoc = await db.collection('users').doc(userId).collection('subscriptions').doc('current').get();
      
      if (subDoc.exists) {
        const subData = subDoc.data();
        
        // If stripeSubscriptionId is missing but stripeCustomerId exists
        if (!subData.stripeSubscriptionId && subData.stripeCustomerId) {
          console.log(`\n👤 User: ${userId}`);
          console.log(`   Customer ID: ${subData.stripeCustomerId}`);
          console.log(`   Missing subscription ID, looking up from Stripe...`);
          
          try {
            // Get subscriptions for this customer from Stripe
            const subscriptions = await stripe.subscriptions.list({
              customer: subData.stripeCustomerId,
              status: 'active',
              limit: 1
            });
            
            if (subscriptions.data.length > 0) {
              const stripeSubscription = subscriptions.data[0];
              console.log(`   ✅ Found active subscription: ${stripeSubscription.id}`);
              
              // Update the subscription document with the missing ID
              await db.collection('users').doc(userId).collection('subscriptions').doc('current').update({
                stripeSubscriptionId: stripeSubscription.id,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              
              console.log(`   ✅ Updated subscription document with ID`);
            } else {
              console.log(`   ⚠️  No active subscriptions found for customer`);
            }
          } catch (stripeError) {
            console.error(`   ❌ Error fetching from Stripe:`, stripeError.message);
          }
        }
      }
    }
    
    console.log('\n✅ Finished fixing subscription IDs');
    
  } catch (error) {
    console.error('❌ Error fixing subscription IDs:', error);
  }
}

fixMissingSubscriptionIds().catch(console.error);
