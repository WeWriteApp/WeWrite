/**
 * Debug script to check activities in the database
 */

// Use dynamic imports since this is an ES module environment
async function loadModules() {
  const { getFirebaseAdmin } = await import('./app/firebase/firebaseAdmin.js');
  const { getCollectionName } = await import('./app/utils/environmentConfig.js');
  return { getFirebaseAdmin, getCollectionName };
}

async function checkActivities() {
  try {
    console.log('🔍 Checking activities in database...');

    const { getFirebaseAdmin, getCollectionName } = await loadModules();
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    // Check DEV_activities collection
    const devActivitiesCollection = getCollectionName('activities');
    console.log('📊 Checking collection:', devActivitiesCollection);
    
    const activitiesRef = db.collection(devActivitiesCollection);
    const snapshot = await activitiesRef.orderBy('timestamp', 'desc').limit(10).get();
    
    console.log(`📈 Found ${snapshot.size} activities in ${devActivitiesCollection}`);
    
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
      console.log('❌ No activities found');
      
      // Also check if there are any pages that should have activities
      const pagesCollection = getCollectionName('pages');
      console.log('\n🔍 Checking pages in:', pagesCollection);
      
      const pagesRef = db.collection(pagesCollection);
      const pagesSnapshot = await pagesRef.orderBy('createdAt', 'desc').limit(5).get();
      
      console.log(`📈 Found ${pagesSnapshot.size} pages in ${pagesCollection}`);
      
      if (pagesSnapshot.size > 0) {
        console.log('\n📄 Recent pages (should have activities):');
        pagesSnapshot.forEach((doc, index) => {
          const data = doc.data();
          console.log(`${index + 1}. ${doc.id}:`, {
            title: data.title,
            userId: data.userId,
            username: data.username,
            createdAt: data.createdAt,
            lastModified: data.lastModified
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
