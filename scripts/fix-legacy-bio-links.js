/**
 * Fix Legacy Bio Links Script
 * 
 * This script fixes OLD links in bios that are missing the `url` property
 * or have the wrong URL format. These links have `pageId` but no proper `url`.
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const IS_DEV = !args.includes('--production');
const COLLECTION_PREFIX = IS_DEV ? 'DEV_' : '';
const SPECIFIC_USER = args.find(a => a.startsWith('--user='))?.split('=')[1];

console.log('='.repeat(60));
console.log('🔧 Fix Legacy Bio Links Script');
console.log('='.repeat(60));
console.log(`Environment: ${IS_DEV ? 'DEVELOPMENT' : 'PRODUCTION'}`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : '⚠️  LIVE MODE'}`);
console.log('='.repeat(60));

if (!admin.apps.length) {
  const serviceAccountJson = Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(serviceAccountJson);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'wewrite-ccd82'
  });
}

const db = admin.firestore();

/**
 * Fix links in content - adds proper URL to links that have pageId but no URL
 */
function fixLinksInContent(content) {
  if (!Array.isArray(content)) return { content, changed: false };
  
  let changed = false;
  
  const processNode = (node) => {
    if (!node) return node;
    
    // Fix link nodes that have pageId but no proper url
    if (node.type === 'link') {
      let nodeChanged = false;
      const fixedNode = { ...node };
      
      // Fix missing url
      if (!fixedNode.url && fixedNode.pageId) {
        fixedNode.url = `/pages/${fixedNode.pageId}`;
        nodeChanged = true;
        console.log(`   Fixed missing URL for "${fixedNode.pageTitle || fixedNode.text}": ${fixedNode.url}`);
      }
      
      // Fix wrong url format (should be /pages/{id} for internal links)
      if (fixedNode.url && fixedNode.pageId && !fixedNode.isExternal) {
        // Check if URL is in wrong format (just /{id} instead of /pages/{id})
        if (fixedNode.url.match(/^\/[a-zA-Z0-9]+$/) && !fixedNode.url.startsWith('/pages/')) {
          const oldUrl = fixedNode.url;
          fixedNode.url = `/pages/${fixedNode.pageId}`;
          nodeChanged = true;
          console.log(`   Fixed URL format for "${fixedNode.pageTitle || fixedNode.text}": ${oldUrl} -> ${fixedNode.url}`);
        }
      }
      
      // Ensure isCustomText is set
      if (fixedNode.isCustomText === undefined) {
        const displayText = fixedNode.children?.[0]?.text || fixedNode.text || '';
        const pageTitle = fixedNode.pageTitle || '';
        fixedNode.isCustomText = displayText.toLowerCase() !== pageTitle.toLowerCase();
        if (fixedNode.isCustomText && displayText) {
          fixedNode.customText = displayText;
        }
        nodeChanged = true;
      }
      
      if (nodeChanged) {
        changed = true;
        return fixedNode;
      }
      return node;
    }
    
    // Process children
    if (node.children && Array.isArray(node.children)) {
      const fixedChildren = node.children.map(child => processNode(child));
      const childrenChanged = fixedChildren.some((child, i) => child !== node.children[i]);
      if (childrenChanged) {
        changed = true;
        return { ...node, children: fixedChildren };
      }
    }
    
    return node;
  };
  
  const fixedContent = content.map(node => processNode(node));
  return { content: fixedContent, changed };
}

async function fixBioLinks() {
  const usersCollection = `${COLLECTION_PREFIX}users`;
  
  let userDocs;
  if (SPECIFIC_USER) {
    // Try by username first
    const byUsername = await db.collection(usersCollection).where('username', '==', SPECIFIC_USER).get();
    if (!byUsername.empty) {
      userDocs = byUsername.docs;
    } else {
      // Try by user ID
      const byId = await db.collection(usersCollection).doc(SPECIFIC_USER).get();
      if (byId.exists) {
        userDocs = [byId];
      } else {
        console.log(`User not found: ${SPECIFIC_USER}`);
        return;
      }
    }
  } else {
    const snapshot = await db.collection(usersCollection).get();
    userDocs = snapshot.docs.filter(doc => doc.data().bio);
  }
  
  console.log(`\n👥 Checking ${userDocs.length} users...\n`);
  
  let totalFixed = 0;
  const changes = [];
  
  for (const userDoc of userDocs) {
    const userData = userDoc.data();
    const username = userData.username || 'Unknown';
    const bio = userData.bio;
    
    if (!bio || !Array.isArray(bio)) continue;
    
    console.log(`\n📝 ${username}:`);
    const { content: fixedBio, changed } = fixLinksInContent(bio);
    
    if (changed) {
      totalFixed++;
      changes.push({
        userId: userDoc.id,
        username,
        fixedBio
      });
      console.log(`   ✅ Links fixed`);
    } else {
      console.log(`   ⏭️  No fixes needed`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 SUMMARY: ${totalFixed} users need fixes`);
  console.log('='.repeat(60));
  
  if (changes.length === 0) {
    console.log('\n✅ No changes needed.');
    return;
  }
  
  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN - No changes applied.');
  } else {
    console.log('\n💾 Applying changes...');
    
    for (const change of changes) {
      await db.collection(usersCollection).doc(change.userId).update({
        bio: change.fixedBio,
        bioLinksFixedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`   Updated ${change.username}`);
    }
    
    console.log('\n✅ Changes applied!');
  }
}

fixBioLinks().then(() => {
  console.log('\n🎉 Script completed.');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
