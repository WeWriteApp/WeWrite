/**
 * Test script to check if activities are being created in the DEV_activities collection
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy, limit } = require('firebase/firestore');

// Firebase config for development
const firebaseConfig = {
  apiKey: "AIzaSyBOKKP8wJOJJJJJJJJJJJJJJJJJJJJJJJJ", // This will be replaced by actual config
  authDomain: "wewrite-ccd82.firebaseapp.com",
  projectId: "wewrite-ccd82",
  storageBucket: "wewrite-ccd82.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefghijklmnop"
};

async function checkActivities() {
  try {
    console.log('🔍 Checking DEV_activities collection...');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Check DEV_activities collection
    const activitiesRef = collection(db, 'DEV_activities');
    const activitiesQuery = query(activitiesRef, orderBy('timestamp', 'desc'), limit(10));
    
    console.log('📊 Querying DEV_activities collection...');
    const snapshot = await getDocs(activitiesQuery);
    
    console.log(`📈 Found ${snapshot.size} activities in DEV_activities`);
    
    if (snapshot.size > 0) {
      console.log('\n🎯 Recent activities:');
      snapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ${doc.id}:`, {
          pageId: data.pageId,
          pageName: data.pageName,
          userId: data.userId,
          username: data.username,
          isNewPage: data.isNewPage,
          timestamp: data.timestamp?.toDate?.() || data.timestamp,
          hasChanges: data.diff?.hasChanges
        });
      });
    } else {
      console.log('❌ No activities found in DEV_activities collection');
      
      // Also check the base activities collection
      console.log('\n🔍 Checking base activities collection...');
      const baseActivitiesRef = collection(db, 'activities');
      const baseActivitiesQuery = query(baseActivitiesRef, orderBy('timestamp', 'desc'), limit(10));
      const baseSnapshot = await getDocs(baseActivitiesQuery);
      
      console.log(`📈 Found ${baseSnapshot.size} activities in base activities collection`);
      
      if (baseSnapshot.size > 0) {
        console.log('\n⚠️ Activities found in base collection (should be in DEV_activities):');
        baseSnapshot.forEach((doc, index) => {
          const data = doc.data();
          console.log(`${index + 1}. ${doc.id}:`, {
            pageId: data.pageId,
            pageName: data.pageName,
            userId: data.userId,
            username: data.username,
            isNewPage: data.isNewPage,
            timestamp: data.timestamp?.toDate?.() || data.timestamp
          });
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking activities:', error);
  }
}

// Run the check
checkActivities()
  .then(() => {
    console.log('\n✅ Activity check completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
