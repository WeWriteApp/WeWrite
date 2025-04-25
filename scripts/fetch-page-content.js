/**
 * Script to fetch page content for feature cards
 * 
 * Usage:
 * node scripts/fetch-page-content.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

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

// Page IDs to fetch
const pageIds = [
  'RFsPq1tbcOMtljwHyIMT', // Every Page is a Fundraiser
  'aJFMqTEKuNEHvOrYE9c2', // No ads
  'ou1LPmpynpoirLrv99fq', // Multiple view modes
  'o71h6Lg1wjGSC1pYaKXz', // Recurring donations
  '4jw8FdMJHGofMc4G2QTw', // Collaborative pages
  'N7Pg3iJ0OQhkpw16MTZW', // Map view
  '0krXqAU748w43YnWJwE2'  // Calendar view
];

async function fetchPageContent() {
  const pageContents = {};
  
  for (const pageId of pageIds) {
    try {
      const pageRef = doc(db, 'pages', pageId);
      const pageDoc = await getDoc(pageRef);
      
      if (pageDoc.exists()) {
        const data = pageDoc.data();
        pageContents[pageId] = {
          title: data.title || 'Untitled',
          body: data.body || '',
          isPublic: data.isPublic || false
        };
        console.log(`Fetched content for page ${pageId}: ${data.title}`);
      } else {
        console.log(`Page ${pageId} not found`);
        pageContents[pageId] = {
          title: 'Page not found',
          body: '',
          isPublic: false
        };
      }
    } catch (error) {
      console.error(`Error fetching page ${pageId}:`, error);
      pageContents[pageId] = {
        title: 'Error fetching page',
        body: '',
        isPublic: false
      };
    }
  }
  
  // Save the page contents to a file
  const outputPath = path.join(__dirname, 'temp', 'page-contents.json');
  fs.writeFileSync(outputPath, JSON.stringify(pageContents, null, 2));
  console.log(`Page contents saved to ${outputPath}`);
}

fetchPageContent().catch(console.error);
