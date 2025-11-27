#!/usr/bin/env node

/**
 * CRITICAL FIX: Repair links with undefined pageId by looking up actual pages by title
 * 
 * This script:
 * 1. Scans all pages for links that have pageId: undefined but have pageTitle
 * 2. Looks up the actual page by title to find the correct pageId
 * 3. Updates the link data with the correct pageId and URL
 * 
 * Usage: node scripts/fix-undefined-page-ids.js [--dry-run] [--limit=100]
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, writeBatch, query, where, limit: firestoreLimit } = require('firebase/firestore');

// Simple collection name function for development environment
function getCollectionName(baseName) {
  return `DEV_${baseName}`;
}

// Firebase config (using environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

console.log(`🔧 UNDEFINED PAGE ID REPAIR ${isDryRun ? '(DRY RUN)' : ''}`);
console.log(`📊 Limit: ${limit || 'No limit'}`);

/**
 * Extract links from content recursively
 */
function extractLinksFromContent(content) {
  const links = [];
  
  function extractFromNode(node) {
    if (!node) return;
    
    if (node.type === 'link') {
      links.push(node);
    }
    
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(extractFromNode);
    }
  }
  
  if (Array.isArray(content)) {
    content.forEach(extractFromNode);
  } else {
    extractFromNode(content);
  }
  
  return links;
}

/**
 * Update links in content recursively
 */
function updateLinksInContent(content, pageIdMap) {
  let hasChanges = false;
  
  function updateNode(node) {
    if (!node) return node;
    
    if (node.type === 'link' && node.pageId === undefined && node.pageTitle) {
      const actualPageId = pageIdMap.get(node.pageTitle);
      if (actualPageId) {
        hasChanges = true;
        console.log(`🔧 Fixing link: "${node.pageTitle}" -> pageId: ${actualPageId}`);
        return {
          ...node,
          pageId: actualPageId,
          url: `/${actualPageId}`
        };
      } else {
        console.warn(`⚠️  Could not find page for title: "${node.pageTitle}"`);
      }
    }
    
    if (node.children && Array.isArray(node.children)) {
      const updatedChildren = node.children.map(updateNode);
      return { ...node, children: updatedChildren };
    }
    
    return node;
  }
  
  const updatedContent = Array.isArray(content) 
    ? content.map(updateNode)
    : updateNode(content);
    
  return { content: updatedContent, hasChanges };
}

/**
 * Main repair function
 */
