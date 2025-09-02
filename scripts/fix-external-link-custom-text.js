#!/usr/bin/env node

/**
 * Fix External Link Custom Text Migration Script
 * 
 * This script fixes external links that are missing proper custom text fields.
 * It identifies external links where the display text differs from the URL
 * and adds the appropriate isCustomText and customText fields.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString('utf-8')
  );
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'wewrite-ccd82'
  });
}

const db = admin.firestore();

async function fixExternalLinkCustomText() {
  console.log('🔧 Starting external link custom text migration...');
  
  let totalPages = 0;
  let pagesWithExternalLinks = 0;
  let linksFixed = 0;
  let errors = 0;

  try {
    // Get all pages
    const pagesSnapshot = await db.collection('pages').get();
    totalPages = pagesSnapshot.size;
    
    console.log(`📄 Found ${totalPages} pages to check`);

    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const pageDoc of pagesSnapshot.docs) {
      const pageData = pageDoc.data();
      const pageId = pageDoc.id;
      
      if (!pageData.content || !Array.isArray(pageData.content)) {
        continue;
      }

      let pageHasChanges = false;
      const updatedContent = JSON.parse(JSON.stringify(pageData.content));

      // Recursively process content to find and fix external links
      function processContentNode(node) {
        if (!node || typeof node !== 'object') return;

        // Check if this is an external link
        if (node.type === 'link' && node.isExternal && node.url) {
          const currentDisplayText = node.children?.[0]?.text || '';
          const url = node.url;

          // Check if display text is different from URL (indicating custom text)
          if (currentDisplayText && currentDisplayText !== url && currentDisplayText.trim() !== '') {
            // This link has custom text but might be missing the proper fields
            if (!node.isCustomText || !node.customText) {
              console.log(`🔗 Fixing external link in page ${pageId}: "${currentDisplayText}" -> ${url}`);
              
              node.isCustomText = true;
              node.customText = currentDisplayText;
              pageHasChanges = true;
              linksFixed++;
            }
          } else if (currentDisplayText === url) {
            // This link shows the URL, so it's not custom text
            if (node.isCustomText || node.customText) {
              console.log(`🔗 Removing incorrect custom text flags from page ${pageId}: ${url}`);
              
              node.isCustomText = false;
              delete node.customText;
              pageHasChanges = true;
              linksFixed++;
            }
          }
        }

        // Recursively process children
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(processContentNode);
        }
      }

      // Process all content nodes
      updatedContent.forEach(processContentNode);

      if (pageHasChanges) {
        pagesWithExternalLinks++;
        
        // Add to batch
        batch.update(pageDoc.ref, { content: updatedContent });
        batchCount++;

        // Commit batch if it's getting large
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} updates`);
    }

    console.log('\n📊 Migration Summary:');
    console.log(`- Total pages checked: ${totalPages}`);
    console.log(`- Pages with external links updated: ${pagesWithExternalLinks}`);
    console.log(`- External links fixed: ${linksFixed}`);
    console.log(`- Errors: ${errors}`);
    
    if (linksFixed > 0) {
      console.log('\n✅ External link custom text migration completed successfully!');
    } else {
      console.log('\n✅ No external links needed fixing.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  fixExternalLinkCustomText()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixExternalLinkCustomText };
