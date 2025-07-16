#!/usr/bin/env node

/**
 * Build Backlinks Index Script
 * 
 * This script builds the backlinks index for the current environment.
 * It scans all pages and creates backlink entries for efficient retrieval.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

// Firebase config (using environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Environment detection
function getEnvironmentType() {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

function getEnvironmentPrefix() {
  const envType = getEnvironmentType();
  switch (envType) {
    case 'production': return '';
    case 'preview': return '';
    case 'development': return 'DEV_';
    default: return 'DEV_';
  }
}

function getCollectionName(baseName) {
  return `${getEnvironmentPrefix()}${baseName}`;
}

async function buildBacklinksIndex() {
  try {
    console.log('🚀 Starting backlinks index build...');
    console.log('Environment:', getEnvironmentType());
    console.log('Collection prefix:', getEnvironmentPrefix());

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Get all pages
    console.log('📄 Fetching all pages...');
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('deleted', '!=', true)
    );
    
    const pagesSnapshot = await getDocs(pagesQuery);
    console.log(`Found ${pagesSnapshot.size} pages to process`);

    let processedCount = 0;
    let errorCount = 0;

    // Process each page
    for (const pageDoc of pagesSnapshot.docs) {
      try {
        const pageData = pageDoc.data();
        const pageId = pageDoc.id;

        console.log(`Processing page ${processedCount + 1}/${pagesSnapshot.size}: ${pageData.title || 'Untitled'}`);

        // Parse content to extract links
        let contentNodes = [];
        if (pageData.content) {
          try {
            if (typeof pageData.content === 'string') {
              contentNodes = JSON.parse(pageData.content);
            } else {
              contentNodes = pageData.content;
            }
          } catch (parseError) {
            console.warn(`Could not parse content for page ${pageId}:`, parseError.message);
            contentNodes = [];
          }
        }

        // Import and use the updateBacklinksIndex function
        const { updateBacklinksIndex } = await import('../app/firebase/database/backlinks.js');
        
        await updateBacklinksIndex(
          pageId,
          pageData.title || 'Untitled',
          pageData.username || 'unknown',
          contentNodes,
          pageData.isPublic || false,
          pageData.lastModified
        );

        processedCount++;
        
        // Add a small delay to avoid overwhelming Firestore
        if (processedCount % 10 === 0) {
          console.log(`✅ Processed ${processedCount} pages so far...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Error processing page ${pageDoc.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('🎉 Backlinks index build completed!');
    console.log(`✅ Successfully processed: ${processedCount} pages`);
    console.log(`❌ Errors: ${errorCount} pages`);

    if (errorCount > 0) {
      console.log('⚠️ Some pages had errors. Check the logs above for details.');
    }

  } catch (error) {
    console.error('💥 Fatal error building backlinks index:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  buildBacklinksIndex()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { buildBacklinksIndex };
