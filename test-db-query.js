// Test script to directly query the database for the specific page
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Parse the service account JSON from environment (it's base64 encoded)
    const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
    const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedJson);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    console.log('Firebase Admin initialized');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

async function testDatabaseQuery() {
  try {
    console.log('Testing direct database query...');
    
    // Test 1: Get the specific page by ID
    console.log('\n1. Testing specific page by ID...');
    const specificPageRef = db.collection('pages').doc('BYojetF6H58rq1xvf0mY');
    const specificPageDoc = await specificPageRef.get();
    
    if (specificPageDoc.exists) {
      const data = specificPageDoc.data();
      console.log('Found specific page:');
      console.log('- ID:', specificPageDoc.id);
      console.log('- Title:', data.title);
      console.log('- Custom Date:', data.customDate);
      console.log('- Deleted:', data.deleted);
      console.log('- User ID:', data.userId);
      console.log('- Is Public:', data.isPublic);
      console.log('- Last Modified:', data.lastModified);
    } else {
      console.log('Specific page NOT FOUND');
    }
    
    // Test 2: Query for pages with custom dates
    console.log('\n2. Testing query for pages with custom dates...');
    const customDateQuery = db.collection('pages')
      .where('customDate', '!=', null)
      .limit(10);
    
    const customDateSnapshot = await customDateQuery.get();
    console.log(`Found ${customDateSnapshot.docs.length} pages with custom dates:`);
    
    customDateSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- ${doc.id}: "${data.title}" (customDate: ${data.customDate}, deleted: ${data.deleted})`);
    });
    
    // Test 3: Query for yesterday's pages
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];
    
    console.log(`\n3. Testing query for yesterday (${yesterdayString})...`);
    const yesterdayQuery = db.collection('pages')
      .where('customDate', '==', yesterdayString);
    
    const yesterdaySnapshot = await yesterdayQuery.get();
    console.log(`Found ${yesterdaySnapshot.docs.length} pages for yesterday:`);
    
    yesterdaySnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- ${doc.id}: "${data.title}" (customDate: ${data.customDate}, deleted: ${data.deleted}, userId: ${data.userId})`);
    });
    
  } catch (error) {
    console.error('Error testing database query:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testDatabaseQuery();
