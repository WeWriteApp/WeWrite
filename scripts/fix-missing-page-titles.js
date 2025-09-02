#!/usr/bin/env node

/**
 * Migration script to fix missing pageTitle fields in link data
 * 
 * This script:
 * 1. Scans all pages for links that have pageId but missing pageTitle
 * 2. Fetches the actual page titles from the database
 * 3. Updates the link data with the correct pageTitle
 * 
 * Usage: node scripts/fix-missing-page-titles.js [--dry-run] [--limit=100]
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, writeBatch } = require('firebase/firestore');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

console.log('🔧 Fix Missing Page Titles Script');
console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
if (limit) console.log(`Limit: ${limit} pages`);
console.log('');

// Firebase config (using environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Environment detection
function getEnvironmentType() {
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

function getEnvironmentPrefix() {
  const envType = getEnvironmentType();
  return envType === 'production' ? '' : 'dev_';
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Determine collection names based on environment
function getCollectionName(baseName) {
  const prefix = getEnvironmentPrefix();
  return `${prefix}${baseName}`;
}

/**
 * Extract all links from content nodes recursively
 */
function extractLinksFromContent(content) {
  const links = [];
  
  function traverse(node) {
    if (!node) return;
    
    if (node.type === 'link') {
      links.push(node);
    }
    
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }
  
  if (Array.isArray(content)) {
    content.forEach(traverse);
  } else {
    traverse(content);
  }
  
  return links;
}

/**
 * Update links in content recursively
 */
function updateLinksInContent(content, pageTitleMap) {
  let hasChanges = false;
  
  function updateNode(node) {
    if (!node) return node;
    
    if (node.type === 'link' && node.pageId && !node.pageTitle) {
      const actualTitle = pageTitleMap.get(node.pageId);
      if (actualTitle) {
        hasChanges = true;
        return {
          ...node,
          pageTitle: actualTitle,
          originalPageTitle: actualTitle
        };
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
 * Main migration function
 */
async function fixMissingPageTitles() {
  try {
    console.log('📊 Scanning pages for missing page titles in links...');

    const pagesCollection = getCollectionName('pages');
    const pagesSnapshot = await getDocs(collection(db, pagesCollection));
    
    console.log(`Found ${pagesSnapshot.docs.length} pages to process`);
    
    // First pass: collect all unique page IDs that need titles
    const missingTitlePageIds = new Set();
    const pagesWithLinks = [];
    
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
        const linksNeedingTitles = links.filter(link => 
          link.pageId && !link.pageTitle && !link.originalPageTitle
        );
        
        if (linksNeedingTitles.length > 0) {
          pagesWithLinks.push({
            id: pageDoc.id,
            data: pageData,
            content,
            linksNeedingTitles
          });
          
          linksNeedingTitles.forEach(link => {
            missingTitlePageIds.add(link.pageId);
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
    
    console.log(`\n📋 Found ${pagesWithLinks.length} pages with links missing titles`);
    console.log(`📋 Need to fetch titles for ${missingTitlePageIds.size} unique pages`);
    
    if (missingTitlePageIds.size === 0) {
      console.log('✅ No missing page titles found!');
      return;
    }
    
    // Second pass: fetch all the missing page titles
    console.log('\n🔍 Fetching missing page titles...');
    const pageTitleMap = new Map();
    
    const pageIdArray = Array.from(missingTitlePageIds);
    for (let i = 0; i < pageIdArray.length; i += 10) {
      const batch = pageIdArray.slice(i, i + 10);
      
      const promises = batch.map(async (pageId) => {
        try {
          const pageRef = doc(db, pagesCollection, pageId);
          const pageDoc = await getDoc(pageRef);

          if (pageDoc.exists()) {
            const data = pageDoc.data();
            const title = data.title || 'Untitled';
            pageTitleMap.set(pageId, title);
            return { pageId, title, found: true };
          } else {
            console.warn(`⚠️  Page ${pageId} not found`);
            return { pageId, found: false };
          }
        } catch (error) {
          console.error(`❌ Error fetching page ${pageId}:`, error.message);
          return { pageId, found: false, error: error.message };
        }
      });
      
      await Promise.all(promises);
      console.log(`🔍 Fetched titles for ${Math.min((i + 10), pageIdArray.length)}/${pageIdArray.length} pages`);
    }
    
    console.log(`\n✅ Successfully fetched ${pageTitleMap.size} page titles`);
    
    // Third pass: update the pages with the correct titles
    console.log('\n🔄 Updating pages with correct page titles...');
    
    let updatedPagesCount = 0;
    let updatedLinksCount = 0;
    
    for (const pageInfo of pagesWithLinks) {
      try {
        const { content: updatedContent, hasChanges } = updateLinksInContent(
          pageInfo.content, 
          pageTitleMap
        );
        
        if (hasChanges) {
          if (!isDryRun) {
            const pageRef = doc(db, pagesCollection, pageInfo.id);
            const batch = writeBatch(db);
            batch.update(pageRef, {
              content: updatedContent,
              lastModified: new Date().toISOString(),
              fixedMissingTitles: true,
              fixedAt: new Date().toISOString()
            });
            await batch.commit();
          }
          
          updatedPagesCount++;
          updatedLinksCount += pageInfo.linksNeedingTitles.length;
          
          console.log(`${isDryRun ? '[DRY RUN] ' : ''}✅ Updated page ${pageInfo.id} (${pageInfo.linksNeedingTitles.length} links)`);
        }
      } catch (error) {
        console.error(`❌ Error updating page ${pageInfo.id}:`, error.message);
      }
    }
    
    console.log('\n🎉 Migration completed!');
    console.log(`📊 Updated ${updatedPagesCount} pages`);
    console.log(`📊 Fixed ${updatedLinksCount} links`);
    
    if (isDryRun) {
      console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
fixMissingPageTitles();
