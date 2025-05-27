#!/usr/bin/env node

// Script to enable feature flags for testing
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDoc, setDoc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function enableFeatureFlags() {
  try {
    console.log('🔧 Enabling feature flags for testing...');

    const featureFlagsRef = doc(db, 'config', 'featureFlags');

    // First check if document exists
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    const flagsToEnable = {
      payments: true,
      daily_notes: true,
      groups: true,
      link_functionality: true,
      username_management: false,
      map_view: false,
      calendar_view: false,
      notifications: false
    };

    if (featureFlagsDoc.exists()) {
      // Update existing document
      await updateDoc(featureFlagsRef, flagsToEnable);
      console.log('✅ Feature flags updated successfully!');
    } else {
      // Create new document
      await setDoc(featureFlagsRef, flagsToEnable);
      console.log('✅ Feature flags document created successfully!');
    }

    // Verify the update
    const updatedDoc = await getDoc(featureFlagsRef);
    const updatedData = updatedDoc.data();
    console.log('\n📋 Current feature flags:');
    Object.entries(updatedData).forEach(([flag, enabled]) => {
      console.log(`  ${flag}: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    });

  } catch (error) {
    console.error('❌ Error enabling feature flags:', error);
  }
}

// Run the script
enableFeatureFlags().then(() => {
  console.log('\n🏁 Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Script failed:', error);
  process.exit(1);
});
