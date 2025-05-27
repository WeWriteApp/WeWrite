const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with fallback for missing service account file
let serviceAccount;
try {
  // Try to load from file first (for local development)
  const serviceAccountPath = path.join(__dirname, '..', 'wewrite-ccd82-firebase-adminsdk-tmduq-90269daa53.json');

  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
    console.log('Using service account file for Firebase Admin initialization');
  } else {
    throw new Error('Service account file not found');
  }
} catch (error) {
  // Fallback to environment variables (for Vercel/production)
  console.log('Service account file not found, using environment variables...');

  if (process.env.GOOGLE_CLOUD_KEY_JSON) {
    serviceAccount = JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON);
  } else {
    // Create service account from individual environment variables
    serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wewrite-ccd82',
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
    };
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://wewrite-ccd82-default-rtdb.firebaseio.com"
});

// Get database references
const firestore = admin.firestore();
const rtdb = admin.database();

// Known mock page IDs from the codebase
const knownMockPageIds = [
  'zRNwhNgIEfLFo050nyAT', // Roadmap page
  'RFsPq1tbcOMtljwHyIMT', // Every Page is a Fundraiser
  'aJFMqTEKuNEHvOrYE9c2', // No ads
  'ou1LPmpynpoirLrv99fq', // Multiple view modes
  'o71h6Lg1wjGSC1pYaKXz', // Recurring donations
  '4jw8FdMJHGofMc4G2QTw', // Collaborative pages
  'N7Pg3iJ0OQhkpw16MTZW', // Map view
  '0krXqAU748w43YnWJwE2'  // Calendar view
];

// Known mock user IDs from the codebase
const knownMockUserIds = [
  'sample-user-1',
  'sample-user-2',
  'sample-user-3',
  'sample-user-4',
  'sample-user-5',
  'sample-user-6',
  'sample-user-7',
  'test-user-id',
  'mock-user-1',
  'mock-user-2',
  'mock-user-3',
  'mock-user-4',
  'mock-user-5',
  'mock-user-6',
  'mock-user-7',
  'mock-user-8',
  'mock-user-9',
  'mock-user-10'
];

// Known mock usernames from the codebase
const knownMockUsernames = [
  'writingpro',
  'storycrafter',
  'wordsmith',
  'contentcreator',
  'novelista',
  'poetrymaster',
  'techwriter',
  'blogexpert',
  'journalkeeper',
  'essayist',
  'bookworm',
  'bookreader',
  'bookauthor',
  'bookcritic',
  'WeWrite Team',
  'Developer',
  'WritingCoach',
  'Teacher',
  'TechWriter'
];

