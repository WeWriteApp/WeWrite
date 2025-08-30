#!/usr/bin/env node

/**
 * Fix specific page with malformed JSON content
 * Usage: node scripts/fix-specific-page.js Ca2OFJ5QPiJm0rPO2IHn
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin directly
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'wewrite-app'
  });
}

const db = admin.firestore();

async function fixSpecificPage(pageId) {
  console.log(`🔧 Fixing page: ${pageId}`);

  try {
    // Get the page document from production
    const pageRef = db.collection('pages').doc(pageId);
    const pageDoc = await pageRef.get();
    
    if (!pageDoc.exists) {
      console.error(`❌ Page ${pageId} not found`);
      return;
    }
    
    const pageData = pageDoc.data();
    console.log('📄 Current page data:', {
      title: pageData.title,
      contentType: typeof pageData.content,
      contentSample: typeof pageData.content === 'string' ? 
        pageData.content.substring(0, 200) : 
        JSON.stringify(pageData.content).substring(0, 200)
    });
    
    // Check if content is malformed JSON string
    if (typeof pageData.content === 'string') {
      try {
        const parsed = JSON.parse(pageData.content);
        if (Array.isArray(parsed)) {
          console.log('✅ Found malformed JSON content, fixing...');
          
          // Update the page with proper content structure
          await pageRef.update({
            content: parsed,
            lastModified: new Date().toISOString(),
            fixedAt: new Date().toISOString(),
            fixedBy: 'admin-script'
          });
          
          console.log('✅ Page fixed successfully!');
          console.log('📄 Fixed content structure:', {
            type: 'array',
            length: parsed.length,
            firstItem: parsed[0]
          });
          
        } else {
          console.log('⚠️ Content is JSON but not an array, converting...');
          const fixedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(parsed) }] }];
          
          await pageRef.update({
            content: fixedContent,
            lastModified: new Date().toISOString(),
            fixedAt: new Date().toISOString(),
            fixedBy: 'admin-script'
          });
          
          console.log('✅ Content converted to proper structure');
        }
        
      } catch (e) {
        console.log('⚠️ Content is string but not valid JSON, converting to paragraph...');
        const fixedContent = [{ type: "paragraph", children: [{ text: pageData.content }] }];
        
        await pageRef.update({
          content: fixedContent,
          lastModified: new Date().toISOString(),
          fixedAt: new Date().toISOString(),
          fixedBy: 'admin-script'
        });
        
        console.log('✅ Legacy text content converted to proper structure');
      }
    } else if (Array.isArray(pageData.content)) {
      console.log('✅ Content is already in proper array format');
    } else {
      console.log('⚠️ Content has unexpected format:', typeof pageData.content);
    }
    
  } catch (error) {
    console.error('❌ Error fixing page:', error);
  }
}

// Get page ID from command line arguments
const pageId = process.argv[2];
if (!pageId) {
  console.error('❌ Please provide a page ID');
  console.log('Usage: node scripts/fix-specific-page.js <pageId>');
  process.exit(1);
}

fixSpecificPage(pageId)
  .then(() => {
    console.log('🎉 Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
