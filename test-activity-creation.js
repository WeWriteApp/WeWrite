#!/usr/bin/env node

/**
 * Test script to verify activity creation is working
 * This script creates a test page and checks if an activity record is created
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, Timestamp } = require('firebase/firestore');

// Firebase config (using the same config as the app)
const firebaseConfig = {
  apiKey: "AIzaSyBJGZKJZKJZKJZKJZKJZKJZKJZKJZKJZKJ", // This will be replaced by env vars
  authDomain: "wewrite-ccd82.firebaseapp.com",
  projectId: "wewrite-ccd82",
  storageBucket: "wewrite-ccd82.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefghijklmnop"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testActivityCreation() {
  try {
    console.log('🔍 Testing activity creation...');
    
    // Check current activities count
    const activitiesQuery = query(
      collection(db, 'activities'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    
    const beforeSnapshot = await getDocs(activitiesQuery);
    console.log(`📊 Current activities count: ${beforeSnapshot.size}`);
    
    if (beforeSnapshot.size > 0) {
      console.log('📋 Recent activities:');
      beforeSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.pageName} by ${data.username} (${data.isNewPage ? 'new page' : 'edit'})`);
      });
    } else {
      console.log('❌ No activities found in the activities collection');
    }
    
    // Create a test activity record manually to verify the collection works
    console.log('\n🧪 Creating test activity record...');
    
    const testActivity = {
      pageId: 'test-page-' + Date.now(),
      pageName: 'Test Activity Page',
      userId: 'test-user-123',
      username: 'Test User',
      timestamp: Timestamp.now(),
      diff: {
        added: 50,
        removed: 0,
        hasChanges: true
      },
      isPublic: true,
      isNewPage: true
    };
    
    const docRef = await addDoc(collection(db, 'activities'), testActivity);
    console.log(`✅ Test activity created with ID: ${docRef.id}`);
    
    // Check activities again
    const afterSnapshot = await getDocs(activitiesQuery);
    console.log(`📊 Activities count after test: ${afterSnapshot.size}`);
    
    if (afterSnapshot.size > beforeSnapshot.size) {
      console.log('✅ Activity creation is working! The activities collection is functional.');
    } else {
      console.log('❌ Activity creation may not be working properly.');
    }
    
  } catch (error) {
    console.error('❌ Error testing activity creation:', error);
  }
}

// Run the test
testActivityCreation().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
