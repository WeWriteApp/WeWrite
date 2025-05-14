// Script to remove the admin_features flag from Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc, deleteField } = require('firebase/firestore');

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

async function removeAdminFeaturesFlag() {
  try {
    // Get feature flags from Firestore
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      console.log('Current feature flags in database:', flagsData);
      
      // Check if admin_features flag exists
      if ('admin_features' in flagsData) {
        console.log('admin_features flag found in database, removing it...');
        
        // Remove the admin_features flag
        await updateDoc(featureFlagsRef, {
          admin_features: deleteField()
        });
        
        console.log('admin_features flag successfully removed');
        
        // Verify the flag was removed
        const updatedDoc = await getDoc(featureFlagsRef);
        if (updatedDoc.exists()) {
          const updatedData = updatedDoc.data();
          console.log('Updated feature flags in database:', updatedData);
          
          if ('admin_features' in updatedData) {
            console.log('ERROR: admin_features flag still exists in the database');
          } else {
            console.log('Verified: admin_features flag no longer exists in the database');
          }
        }
      } else {
        console.log('admin_features flag NOT found in database, no action needed');
      }
    } else {
      console.log('No feature flags document found in database');
    }
  } catch (error) {
    console.error('Error removing admin_features flag:', error);
  }
}

removeAdminFeaturesFlag();
