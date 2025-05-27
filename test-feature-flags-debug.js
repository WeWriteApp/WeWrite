#!/usr/bin/env node

// Debug script to test feature flag system
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Testing feature flag system...');

// Check environment variables
console.log('Environment variables:');
console.log('- NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Set' : 'Missing');
console.log('- NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'Missing');

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

async function testFeatureFlags() {
  try {
    console.log('🚀 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('📄 Checking feature flags document...');
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);
    
    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      console.log('✅ Feature flags document exists:');
      console.log(JSON.stringify(flagsData, null, 2));
      
      // Check specific flags
      console.log('\n🔍 Specific flag status:');
      console.log('- payments:', flagsData.payments);
      console.log('- daily_notes:', flagsData.daily_notes);
      
      // Enable both flags for testing
      console.log('\n🔧 Enabling payments and daily_notes flags...');
      await updateDoc(featureFlagsRef, {
        payments: true,
        daily_notes: true
      });
      console.log('✅ Flags updated successfully!');
      
      // Verify the update
      const updatedDoc = await getDoc(featureFlagsRef);
      const updatedData = updatedDoc.data();
      console.log('\n✅ Updated feature flags:');
      console.log(JSON.stringify(updatedData, null, 2));
      
    } else {
      console.log('❌ Feature flags document does not exist');
      console.log('🔧 Creating feature flags document...');
      
      const defaultFlags = {
        payments: true,
        username_management: false,
        map_view: false,
        calendar_view: false,
        groups: true,
        notifications: false,
        link_functionality: true,
        daily_notes: true
      };
      
      await setDoc(featureFlagsRef, defaultFlags);
      console.log('✅ Feature flags document created with defaults:');
      console.log(JSON.stringify(defaultFlags, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error testing feature flags:', error);
    console.error('Error details:', error.message);
  }
}

// Run the script
testFeatureFlags().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});
