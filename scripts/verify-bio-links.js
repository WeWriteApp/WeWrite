/**
 * Verify Bio Links Script
 * 
 * Checks all user bios to see if they have proper link structures
 * and identifies any remaining plain text that could be links.
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const IS_DEV = !args.includes('--production');
const COLLECTION_PREFIX = IS_DEV ? 'DEV_' : '';
const SPECIFIC_USER = args.find(a => a.startsWith('--user='))?.split('=')[1];

console.log('='.repeat(60));
console.log('🔍 Bio Links Verification Script');
console.log('='.repeat(60));
console.log(`Environment: ${IS_DEV ? 'DEVELOPMENT' : 'PRODUCTION'}`);
console.log('='.repeat(60));

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountJson = Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(serviceAccountJson);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'wewrite-ccd82'
  });
}

const db = admin.firestore();

async function verifyBios() {
  // Build page title index for reference
  console.log('\n📚 Building page title index...');
  const pagesCollection = `${COLLECTION_PREFIX}pages`;
  const pagesSnapshot = await db.collection(pagesCollection)
    .where('deleted', '!=', true)
    .get();
  
  const titleIndex = new Map();
  pagesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!data.title || data.deleted === true || data.title.length < 3) return;
    titleIndex.set(data.title.toLowerCase().trim(), {
      pageId: doc.id,
      title: data.title
    });
  });
  console.log(`   Found ${titleIndex.size} page titles`);

  // Fetch users
  const usersCollection = `${COLLECTION_PREFIX}users`;
  let userDocs;
  
  if (SPECIFIC_USER) {
    const userDoc = await db.collection(usersCollection).doc(SPECIFIC_USER).get();
    if (!userDoc.exists) {
      // Try finding by username
      const byUsername = await db.collection(usersCollection).where('username', '==', SPECIFIC_USER).get();
      if (byUsername.empty) {
        console.log(`\n❌ User not found: ${SPECIFIC_USER}`);
        return;
      }
      userDocs = byUsername.docs;
    } else {
      userDocs = [userDoc];
    }
  } else {
    const snapshot = await db.collection(usersCollection).get();
    userDocs = snapshot.docs.filter(doc => doc.data().bio);
  }

  console.log(`\n👥 Checking ${userDocs.length} users with bios...\n`);

  for (const userDoc of userDocs) {
    const userData = userDoc.data();
    const username = userData.username || 'Unknown';
    const bio = userData.bio;
    
    if (!bio) continue;

    // Count links
    const bioStr = JSON.stringify(bio);
    const linkCount = (bioStr.match(/"type":"link"/g) || []).length;
    
    // Extract all plain text
    const extractPlainText = (nodes, insideLink = false) => {
      const texts = [];
      if (!Array.isArray(nodes)) return texts;
      
      for (const node of nodes) {
        if (node.type === 'link') {
          // Skip text inside links
          continue;
        }
        if (node.text && !insideLink) {
          texts.push(node.text);
        }
        if (node.children) {
          texts.push(...extractPlainText(node.children, node.type === 'link'));
        }
      }
      return texts;
    };
    
    const plainTexts = Array.isArray(bio) ? extractPlainText(bio) : [bio];
    const allPlainText = plainTexts.join(' ');
    
    // Check for potential unlinked titles
    const potentialMatches = [];
    for (const [titleLower, pageInfo] of titleIndex.entries()) {
      if (titleLower.length < 3) continue;
      
      const regex = new RegExp(`\\b${titleLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (regex.test(allPlainText.toLowerCase())) {
        potentialMatches.push(pageInfo.title);
      }
    }
    
    // Check if backup exists
    const hasBackup = !!userData.bioBackup;
    const wasRelinkified = !!userData.bioRelinkifiedAt;
    
    console.log(`📝 ${username} (${userDoc.id}):`);
    console.log(`   Links: ${linkCount}`);
    console.log(`   Was relinkified: ${wasRelinkified ? '✅ Yes' : '❌ No'}`);
    console.log(`   Has backup: ${hasBackup ? '✅ Yes' : '❌ No'}`);
    
    if (potentialMatches.length > 0) {
      console.log(`   ⚠️  Potential unlinked text: ${potentialMatches.slice(0, 10).join(', ')}${potentialMatches.length > 10 ? ` (+${potentialMatches.length - 10} more)` : ''}`);
    } else {
      console.log(`   ✅ No unlinked page titles found`);
    }
    
    // Show bio content sample
    if (Array.isArray(bio)) {
      const sample = JSON.stringify(bio).substring(0, 300);
      console.log(`   Bio sample: ${sample}...`);
    }
    console.log('');
  }
}

verifyBios().then(() => {
  console.log('✅ Verification complete');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
