#!/usr/bin/env node

/**
 * Script to identify and fix orphaned pages (pages without currentVersion)
 * This script will:
 * 1. Find all pages without a currentVersion
 * 2. For each page, try to create a recovery version if it has content
 * 3. Delete pages that have no content and can't be recovered
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://wewrite-app-default-rtdb.firebaseio.com/"
  });
}

const db = admin.firestore();

async function fixOrphanedPages() {
  console.log('🔍 Scanning for orphaned pages...');
  
  try {
    // Get all pages
    const pagesSnapshot = await db.collection('pages').get();
    const orphanedPages = [];
    const fixedPages = [];
    const deletedPages = [];
    
    console.log(`📄 Found ${pagesSnapshot.size} total pages`);
    
    // Check each page for missing currentVersion
    for (const pageDoc of pagesSnapshot.docs) {
      const pageData = pageDoc.data();
      const pageId = pageDoc.id;
      
      if (!pageData.currentVersion) {
        orphanedPages.push({ id: pageId, data: pageData });
        console.log(`❌ Found orphaned page: ${pageId} (${pageData.title || 'Untitled'})`);
        
        // Try to fix the page
        if (pageData.content) {
          try {
            console.log(`🔧 Attempting to fix page ${pageId}...`);
            
            // Create a recovery version
            const versionData = {
              content: pageData.content,
              createdAt: pageData.lastModified || new Date().toISOString(),
              userId: pageData.userId || 'unknown',
              username: pageData.username || 'Anonymous',
              groupId: pageData.groupId || null,
              previousVersionId: null // This is a recovery version
            };
            
            // Create the version document
            const versionRef = await db.collection('pages').doc(pageId).collection('versions').add(versionData);
            console.log(`✅ Created recovery version ${versionRef.id} for page ${pageId}`);
            
            // Update the page with the new currentVersion
            await db.collection('pages').doc(pageId).update({
              currentVersion: versionRef.id
            });
            
            fixedPages.push(pageId);
            console.log(`✅ Successfully fixed page ${pageId}`);
            
          } catch (error) {
            console.error(`❌ Failed to fix page ${pageId}:`, error);
            
            // If we can't fix it and it has no useful content, consider deleting
            if (!pageData.content || pageData.content.trim() === '' || 
                pageData.content === JSON.stringify([{ type: "paragraph", children: [{ text: "" }] }])) {
              try {
                console.log(`🗑️ Deleting empty orphaned page ${pageId}...`);
                await db.collection('pages').doc(pageId).delete();
                deletedPages.push(pageId);
                console.log(`✅ Deleted empty orphaned page ${pageId}`);
              } catch (deleteError) {
                console.error(`❌ Failed to delete orphaned page ${pageId}:`, deleteError);
              }
            }
          }
        } else {
          // No content to recover from, delete the page
          try {
            console.log(`🗑️ Deleting contentless orphaned page ${pageId}...`);
            await db.collection('pages').doc(pageId).delete();
            deletedPages.push(pageId);
            console.log(`✅ Deleted contentless orphaned page ${pageId}`);
          } catch (deleteError) {
            console.error(`❌ Failed to delete orphaned page ${pageId}:`, deleteError);
          }
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`Total pages scanned: ${pagesSnapshot.size}`);
    console.log(`Orphaned pages found: ${orphanedPages.length}`);
    console.log(`Pages fixed: ${fixedPages.length}`);
    console.log(`Pages deleted: ${deletedPages.length}`);
    
    if (orphanedPages.length === 0) {
      console.log('✅ No orphaned pages found!');
    } else {
      console.log('\n🔧 Fixed pages:', fixedPages);
      console.log('🗑️ Deleted pages:', deletedPages);
    }
    
  } catch (error) {
    console.error('❌ Error scanning for orphaned pages:', error);
  }
}

// Run the script
if (require.main === module) {
  fixOrphanedPages()
    .then(() => {
      console.log('✅ Orphaned pages cleanup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixOrphanedPages };
