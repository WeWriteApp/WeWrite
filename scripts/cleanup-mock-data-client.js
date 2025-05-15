// This script uses the Firebase client SDK to clean up mock data
// It requires you to be authenticated with Firebase to run

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { getDatabase, ref, get, remove } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import readline from 'readline';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

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

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt for user credentials
function promptForCredentials() {
  return new Promise((resolve) => {
    rl.question('Enter your Firebase email: ', (email) => {
      rl.question('Enter your Firebase password: ', (password) => {
        resolve({ email, password });
      });
    });
  });
}

// Function to clean up Firestore mock data
async function cleanupFirestoreMockData() {
  console.log('Starting Firestore mock data cleanup...');
  
  // 1. Clean up mock pages
  console.log('Cleaning up mock pages...');
  
  // Delete known mock pages
  for (const pageId of knownMockPageIds) {
    try {
      // Check if page exists
      const pageDocRef = doc(firestore, 'pages', pageId);
      const pageDoc = await getDoc(pageDocRef);
      
      if (pageDoc.exists()) {
        // Delete all versions in the subcollection
        const versionsCollectionRef = collection(firestore, 'pages', pageId, 'versions');
        const versionsSnapshot = await getDocs(versionsCollectionRef);
        const batch = writeBatch(firestore);
        
        versionsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // Commit the batch delete for versions
        if (versionsSnapshot.docs.length > 0) {
          await batch.commit();
          console.log(`Deleted ${versionsSnapshot.docs.length} versions for page ${pageId}`);
        }
        
        // Delete the page document
        await deleteDoc(pageDocRef);
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
      const pagesCollectionRef = collection(firestore, 'pages');
      const q = query(pagesCollectionRef, where('userId', '==', mockUserId));
      const pagesSnapshot = await getDocs(q);
      
      if (!pagesSnapshot.empty) {
        console.log(`Found ${pagesSnapshot.docs.length} pages with mock user ID: ${mockUserId}`);
        
        for (const pageDoc of pagesSnapshot.docs) {
          // Delete all versions in the subcollection
          const versionsCollectionRef = collection(firestore, 'pages', pageDoc.id, 'versions');
          const versionsSnapshot = await getDocs(versionsCollectionRef);
          const batch = writeBatch(firestore);
          
          versionsSnapshot.docs.forEach(versionDoc => {
            batch.delete(versionDoc.ref);
          });
          
          // Commit the batch delete for versions
          if (versionsSnapshot.docs.length > 0) {
            await batch.commit();
            console.log(`Deleted ${versionsSnapshot.docs.length} versions for page ${pageDoc.id}`);
          }
          
          // Delete the page document
          await deleteDoc(pageDoc.ref);
          console.log(`Deleted page ${pageDoc.id} with mock user ID: ${mockUserId}`);
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
      const pagesCollectionRef = collection(firestore, 'pages');
      const q = query(pagesCollectionRef, where('username', '==', mockUsername));
      const pagesSnapshot = await getDocs(q);
      
      if (!pagesSnapshot.empty) {
        console.log(`Found ${pagesSnapshot.docs.length} pages with mock username: ${mockUsername}`);
        
        for (const pageDoc of pagesSnapshot.docs) {
          // Delete all versions in the subcollection
          const versionsCollectionRef = collection(firestore, 'pages', pageDoc.id, 'versions');
          const versionsSnapshot = await getDocs(versionsCollectionRef);
          const batch = writeBatch(firestore);
          
          versionsSnapshot.docs.forEach(versionDoc => {
            batch.delete(versionDoc.ref);
          });
          
          // Commit the batch delete for versions
          if (versionsSnapshot.docs.length > 0) {
            await batch.commit();
            console.log(`Deleted ${versionsSnapshot.docs.length} versions for page ${pageDoc.id}`);
          }
          
          // Delete the page document
          await deleteDoc(pageDoc.ref);
          console.log(`Deleted page ${pageDoc.id} with mock username: ${mockUsername}`);
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
      const userDocRef = doc(firestore, 'users', mockUserId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        await deleteDoc(userDocRef);
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
      const historyCollectionRef = collection(firestore, 'usernameHistory');
      const q = query(historyCollectionRef, where('userId', '==', mockUserId));
      const historySnapshot = await getDocs(q);
      
      if (!historySnapshot.empty) {
        console.log(`Found ${historySnapshot.docs.length} username history records for mock user ID: ${mockUserId}`);
        
        const batch = writeBatch(firestore);
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
      const userRef = ref(rtdb, `users/${mockUserId}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        await remove(userRef);
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
    const groupsRef = ref(rtdb, 'groups');
    const groupsSnapshot = await get(groupsRef);
    
    if (groupsSnapshot.exists()) {
      const groups = groupsSnapshot.val();
      
      for (const groupId in groups) {
        const group = groups[groupId];
        
        // Check if the group owner is a mock user
        if (knownMockUserIds.includes(group.owner)) {
          await remove(ref(rtdb, `groups/${groupId}`));
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
          await remove(ref(rtdb, `groups/${groupId}`));
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
    
    // Get user credentials
    const credentials = await promptForCredentials();
    
    // Sign in to Firebase
    await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    console.log('Successfully signed in to Firebase');
    
    // Clean up Firestore mock data
    await cleanupFirestoreMockData();
    
    // Clean up RTDB mock data
    await cleanupRTDBMockData();
    
    console.log('Mock data cleanup completed successfully!');
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during mock data cleanup:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the cleanup
cleanupMockData();
