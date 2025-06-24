#!/usr/bin/env node

/**
 * Script to fix pages with null/undefined deleted fields
 * This will set deleted: false for all pages that don't have an explicit deleted field
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Firebase config from environment variables
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

async function fixDeletedFields() {
  console.log('🔧 Starting deleted field fix script...');

  // Validate Firebase config
  if (!firebaseConfig.projectId) {
    console.error('❌ Firebase config not found. Make sure .env.local exists with Firebase environment variables.');
    console.error('Required variables: NEXT_PUBLIC_FIREBASE_PID, NEXT_PUBLIC_FIREBASE_API_KEY, etc.');
    process.exit(1);
  }

  console.log(`🔗 Connecting to Firebase project: ${firebaseConfig.projectId}`);

  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('✅ Connected to Firestore');
    
    // Get all pages
    console.log('📄 Fetching all pages...');
    const pagesRef = collection(db, 'pages');
    const snapshot = await getDocs(pagesRef);
    
    console.log(`📊 Found ${snapshot.size} total pages`);
    
    // Find pages with null/undefined deleted fields
    const pagesToFix = [];
    const alreadyFixed = [];
    const explicitlyDeleted = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const pageId = doc.id;
      
      if (data.deleted === undefined || data.deleted === null) {
        pagesToFix.push({ id: pageId, title: data.title || 'Untitled' });
      } else if (data.deleted === false) {
        alreadyFixed.push(pageId);
      } else if (data.deleted === true) {
        explicitlyDeleted.push(pageId);
      }
    });
    
    console.log(`\n📈 Analysis Results:`);
    console.log(`  🔧 Pages to fix (null/undefined deleted): ${pagesToFix.length}`);
    console.log(`  ✅ Already fixed (deleted: false): ${alreadyFixed.length}`);
    console.log(`  🗑️  Explicitly deleted (deleted: true): ${explicitlyDeleted.length}`);
    
    if (pagesToFix.length === 0) {
      console.log('\n🎉 No pages need fixing! All pages have explicit deleted fields.');
      return;
    }
    
    console.log(`\n🔧 Pages that will be fixed:`);
    pagesToFix.forEach((page, index) => {
      console.log(`  ${index + 1}. ${page.id} - "${page.title}"`);
    });
    
    // Batch update pages in groups of 500 (Firestore batch limit)
    const batchSize = 500;
    let totalUpdated = 0;
    
    for (let i = 0; i < pagesToFix.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchPages = pagesToFix.slice(i, i + batchSize);
      
      console.log(`\n📝 Processing batch ${Math.floor(i / batchSize) + 1} (${batchPages.length} pages)...`);
      
      batchPages.forEach((page) => {
        const pageRef = doc(db, 'pages', page.id);
        batch.update(pageRef, { deleted: false });
      });
      
      try {
        await batch.commit();
        totalUpdated += batchPages.length;
        console.log(`✅ Updated ${batchPages.length} pages in this batch`);
      } catch (error) {
        console.error(`❌ Error updating batch:`, error);
        throw error;
      }
    }
    
    console.log(`\n🎉 Successfully fixed ${totalUpdated} pages!`);
    console.log(`\n📊 Final Status:`);
    console.log(`  ✅ Fixed pages: ${totalUpdated}`);
    console.log(`  🔧 Already had deleted: false: ${alreadyFixed.length}`);
    console.log(`  🗑️  Explicitly deleted: ${explicitlyDeleted.length}`);
    console.log(`  📄 Total pages: ${snapshot.size}`);
    
    console.log(`\n🔄 Next steps:`);
    console.log(`  1. Refresh your browser`);
    console.log(`  2. Check your user pages tab`);
    console.log(`  3. Check recent activity`);
    console.log(`  4. All previously hidden pages should now appear!`);
    
  } catch (error) {
    console.error('❌ Error running fix script:', error);
    process.exit(1);
  }
}

// Run the script
fixDeletedFields()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
