// Script to enable payments feature flag for testing
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDoc } = require('firebase/firestore');

// Firebase config (using environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

async function enablePaymentsFlag() {
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Get current feature flags
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const currentFlags = featureFlagsDoc.data();
      console.log('Current feature flags:', currentFlags);

      // Update payments flag to true
      await updateDoc(featureFlagsRef, {
        payments: true
      });

      console.log('✅ Payments feature flag enabled successfully!');
    } else {
      console.log('❌ Feature flags document not found');
    }
  } catch (error) {
    console.error('❌ Error enabling payments flag:', error);
  }
}

enablePaymentsFlag();
