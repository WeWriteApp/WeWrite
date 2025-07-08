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

async function checkDatabase() {
  console.log('🔍 Checking database for other users and recent activity...');
  
  try {
    // Check total users
    const usersSnapshot = await db.collection('users').limit(10).get();
    console.log('📊 Total users found:', usersSnapshot.size);
    
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log('👤 User:', doc.id.substring(0, 8) + '...', '- Email:', data.email, '- Username:', data.username);
    });
    
    // Check recent public pages from all users
    const pagesSnapshot = await db.collection('pages')
      .where('isPublic', '==', true)
      .orderBy('lastModified', 'desc')
      .limit(20)
      .get();
      
    console.log('📄 Recent public pages found:', pagesSnapshot.size);
    
    const userCounts = {};
    pagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const userId = data.userId;
      userCounts[userId] = (userCounts[userId] || 0) + 1;
      const modifiedDate = data.lastModified?.toDate?.() || new Date(data.lastModified);
      console.log('📝 Page:', (data.title || 'Untitled').substring(0, 30), '- User:', (userId || 'unknown').substring(0, 8) + '...', '- Modified:', modifiedDate.toISOString());
    });
    
    console.log('📊 Pages by user count:', Object.keys(userCounts).length, 'unique users');
    Object.entries(userCounts).forEach(([userId, count]) => {
      console.log('  -', (userId || 'unknown').substring(0, 8) + '...', ':', count, 'pages');
    });
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

checkDatabase().then(() => process.exit(0)).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
