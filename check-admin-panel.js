// Script to check if the admin panel is dynamically loading feature flags from the database
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');

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

async function checkAndUpdateFeatureFlags() {
  try {
    // Get feature flags from Firestore
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      console.log('Current feature flags in database:', flagsData);
      
      // Check if admin_features flag exists
      if ('admin_features' in flagsData) {
        console.log('admin_features flag found in database with value:', flagsData.admin_features);
        
        // Create a new object without the admin_features flag
        const updatedFlagsData = { ...flagsData };
        delete updatedFlagsData.admin_features;
        
        console.log('Updated feature flags (without admin_features):', updatedFlagsData);
        
        // Update the database with the new object
        await setDoc(featureFlagsRef, updatedFlagsData);
        console.log('Successfully removed admin_features flag from database');
        
        // Verify the update
        const verifyDoc = await getDoc(featureFlagsRef);
        if (verifyDoc.exists()) {
          const verifyData = verifyDoc.data();
          console.log('Verified feature flags in database:', verifyData);
          
          if ('admin_features' in verifyData) {
            console.log('ERROR: admin_features flag still exists in the database');
          } else {
            console.log('SUCCESS: admin_features flag has been removed from the database');
          }
        }
      } else {
        console.log('admin_features flag NOT found in database, no action needed');
      }
    } else {
      console.log('No feature flags document found in database');
    }
  } catch (error) {
    console.error('Error checking/updating feature flags:', error);
  }
}

checkAndUpdateFeatureFlags();
