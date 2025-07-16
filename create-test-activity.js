/**
 * Simple script to create a test activity record
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.GOOGLE_CLOUD_KEY_JSON || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'wewrite-ccd82'
  });
}

async function createTestActivity() {
  try {
    console.log('🔍 Creating test activity...');
    
    const db = admin.firestore();
    
    // Create a test activity in DEV_activities collection
    const testActivity = {
      pageId: 'VH5KXdJmSZMthKeUJyfa', // Use an existing page
      pageName: 'test',
      userId: 'dev_test_user_1',
      username: 'testUser1',
      timestamp: admin.firestore.Timestamp.now(),
      isNewPage: false,
      diff: {
        added: 5,
        removed: 2,
        hasChanges: true
      },
      diffPreview: 'Test activity created manually',
      versionId: 'test-version-id'
    };
    
    // Add to DEV_activities collection
    const docRef = await db.collection('DEV_activities').add(testActivity);
    
    console.log('✅ Test activity created with ID:', docRef.id);
    console.log('📊 Activity data:', testActivity);
    
    // Verify it was created
    const doc = await docRef.get();
    if (doc.exists) {
      console.log('✅ Verified: Activity exists in database');
    } else {
      console.log('❌ Error: Activity not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Error creating test activity:', error);
  }
}

// Run the test
createTestActivity()
  .then(() => {
    console.log('\n✅ Test activity creation completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
