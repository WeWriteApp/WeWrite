#!/usr/bin/env node

/**
 * Script to enable the payments feature flag for testing pledge bar functionality
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function checkFeatureFlags() {
  try {
    console.log('Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('Checking current feature flags...');
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    let currentFlags = {};
    if (featureFlagsDoc.exists()) {
      currentFlags = featureFlagsDoc.data();
      console.log('✅ Current feature flags:', JSON.stringify(currentFlags, null, 2));

      // Check specifically for payments flag
      if (currentFlags.payments === true) {
        console.log('✅ Payments feature flag is ENABLED');
      } else {
        console.log('❌ Payments feature flag is DISABLED or not set');
      }
    } else {
      console.log('❌ No feature flags document found in Firebase');
    }

    return currentFlags;

  } catch (error) {
    console.error('❌ Error checking feature flags:', error);
    process.exit(1);
  }
}

async function enablePaymentsFeature() {
  try {
    console.log('Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('Checking current feature flags...');
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    let currentFlags = {};
    if (featureFlagsDoc.exists()) {
      currentFlags = featureFlagsDoc.data();
      console.log('Current feature flags:', currentFlags);
    } else {
      console.log('No feature flags document found, creating new one...');
    }

    // Enable payments feature flag
    const updatedFlags = {
      ...currentFlags,
      payments: true,
      map_view: currentFlags.map_view || false,
      calendar_view: currentFlags.calendar_view || false,
      groups: currentFlags.groups !== undefined ? currentFlags.groups : true,
      notifications: currentFlags.notifications || false,
      link_functionality: currentFlags.link_functionality !== undefined ? currentFlags.link_functionality : true,
      daily_notes: currentFlags.daily_notes || false
    };

    console.log('Updating feature flags...');
    await setDoc(featureFlagsRef, updatedFlags);

    console.log('✅ Payments feature flag enabled successfully!');
    console.log('Updated feature flags:', updatedFlags);
    console.log('\nPledge bars should now be visible on individual WeWrite pages.');
    console.log('Please refresh your browser to see the changes.');

  } catch (error) {
    console.error('❌ Error enabling payments feature flag:', error);
    process.exit(1);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'check') {
  // Run check function
  checkFeatureFlags();
} else {
  // Run enable function (default)
  enablePaymentsFeature();
}
