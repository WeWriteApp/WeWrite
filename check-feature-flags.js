// Script to check feature flags in Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkFeatureFlags() {
  try {
    // Get feature flags from Firestore
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      console.log('Feature flags in database:', flagsData);
      
      // Check specifically for admin_features flag
      if ('admin_features' in flagsData) {
        console.log('admin_features flag found in database:', flagsData.admin_features);
      } else {
        console.log('admin_features flag NOT found in database');
      }
    } else {
      console.log('No feature flags document found in database');
    }
  } catch (error) {
    console.error('Error checking feature flags:', error);
  }
}

checkFeatureFlags();
