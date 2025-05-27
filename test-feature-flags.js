#!/usr/bin/env node

// Test script to verify feature flag functionality
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFeatureFlags() {
  try {
    console.log('🔍 Testing feature flags...');
    
    // Get current feature flags
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);
    
    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      console.log('📊 Current feature flags:', flagsData);
      
      // Check payments flag specifically
      const paymentsEnabled = flagsData.payments === true;
      console.log(`💳 Payments feature flag: ${paymentsEnabled ? 'ENABLED' : 'DISABLED'}`);
      
      if (!paymentsEnabled) {
        console.log('⚠️  Payments feature is currently disabled');
        console.log('💡 To enable payments, set the flag to true in Firestore');
      } else {
        console.log('✅ Payments feature is enabled');
      }
    } else {
      console.log('❌ No feature flags document found');
      console.log('🔧 Creating default feature flags...');
      
      await setDoc(featureFlagsRef, {
        payments: false,
        username_management: false,
        map_view: false,
        calendar_view: false,
        groups: true,
        notifications: false,
        link_functionality: true
      });
      
      console.log('✅ Default feature flags created');
    }
    
  } catch (error) {
    console.error('❌ Error testing feature flags:', error);
  }
}

// Run the test
testFeatureFlags().then(() => {
  console.log('🏁 Feature flag test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
