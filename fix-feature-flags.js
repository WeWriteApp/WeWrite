// Script to fix feature flags in Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local file
const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading environment variables from ${envPath}`);

let envVars = {};
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1]] = match[2];
    }
  });
  console.log('Loaded environment variables:', Object.keys(envVars));
} else {
  console.log('No .env.local file found');
}

// Firebase configuration
const firebaseConfig = {
  apiKey: envVars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: envVars.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: envVars.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Define valid feature flags
const validFeatureFlags = [
  'payments',
  'username_management',
  'map_view',
  'calendar_view',
  'groups'
];

async function fixFeatureFlags() {
  try {
    console.log('Starting feature flag fix script...');
    console.log('Firebase config:', {
      projectId: firebaseConfig.projectId,
      measurementId: firebaseConfig.measurementId,
      hasApiKey: !!firebaseConfig.apiKey,
      hasAppId: !!firebaseConfig.appId,
      hasDatabaseURL: !!firebaseConfig.databaseURL,
      databaseURL: firebaseConfig.databaseURL
    });

    // Get feature flags from Firestore
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      console.log('Current feature flags in database:', flagsData);

      // Create a new object with only valid flags
      const validFlags = {};

      // Copy only valid flags
      validFeatureFlags.forEach(flag => {
        if (flag in flagsData) {
          validFlags[flag] = flagsData[flag];
        } else {
          // Initialize missing flags as disabled
          validFlags[flag] = false;
          console.log(`Adding missing flag '${flag}' as disabled`);
        }
      });

      // Check for invalid flags
      Object.keys(flagsData).forEach(flag => {
        if (!validFeatureFlags.includes(flag)) {
          console.log(`Removing invalid flag '${flag}' from database`);
        }
      });

      // Update the database with only valid flags
      await setDoc(featureFlagsRef, validFlags);
      console.log('Updated feature flags in database:', validFlags);

      // Verify the update
      const updatedDoc = await getDoc(featureFlagsRef);
      if (updatedDoc.exists()) {
        const updatedData = updatedDoc.data();
        console.log('Verified feature flags in database:', updatedData);

        // Check if all valid flags are present
        const allFlagsPresent = validFeatureFlags.every(flag => flag in updatedData);
        console.log(`All valid flags present: ${allFlagsPresent}`);

        // Check if any invalid flags are present
        const invalidFlagsPresent = Object.keys(updatedData).some(flag => !validFeatureFlags.includes(flag));
        console.log(`Invalid flags present: ${invalidFlagsPresent}`);

        if (allFlagsPresent && !invalidFlagsPresent) {
          console.log('SUCCESS: Feature flags have been fixed successfully');
        } else {
          console.log('ERROR: Feature flags were not fixed correctly');
        }
      }
    } else {
      console.log('No feature flags document found in database, creating it');

      // Create a new document with all valid flags disabled
      const initialFlags = {};
      validFeatureFlags.forEach(flag => {
        initialFlags[flag] = false;
      });

      await setDoc(featureFlagsRef, initialFlags);
      console.log('Created feature flags document with all flags disabled:', initialFlags);

      // Verify the creation
      const createdDoc = await getDoc(featureFlagsRef);
      if (createdDoc.exists()) {
        console.log('Verified created feature flags:', createdDoc.data());
      }
    }
  } catch (error) {
    console.error('Error fixing feature flags:', error);
  }
}

fixFeatureFlags();
