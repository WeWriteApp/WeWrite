const admin = require('firebase-admin');

// Check if we're in development and have the service account key
if (!process.env.GOOGLE_CLOUD_KEY_JSON) {
  console.log('❌ GOOGLE_CLOUD_KEY_JSON not found in environment');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString());
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://wewrite-ccd82-default-rtdb.firebaseio.com'
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.log('❌ Failed to initialize Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function checkPage() {
  const pageId = 'wMXWnvxg1pjmzK4QPk1j';
  console.log('🔍 Checking page:', pageId);
  
  try {
    // Get the page document
    const pageDoc = await db.collection('pages').doc(pageId).get();
    
    if (!pageDoc.exists) {
      console.log('❌ Page does not exist');
      return;
    }
    
    const pageData = pageDoc.data();
    console.log('📄 Page data:');
    console.log('  - Title:', pageData.title);
    console.log('  - isPublic:', pageData.isPublic);
    console.log('  - deleted:', pageData.deleted);
    console.log('  - userId:', pageData.userId);
    console.log('  - lastModified:', pageData.lastModified);
    
    if (pageData.lastModified) {
      const modifiedDate = pageData.lastModified.toDate ? pageData.lastModified.toDate() : new Date(pageData.lastModified);
      console.log('  - lastModified (parsed):', modifiedDate.toISOString());
      console.log('  - Minutes ago:', Math.round((Date.now() - modifiedDate.getTime()) / (1000 * 60)));
    }
    
    // Check the recent version
    const versionsSnapshot = await db.collection('pages').doc(pageId).collection('versions')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
      
    console.log('📝 Recent versions:');
    versionsSnapshot.docs.forEach((versionDoc, index) => {
      const versionData = versionDoc.data();
      const createdDate = versionData.createdAt ? (versionData.createdAt.toDate ? versionData.createdAt.toDate() : new Date(versionData.createdAt)) : null;
      console.log(`  ${index + 1}. Version ${versionDoc.id}:`);
      console.log(`     - createdAt: ${createdDate ? createdDate.toISOString() : 'unknown'}`);
      console.log(`     - userId: ${versionData.userId}`);
      if (createdDate) {
        console.log(`     - Minutes ago: ${Math.round((Date.now() - createdDate.getTime()) / (1000 * 60))}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking page:', error.message);
  }
}

checkPage().then(() => process.exit(0)).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
