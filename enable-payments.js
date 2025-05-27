#!/usr/bin/env node

// Script to enable payments feature flag
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDoc } = require('firebase/firestore');
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

async function enablePayments() {
  try {
    console.log('🔧 Enabling payments feature flag...');
    
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    
    // First check if document exists
    const featureFlagsDoc = await getDoc(featureFlagsRef);
    
    if (featureFlagsDoc.exists()) {
      // Update existing document
      await updateDoc(featureFlagsRef, {
        payments: true
      });
      console.log('✅ Payments feature flag enabled successfully!');
    } else {
      console.log('❌ Feature flags document does not exist');
      console.log('💡 Please run the setup script first or create the document manually');
    }
    
  } catch (error) {
    console.error('❌ Error enabling payments:', error);
  }
}

// Run the script
enablePayments().then(() => {
  console.log('🏁 Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
