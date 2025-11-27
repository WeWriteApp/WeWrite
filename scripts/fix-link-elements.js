/**
 * Migrate Link Elements Script
 *
 * This script migrates link elements from the old structure to the new LinkNode structure.
 *
 * OLD STRUCTURE (from EDITOR_REQUIREMENTS.md):
 * {
 *   type: 'link',
 *   pageId: string,
 *   pageTitle: string,
 *   text?: string,  // Custom display text
 *   children: Array<{ text: string }>
 * }
 *
 * NEW STRUCTURE (from link-system.md):
 * {
 *   type: 'link',
 *   pageId: string,
 *   pageTitle: string,
 *   isCustomText: boolean,
 *   customText?: string,  // Only if isCustomText = true
 *   children: Array<{ text: string }>
 * }
 *
 * The script:
 * 1. Finds all pages with link elements using the old structure
 * 2. Converts them to the new LinkNode structure
 * 3. Updates the pages in the database
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Decode base64 encoded service account key
  const serviceAccountJson = Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(serviceAccountJson);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'wewrite-ccd82'
  });
}

const db = admin.firestore();

// Function to migrate link elements from old structure to new LinkNode structure
function migrateLinkElements(content) {
  if (!Array.isArray(content)) {
    return content;
  }

  let hasChanges = false;

  const result = content.map(element => {
    if (element.type === 'link' && 'text' in element && element.isCustomText === undefined) {
      // This is an old-structure link that needs migration
      const { text, ...baseElement } = element;

      // Determine if this link has custom text
      const displayText = element.children?.[0]?.text || '';
      const pageTitle = element.pageTitle || '';
      const isCustomText = text && text !== pageTitle && displayText !== pageTitle;

      // Create new LinkNode structure
      const migratedElement = {
        ...baseElement,
        isCustomText: isCustomText,
        ...(isCustomText && { customText: text })
      };

      console.log(`Migrated link element: "${text}" -> isCustomText: ${isCustomText}${isCustomText ? `, customText: "${text}"` : ''}`);
      hasChanges = true;
      return migratedElement;
    }

    // Recursively migrate children
    if (element.children && Array.isArray(element.children)) {
      const migratedChildren = migrateLinkElements(element.children);
      if (migratedChildren !== element.children) {
        hasChanges = true;
      }
      return {
        ...element,
        children: migratedChildren
      };
    }

    return element;
  });

  return hasChanges ? result : content;
}

// Main function to fix all pages
async function fixAllPages() {
  try {
    console.log('Starting to fix link elements in all pages...');

    // Get all pages from the DEV_pages collection
    const pagesSnapshot = await db.collection('DEV_pages').get();
    console.log(`Found ${pagesSnapshot.size} pages to check`);

    let fixedCount = 0;
    let totalCount = 0;

    for (const doc of pagesSnapshot.docs) {
      totalCount++;
      const pageData = doc.data();
      const pageId = doc.id;



      if (!pageData.content || !Array.isArray(pageData.content)) {
        continue;
      }

      // Check if this page has link elements using the old structure
      const hasOldStructureLinks = JSON.stringify(pageData.content).includes('"type":"link"') &&
                                   JSON.stringify(pageData.content).includes('"text":') &&
                                   !JSON.stringify(pageData.content).includes('"isCustomText":');

      if (hasOldStructureLinks) {
        console.log(`\nMigrating page: ${pageData.title} (${pageId})`);

        // Debug: Show a sample of the content
        const contentStr = JSON.stringify(pageData.content, null, 2);
        console.log(`Content sample (first 500 chars): ${contentStr.substring(0, 500)}...`);

        // Migrate the content
        const originalContent = JSON.stringify(pageData.content);
        const migratedContent = migrateLinkElements(pageData.content);
        const migratedContentStr = JSON.stringify(migratedContent);

        // Only update if there were actual changes
        if (originalContent !== migratedContentStr) {
          // Update the page in the database
          await doc.ref.update({
            content: migratedContent,
            lastModified: admin.firestore.FieldValue.serverTimestamp()
          });

          fixedCount++;
          console.log(`✅ Migrated page: ${pageData.title} (content actually changed)`);
        } else {
          console.log(`⚠️  Page ${pageData.title} had no actual changes to make`);
        }
      }
    }

    console.log(`\n🎉 Completed! Migrated ${fixedCount} out of ${totalCount} pages.`);

  } catch (error) {
    console.error('Error fixing pages:', error);
  }
}

// Run the script
if (require.main === module) {
  fixAllPages().then(() => {
    console.log('Script completed');
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { migrateLinkElements, fixAllPages };
