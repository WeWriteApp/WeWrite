/**
 * Debug current bio state for establishmentdisliker
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccountJson = Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(serviceAccountJson);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'wewrite-ccd82'
  });
}

const db = admin.firestore();

async function debug() {
  const userSnapshot = await db.collection('users')
    .where('username', '==', 'establishmentdisliker')
    .get();
  
  if (userSnapshot.empty) {
    console.log('User not found');
    return;
  }
  
  const userData = userSnapshot.docs[0].data();
  
  console.log('=== USER METADATA ===');
  console.log('bioLinksFixedAt:', userData.bioLinksFixedAt);
  console.log('bioRelinkifiedAt:', userData.bioRelinkifiedAt);
  
  console.log('\n=== FIRST 2 LINKS IN BIO ===');
  if (Array.isArray(userData.bio)) {
    let linkNum = 0;
    const showLink = (node, path) => {
      if (node.type === 'link' && linkNum < 3) {
        linkNum++;
        console.log(`\nLink #${linkNum} at ${path}:`);
        console.log(JSON.stringify(node, null, 2));
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child, i) => showLink(child, `${path}.children[${i}]`));
      }
    };
    userData.bio.forEach((para, i) => showLink(para, `bio[${i}]`));
  }
}

debug().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
