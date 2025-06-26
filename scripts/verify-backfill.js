#!/usr/bin/env node

/**
 * Verification script to check the results of the backfill operation
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  limit,
  where
} from 'firebase/firestore';
import { config } from 'dotenv';

// Load environment variables
config();

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

async function verifyBackfillResults() {
  console.log('🔍 Verifying backfill results...\n');
  
  try {
    // Check pages collection integrity
    console.log('📄 Checking pages collection...');
    const pagesRef = collection(db, 'pages');
    const pagesSnapshot = await getDocs(query(pagesRef, limit(100)));
    
    let pagesWithMissingFields = 0;
    let pagesWithDeletedField = 0;
    let pagesWithUsername = 0;
    
    pagesSnapshot.forEach(doc => {
      const data = doc.data();
      
      if (!data.createdAt || !data.lastModified || !data.title) {
        pagesWithMissingFields++;
      }
      
      if (data.deleted !== undefined) {
        pagesWithDeletedField++;
      }
      
      if (data.username) {
        pagesWithUsername++;
      }
    });
    
    console.log(`  - Sampled ${pagesSnapshot.size} pages`);
    console.log(`  - Pages with missing required fields: ${pagesWithMissingFields}`);
    console.log(`  - Pages with deleted field: ${pagesWithDeletedField}`);
    console.log(`  - Pages with username: ${pagesWithUsername}`);
    
    // Check users collection
    console.log('\n👤 Checking users collection...');
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(query(usersRef, limit(50)));
    
    let usersWithMissingFields = 0;
    let usersWithFollowerCount = 0;
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      
      if (!data.createdAt) {
        usersWithMissingFields++;
      }
      
      if (data.followerCount !== undefined) {
        usersWithFollowerCount++;
      }
    });
    
    console.log(`  - Sampled ${usersSnapshot.size} users`);
    console.log(`  - Users with missing required fields: ${usersWithMissingFields}`);
    console.log(`  - Users with followerCount: ${usersWithFollowerCount}`);
    
    // Check activity calendar data
    console.log('\n📅 Checking activity calendar data...');
    const activityRef = collection(db, 'userActivityCalendar');
    const activitySnapshot = await getDocs(query(activityRef, limit(10)));
    
    console.log(`  - Activity calendar records found: ${activitySnapshot.size}`);
    
    if (activitySnapshot.size > 0) {
      const sampleDoc = activitySnapshot.docs[0];
      const sampleData = sampleDoc.data();
      console.log(`  - Sample activity data has ${sampleData.activityData?.length || 0} activity entries`);
    }
    
    // Check user streaks data
    console.log('\n🔥 Checking user streaks data...');
    const streaksRef = collection(db, 'userStreaks');
    const streaksSnapshot = await getDocs(query(streaksRef, limit(10)));
    
    console.log(`  - User streak records found: ${streaksSnapshot.size}`);
    
    if (streaksSnapshot.size > 0) {
      const sampleDoc = streaksSnapshot.docs[0];
      const sampleData = sampleDoc.data();
      console.log(`  - Sample streak: current=${sampleData.currentStreak}, longest=${sampleData.longestStreak}, total days=${sampleData.totalDaysActive}`);
    }
    
    // Check analytics data
    console.log('\n📊 Checking analytics data...');
    
    try {
      const globalCountersDoc = await getDoc(doc(db, 'analytics_counters', 'global'));
      if (globalCountersDoc.exists()) {
        const counters = globalCountersDoc.data();
        console.log(`  - Global counters: ${counters.totalPagesEverCreated} total, ${counters.totalActivePages} active`);
      } else {
        console.log('  - No global counters found (may need admin permissions)');
      }
    } catch (error) {
      console.log('  - Could not access analytics counters (permission issue)');
    }
    
    try {
      const dailyRef = collection(db, 'analytics_daily');
      const dailySnapshot = await getDocs(query(dailyRef, limit(5)));
      console.log(`  - Daily aggregations found: ${dailySnapshot.size}`);
    } catch (error) {
      console.log('  - Could not access daily analytics (permission issue)');
    }
    
    console.log('\n✅ Verification completed!');
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  }
}

// Run verification
verifyBackfillResults();
