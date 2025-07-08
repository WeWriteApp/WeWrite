/**
 * Migration script to create initial versions for pages that don't have them
 * This fixes the issue where pages created during daily notes migration
 * don't appear in activity feeds because they lack version history.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
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

async function migrateVersions() {
  console.log('🔍 Starting migration: Finding pages without initial versions...');
  
  try {
    // Get all pages (excluding deleted ones)
    const pagesSnapshot = await db.collection('pages')
      .where('deleted', '!=', true)
      .get();
      
    console.log(`📄 Found ${pagesSnapshot.size} pages to check`);
    
    let pagesWithoutVersions = [];
    let pagesWithVersions = 0;
    let errors = 0;
    
    // Check each page for versions
    for (const pageDoc of pagesSnapshot.docs) {
      const pageId = pageDoc.id;
      const pageData = pageDoc.data();
      
      try {
        // Check if page has any versions
        const versionsSnapshot = await db.collection('pages').doc(pageId).collection('versions').limit(1).get();
        
        if (versionsSnapshot.empty) {
          pagesWithoutVersions.push({
            id: pageId,
            title: pageData.title || 'Untitled',
            userId: pageData.userId,
            username: pageData.username,
            createdAt: pageData.createdAt,
            lastModified: pageData.lastModified,
            content: pageData.content
          });
          console.log(`❌ Page ${pageId} (${pageData.title || 'Untitled'}) has no versions`);
        } else {
          pagesWithVersions++;
        }
      } catch (error) {
        console.error(`❌ Error checking page ${pageId}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n📊 Migration Analysis:`);
    console.log(`  - Pages with versions: ${pagesWithVersions}`);
    console.log(`  - Pages without versions: ${pagesWithoutVersions.length}`);
    console.log(`  - Errors: ${errors}`);
    
    if (pagesWithoutVersions.length === 0) {
      console.log('✅ All pages already have versions. No migration needed.');
      return;
    }
    
    console.log(`\n🔧 Creating initial versions for ${pagesWithoutVersions.length} pages...`);
    
    let migrated = 0;
    let migrationErrors = 0;
    
    for (const page of pagesWithoutVersions) {
      try {
        // Create initial version using page creation data
        const versionData = {
          content: page.content || JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }]),
          createdAt: page.createdAt || page.lastModified || new Date().toISOString(),
          userId: page.userId,
          username: page.username || 'Anonymous'
        };
        
        // Create the version
        const versionRef = await db.collection('pages').doc(page.id).collection('versions').add(versionData);
        
        // Update the page with currentVersion reference
        await db.collection('pages').doc(page.id).update({
          currentVersion: versionRef.id
        });
        
        migrated++;
        console.log(`✅ Created initial version for page ${page.id} (${page.title})`);
        
      } catch (error) {
        console.error(`❌ Error migrating page ${page.id}:`, error.message);
        migrationErrors++;
      }
    }
    
    console.log(`\n🎉 Migration Complete:`);
    console.log(`  - Successfully migrated: ${migrated} pages`);
    console.log(`  - Migration errors: ${migrationErrors} pages`);
    
    if (migrated > 0) {
      console.log(`\n✨ Activity feeds should now show recent edits for all migrated pages!`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
migrateVersions()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
