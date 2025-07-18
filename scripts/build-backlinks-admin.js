#!/usr/bin/env node

/**
 * Build Backlinks Index Script using Firebase Admin SDK
 *
 * This script builds the backlinks index for production collections.
 * Uses Admin SDK for better server-side access.
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Use the service account key from environment
  const serviceAccountJson = process.env.GOOGLE_CLOUD_KEY_JSON;

  if (!serviceAccountJson) {
    console.error('❌ GOOGLE_CLOUD_KEY_JSON environment variable is not set');
    console.log('Available environment variables:');
    console.log('  GOOGLE_CLOUD_KEY_JSON:', !!process.env.GOOGLE_CLOUD_KEY_JSON);
    console.log('  NEXT_PUBLIC_FIREBASE_PID:', process.env.NEXT_PUBLIC_FIREBASE_PID);
    process.exit(1);
  }

  let serviceAccount;
  try {
    // Check if the key is base64 encoded
    let decodedJson = serviceAccountJson;
    if (process.env.GOOGLE_CLOUD_KEY_BASE64 === 'True') {
      console.log('🔓 Decoding base64 encoded service account key...');
      decodedJson = Buffer.from(serviceAccountJson, 'base64').toString('utf8');
    }

    serviceAccount = JSON.parse(decodedJson);
    console.log('✅ Service account parsed successfully');
  } catch (error) {
    console.error('❌ Failed to parse GOOGLE_CLOUD_KEY_JSON:', error.message);
    console.log('Raw value:', serviceAccountJson?.substring(0, 100) + '...');
    console.log('GOOGLE_CLOUD_KEY_BASE64:', process.env.GOOGLE_CLOUD_KEY_BASE64);
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PID
  });

  console.log('✅ Firebase Admin initialized successfully');
}

const db = admin.firestore();

// Extract page links from content nodes
function extractPageLinksFromContent(contentNodes) {
  const links = [];
  
  if (!Array.isArray(contentNodes)) {
    return links;
  }
  
  for (const node of contentNodes) {
    if (node && typeof node === 'object') {
      // Check if this node is a paragraph with children
      if (node.type === 'paragraph' && Array.isArray(node.children)) {
        for (const child of node.children) {
          if (child && child.type === 'link' && child.pageId) {
            links.push({
              pageId: child.pageId,
              text: child.text || child.children?.[0]?.text || 'Link',
              pageTitle: child.pageTitle,
              url: child.url
            });
          }
        }
      }
      // Check if this node is directly a link
      else if (node.type === 'link' && node.pageId) {
        links.push({
          pageId: node.pageId,
          text: node.text || node.children?.[0]?.text || 'Link',
          pageTitle: node.pageTitle,
          url: node.url
        });
      }
    }
  }
  
  return links;
}

async function buildBacklinksIndex() {
  try {
    console.log('🚀 Starting backlinks index build for PRODUCTION data using Admin SDK...');
    console.log('Target collections: pages, backlinks (no prefix)');

    // Get all public pages (production collections)
    console.log('📄 Fetching all public pages...');
    const pagesSnapshot = await db.collection('pages')
      .where('isPublic', '==', true)
      .where('deleted', '!=', true)
      .get();
    
    console.log(`Found ${pagesSnapshot.size} public pages to process`);

    if (pagesSnapshot.size === 0) {
      console.log('⚠️ No pages found. Checking alternative queries...');
      
      // Try without the deleted filter
      const allPagesSnapshot = await db.collection('pages')
        .where('isPublic', '==', true)
        .limit(5)
        .get();
      
      console.log(`Found ${allPagesSnapshot.size} public pages (without deleted filter)`);
      
      if (allPagesSnapshot.size === 0) {
        // Try getting any pages at all
        const anyPagesSnapshot = await db.collection('pages').limit(5).get();
        console.log(`Found ${anyPagesSnapshot.size} total pages`);
        
        if (anyPagesSnapshot.size > 0) {
          console.log('Sample page data:');
          anyPagesSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`  ${index + 1}. ${data.title || 'Untitled'} - isPublic: ${data.isPublic}, deleted: ${data.deleted}`);
          });
        }
      }
      
      return;
    }

    let processedCount = 0;
    let errorCount = 0;
    let backlinksCreated = 0;

    // Clear existing backlinks first
    console.log('🧹 Clearing existing backlinks...');
    const existingBacklinksSnapshot = await db.collection('backlinks').get();
    
    if (!existingBacklinksSnapshot.empty) {
      const batch = db.batch();
      existingBacklinksSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`🧹 Cleared ${existingBacklinksSnapshot.size} existing backlinks`);
    }

    // Process each page
    for (const pageDoc of pagesSnapshot.docs) {
      try {
        const pageData = pageDoc.data();
        const pageId = pageDoc.id;

        console.log(`Processing page ${processedCount + 1}/${pagesSnapshot.size}: ${pageData.title || 'Untitled'}`);

        // Parse content to extract links
        let contentNodes = [];
        if (pageData.content) {
          try {
            if (typeof pageData.content === 'string') {
              contentNodes = JSON.parse(pageData.content);
            } else {
              contentNodes = pageData.content;
            }
          } catch (parseError) {
            console.warn(`Could not parse content for page ${pageId}:`, parseError.message);
            contentNodes = [];
          }
        }

        // Extract page links from content
        const pageLinks = extractPageLinksFromContent(contentNodes);
        
        if (pageLinks.length > 0) {
          console.log(`  Found ${pageLinks.length} page links`);
          
          // Create backlink entries for each linked page
          const batch = db.batch();
          
          for (const link of pageLinks) {
            if (link.pageId && link.pageId !== pageId) {
              const backlinkId = `${pageId}_to_${link.pageId}`;
              const backlinkRef = db.collection('backlinks').doc(backlinkId);
              
              batch.set(backlinkRef, {
                id: backlinkId,
                sourcePageId: pageId,
                sourcePageTitle: pageData.title || 'Untitled',
                sourceUsername: pageData.username || 'Unknown',
                targetPageId: link.pageId,
                linkText: link.text || '',
                linkUrl: link.url || '',
                createdAt: admin.firestore.Timestamp.now(),
                lastModified: pageData.lastModified || admin.firestore.Timestamp.now(),
                isPublic: pageData.isPublic || false
              });
              
              backlinksCreated++;
            }
          }
          
          // Commit the batch for this page
          if (backlinksCreated > 0) {
            await batch.commit();
          }
        }

        processedCount++;
        
        // Add a small delay to avoid overwhelming Firestore
        if (processedCount % 10 === 0) {
          console.log(`✅ Processed ${processedCount} pages so far, created ${backlinksCreated} backlinks...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Error processing page ${pageDoc.id}:`, error.message);
        errorCount++;
      }
    }

    // Verify final results
    const finalBacklinksSnapshot = await db.collection('backlinks').get();
    
    console.log('🎉 Backlinks index build completed!');
    console.log(`✅ Successfully processed: ${processedCount} pages`);
    console.log(`🔗 Backlinks created: ${backlinksCreated}`);
    console.log(`📊 Backlinks in database: ${finalBacklinksSnapshot.size}`);
    console.log(`❌ Errors: ${errorCount} pages`);

    if (errorCount > 0) {
      console.log('⚠️ Some pages had errors. Check the logs above for details.');
    }

    if (backlinksCreated > 0) {
      console.log('🎯 Backlinks index is now ready! BacklinksSection and RelatedPagesSection should work.');
    } else {
      console.log('ℹ️ No backlinks were created. This might mean:');
      console.log('   - Pages don\'t contain page links');
      console.log('   - Content format is different than expected');
      console.log('   - All links are external links, not page links');
    }

  } catch (error) {
    console.error('💥 Fatal error building backlinks index:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  buildBacklinksIndex()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { buildBacklinksIndex };
