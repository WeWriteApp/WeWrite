#!/usr/bin/env node

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString());
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
  });
}

const db = admin.firestore();

async function checkSubscription() {
  const userId = 'fWNeCuussPgYgkN2LGohFRCPXiy1';
  const subDoc = await db.collection('users').doc(userId).collection('subscriptions').doc('current').get();
  
  if (subDoc.exists) {
    const data = subDoc.data();
    console.log('Current subscription data:');
    console.log('stripeSubscriptionId:', data.stripeSubscriptionId);
    console.log('stripeCustomerId:', data.stripeCustomerId);
    console.log('status:', data.status);
    console.log('amount:', data.amount);
    console.log('tier:', data.tier);
  } else {
    console.log('No subscription found');
  }
}

checkSubscription().catch(console.error);
