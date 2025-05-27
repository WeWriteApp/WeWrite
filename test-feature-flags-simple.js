#!/usr/bin/env node

// Simple test to enable feature flags
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Testing feature flags...');

// Check if environment variables are loaded
if (!process.env.NEXT_PUBLIC_FIREBASE_PID) {
  console.error('❌ Firebase environment variables not loaded');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log('Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PID);

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

async function testFeatureFlags() {
  try {
    console.log('🚀 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('✅ Firebase initialized');

    console.log('📄 Setting up feature flags...');
    const featureFlagsRef = doc(db, 'config', 'featureFlags');

    // Enable both payments and daily_notes for testing
    const testFlags = {
      payments: true,
      daily_notes: true,
      groups: true,
      link_functionality: true,
      username_management: false,
      map_view: false,
      calendar_view: false,
      notifications: false
    };

    await setDoc(featureFlagsRef, testFlags);
    console.log('✅ Feature flags set successfully');

    // Verify the flags were set
    const doc_snapshot = await getDoc(featureFlagsRef);
    if (doc_snapshot.exists()) {
      const data = doc_snapshot.data();
      console.log('\n📋 Current feature flags in database:');
      Object.entries(data).forEach(([flag, enabled]) => {
        console.log(`  ${flag}: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
      });
    }

    console.log('\n🎉 Feature flags test completed successfully!');
    console.log('💡 You can now test the application at http://localhost:3000');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error details:', error.message);
  }
}

testFeatureFlags().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