// Function to clean up Firestore mock data
async function cleanupFirestoreMockData() {
  console.log('Starting Firestore mock data cleanup...');

  // 1. Clean up mock pages
  console.log('Cleaning up mock pages...');

  // Delete known mock pages
  for (const pageId of knownMockPageIds) {
    try {
      // Check if page exists
      const pageDoc = await firestore.collection('pages').doc(pageId).get();

      if (pageDoc.exists) {
        // Delete all versions in the subcollection
        const versionsSnapshot = await firestore.collection('pages').doc(pageId).collection('versions').get();
        const batch = firestore.batch();

        versionsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        // Commit the batch delete for versions
        if (versionsSnapshot.docs.length > 0) {
          await batch.commit();
          console.log(`Deleted ${versionsSnapshot.docs.length} versions for page ${pageId}`);
        }

        // Delete the page document
        await firestore.collection('pages').doc(pageId).delete();
        console.log(`Deleted mock page: ${pageId}`);
      } else {
        console.log(`Mock page ${pageId} not found, skipping`);
      }
    } catch (error) {
      console.error(`Error deleting mock page ${pageId}:`, error);
    }
  }

  // 2. Find and delete pages with mock user IDs
  console.log('Finding and deleting pages with mock user IDs...');

  for (const mockUserId of knownMockUserIds) {
    try {
      const pagesSnapshot = await firestore.collection('pages').where('userId', '==', mockUserId).get();

      if (!pagesSnapshot.empty) {
        console.log(`Found ${pagesSnapshot.docs.length} pages with mock user ID: ${mockUserId}`);

        for (const doc of pagesSnapshot.docs) {
          // Delete all versions in the subcollection
          const versionsSnapshot = await firestore.collection('pages').doc(doc.id).collection('versions').get();
          const batch = firestore.batch();

          versionsSnapshot.docs.forEach(versionDoc => {
            batch.delete(versionDoc.ref);
          });

          // Commit the batch delete for versions
          if (versionsSnapshot.docs.length > 0) {
            await batch.commit();
            console.log(`Deleted ${versionsSnapshot.docs.length} versions for page ${doc.id}`);
          }

          // Delete the page document
          await doc.ref.delete();
          console.log(`Deleted page ${doc.id} with mock user ID: ${mockUserId}`);
        }
      } else {
        console.log(`No pages found with mock user ID: ${mockUserId}`);
      }
    } catch (error) {
      console.error(`Error deleting pages for mock user ${mockUserId}:`, error);
    }
  }

  // 3. Find and delete pages with mock usernames
  console.log('Finding and deleting pages with mock usernames...');

  for (const mockUsername of knownMockUsernames) {
    try {
      const pagesSnapshot = await firestore.collection('pages').where('username', '==', mockUsername).get();

      if (!pagesSnapshot.empty) {
        console.log(`Found ${pagesSnapshot.docs.length} pages with mock username: ${mockUsername}`);

        for (const doc of pagesSnapshot.docs) {
          // Delete all versions in the subcollection
          const versionsSnapshot = await firestore.collection('pages').doc(doc.id).collection('versions').get();
          const batch = firestore.batch();

          versionsSnapshot.docs.forEach(versionDoc => {
            batch.delete(versionDoc.ref);
          });

          // Commit the batch delete for versions
          if (versionsSnapshot.docs.length > 0) {
            await batch.commit();
            console.log(`Deleted ${versionsSnapshot.docs.length} versions for page ${doc.id}`);
          }

          // Delete the page document
          await doc.ref.delete();
          console.log(`Deleted page ${doc.id} with mock username: ${mockUsername}`);
        }
      } else {
        console.log(`No pages found with mock username: ${mockUsername}`);
      }
    } catch (error) {
      console.error(`Error deleting pages for mock username ${mockUsername}:`, error);
    }
  }

  // 4. Clean up mock users
  console.log('Cleaning up mock users...');

  for (const mockUserId of knownMockUserIds) {
    try {
      const userDoc = await firestore.collection('users').doc(mockUserId).get();

      if (userDoc.exists) {
        await firestore.collection('users').doc(mockUserId).delete();
        console.log(`Deleted mock user: ${mockUserId}`);
      } else {
        console.log(`Mock user ${mockUserId} not found in Firestore, skipping`);
      }
    } catch (error) {
      console.error(`Error deleting mock user ${mockUserId} from Firestore:`, error);
    }
  }

  // 5. Clean up username history for mock users
  console.log('Cleaning up username history for mock users...');

  for (const mockUserId of knownMockUserIds) {
    try {
      const historySnapshot = await firestore.collection('usernameHistory').where('userId', '==', mockUserId).get();

      if (!historySnapshot.empty) {
        console.log(`Found ${historySnapshot.docs.length} username history records for mock user ID: ${mockUserId}`);

        const batch = firestore.batch();
        historySnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Deleted ${historySnapshot.docs.length} username history records for mock user ID: ${mockUserId}`);
      } else {
        console.log(`No username history found for mock user ID: ${mockUserId}`);
      }
    } catch (error) {
      console.error(`Error deleting username history for mock user ${mockUserId}:`, error);
    }
  }

  console.log('Firestore mock data cleanup completed.');
}

// Function to clean up RTDB mock data
async function cleanupRTDBMockData() {
  console.log('Starting RTDB mock data cleanup...');

  // 1. Clean up mock users in RTDB
  console.log('Cleaning up mock users in RTDB...');

  for (const mockUserId of knownMockUserIds) {
    try {
      const userRef = rtdb.ref(`users/${mockUserId}`);
      const snapshot = await userRef.once('value');

      if (snapshot.exists()) {
        await userRef.remove();
        console.log(`Deleted mock user from RTDB: ${mockUserId}`);
      } else {
        console.log(`Mock user ${mockUserId} not found in RTDB, skipping`);
      }
    } catch (error) {
      console.error(`Error deleting mock user ${mockUserId} from RTDB:`, error);
    }
  }

  // 2. Clean up groups created by mock users
  console.log('Cleaning up groups created by mock users...');

  try {
    const groupsRef = rtdb.ref('groups');
    const groupsSnapshot = await groupsRef.once('value');

    if (groupsSnapshot.exists()) {
      const groups = groupsSnapshot.val();

      for (const groupId in groups) {
        const group = groups[groupId];

        // Check if the group owner is a mock user
        if (knownMockUserIds.includes(group.owner)) {
          await groupsRef.child(groupId).remove();
          console.log(`Deleted group ${groupId} owned by mock user: ${group.owner}`);
        }
        // Check if the group has a mock name or description
        else if (
          group.name && group.name.toLowerCase().includes('test') ||
          group.name && group.name.toLowerCase().includes('mock') ||
          group.name && group.name.toLowerCase().includes('sample') ||
          group.description && group.description.toLowerCase().includes('test') ||
          group.description && group.description.toLowerCase().includes('mock') ||
          group.description && group.description.toLowerCase().includes('sample')
        ) {
          await groupsRef.child(groupId).remove();
          console.log(`Deleted group ${groupId} with mock name/description: ${group.name}`);
        }
      }
    } else {
      console.log('No groups found in RTDB');
    }
  } catch (error) {
    console.error('Error cleaning up groups:', error);
  }

  console.log('RTDB mock data cleanup completed.');
}

// Main function to run the cleanup
async function cleanupMockData() {
  try {
    console.log('Starting mock data cleanup...');

    // Clean up Firestore mock data
    await cleanupFirestoreMockData();

    // Clean up RTDB mock data
    await cleanupRTDBMockData();

    console.log('Mock data cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during mock data cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupMockData();