async function fixUndefinedPageIds() {
  try {
    console.log('📊 Scanning pages for links with undefined pageId...');

    const pagesCollection = getCollectionName('pages');
    const pagesSnapshot = await getDocs(collection(db, pagesCollection));
    
    console.log(`Found ${pagesSnapshot.docs.length} pages to process`);
    
    // First pass: collect all links with undefined pageId and their titles
    const brokenLinks = new Set();
    const pagesWithBrokenLinks = [];
    
    let processedCount = 0;
    for (const pageDoc of pagesSnapshot.docs) {
      if (limit && processedCount >= limit) break;
      
      const pageData = pageDoc.data();
      if (!pageData.content) continue;
      
      try {
        let content;
        if (typeof pageData.content === 'string') {
          content = JSON.parse(pageData.content);
        } else {
          content = pageData.content;
        }
        
        const links = extractLinksFromContent(content);
        const undefinedLinks = links.filter(link => 
          link.pageId === undefined && link.pageTitle
        );
        
        if (undefinedLinks.length > 0) {
          pagesWithBrokenLinks.push({
            id: pageDoc.id,
            data: pageData,
            content,
            undefinedLinks
          });
          
          undefinedLinks.forEach(link => {
            brokenLinks.add(link.pageTitle);
          });
          
          console.log(`📄 Found ${undefinedLinks.length} broken links in page: ${pageData.title}`);
          undefinedLinks.forEach(link => {
            console.log(`  - "${link.pageTitle}" (customText: ${link.customText || 'none'})`);
          });
        }
        
        processedCount++;
        if (processedCount % 100 === 0) {
          console.log(`📊 Processed ${processedCount} pages...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing page ${pageDoc.id}:`, error.message);
      }
    }
    
    console.log(`\n🔍 Found ${brokenLinks.size} unique page titles with undefined pageId:`);
    Array.from(brokenLinks).forEach(title => console.log(`  - "${title}"`));
    
    // Second pass: look up actual pages by title to get correct pageIds
    console.log('\n🔍 Looking up actual pages by title...');
    const pageIdMap = new Map();
    
    const titleArray = Array.from(brokenLinks);
    for (let i = 0; i < titleArray.length; i += 10) {
      const batch = titleArray.slice(i, i + 10);
      
      const promises = batch.map(async (title) => {
        try {
          // Query for pages with this exact title
          const titleQuery = query(
            collection(db, pagesCollection),
            where('title', '==', title),
            where('deleted', '!=', true),
            firestoreLimit(1)
          );
          const titleSnapshot = await getDocs(titleQuery);

          if (!titleSnapshot.empty) {
            const pageDoc = titleSnapshot.docs[0];
            const pageId = pageDoc.id;
            pageIdMap.set(title, pageId);
            console.log(`✅ Found page: "${title}" -> ${pageId}`);
            return { title, pageId, found: true };
          } else {
            console.warn(`⚠️  Page not found for title: "${title}"`);
            return { title, found: false };
          }
        } catch (error) {
          console.error(`❌ Error looking up page "${title}":`, error.message);
          return { title, found: false, error: error.message };
        }
      });
      
      await Promise.all(promises);
      
      if (i + 10 < titleArray.length) {
        console.log(`📊 Looked up ${i + 10}/${titleArray.length} titles...`);
      }
    }
    
    console.log(`\n✅ Successfully mapped ${pageIdMap.size}/${brokenLinks.size} page titles to IDs`);
    
    // Third pass: update the broken links with correct pageIds
    console.log('\n🔧 Updating broken links...');
    let updatedPagesCount = 0;
    let updatedLinksCount = 0;
    
    for (const pageInfo of pagesWithBrokenLinks) {
      try {
        const { content: updatedContent, hasChanges } = updateLinksInContent(
          pageInfo.content, 
          pageIdMap
        );
        
        if (hasChanges) {
          if (!isDryRun) {
            const batch = writeBatch(db);
            const pageRef = doc(db, pagesCollection, pageInfo.id);
            batch.update(pageRef, {
              content: updatedContent,
              lastModified: new Date().toISOString(),
              fixedUndefinedPageIds: true,
              fixedAt: new Date().toISOString()
            });
            await batch.commit();
          }
          
          updatedPagesCount++;
          updatedLinksCount += pageInfo.undefinedLinks.length;
          
          console.log(`${isDryRun ? '[DRY RUN] ' : ''}✅ Updated page ${pageInfo.id} (${pageInfo.undefinedLinks.length} links)`);
        }
      } catch (error) {
        console.error(`❌ Error updating page ${pageInfo.id}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Repair complete!`);
    console.log(`📊 Updated ${updatedPagesCount} pages`);
    console.log(`🔗 Fixed ${updatedLinksCount} links`);
    console.log(`📋 Found ${pageIdMap.size} valid page mappings`);
    console.log(`⚠️  Could not resolve ${brokenLinks.size - pageIdMap.size} page titles`);
    
    if (isDryRun) {
      console.log('\n🔍 This was a dry run. Run without --dry-run to apply changes.');
    }

  } catch (error) {
    console.error('❌ Error during repair:', error);
    process.exit(1);
  }
}

// Run the repair
fixUndefinedPageIds()
  .then(() => {
    console.log('✅ Repair script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Repair script failed:', error);
    process.exit(1);
  });
