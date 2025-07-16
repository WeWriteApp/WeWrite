/**
 * Test script to directly create an activity in the DEV_activities collection
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } = require('firebase/firestore');

// Firebase config (using the same config as the app)
const firebaseConfig = {
  apiKey: "AIzaSyBJGLJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ", // This will be replaced by env vars
  authDomain: "wewrite-ccd82.firebaseapp.com",
  projectId: "wewrite-ccd82",
  storageBucket: "wewrite-ccd82.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefghijklmnop"
};

async function testActivityCreation() {
  try {
    console.log('🔍 Testing direct activity creation...');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Create a test activity
    const testActivity = {
      pageId: 'VH5KXdJmSZMthKeUJyfa',
      pageName: 'Test Page',
      userId: 'test-user-123',
      username: 'testUser',
      timestamp: new Date(),
      isNewPage: false,
      diff: {
        added: 10,
        removed: 5,
        hasChanges: true
      },
      diffPreview: 'Test activity created directly',
      versionId: 'test-version-' + Date.now()
    };
    
    // Add to DEV_activities collection
    console.log('📝 Creating activity in DEV_activities collection...');
    const docRef = await addDoc(collection(db, 'DEV_activities'), testActivity);
    console.log('✅ Activity created with ID:', docRef.id);
    
    // Verify it was created by querying the collection
    console.log('🔍 Verifying activity was created...');
    const activitiesQuery = query(
      collection(db, 'DEV_activities'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    
    const snapshot = await getDocs(activitiesQuery);
    console.log(`📊 Found ${snapshot.size} activities in DEV_activities collection`);
    
    if (snapshot.size > 0) {
      console.log('🎯 Recent activities:');
      snapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ${doc.id}:`, {
          pageId: data.pageId,
          pageName: data.pageName,
          username: data.username,
          timestamp: data.timestamp?.toDate?.() || data.timestamp
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing activity creation:', error);
  }
}

// Run the test
testActivityCreation()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
