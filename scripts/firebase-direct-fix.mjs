#!/usr/bin/env node

/**
 * Direct Firebase fix for the malformed page
 * Uses the existing Firebase configuration from the app
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initializeFirebase() {
  try {
    // Check if Firebase is already initialized
    if (getApps().length > 0) {
      console.log('🔥 Firebase already initialized');
      return getFirestore();
    }

    // Try to read the service account key
    const serviceAccountPath = join(__dirname, '..', 'service-account-key.json');
    let serviceAccount;
    
    try {
      const serviceAccountData = readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(serviceAccountData);
      console.log('🔑 Using service account key');
    } catch (e) {
      console.log('⚠️ Service account key not found, using application default credentials');
      // Initialize without explicit credentials (will use application default)
      const app = initializeApp({
        projectId: 'wewrite-app'
      });
      return getFirestore(app);
    }

    // Initialize with service account
    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    return getFirestore(app);
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    throw error;
  }
}

async function fixPage() {
  const pageId = 'Ca2OFJ5QPiJm0rPO2IHn';
  
  console.log(`🔧 Fixing page: ${pageId}`);
  
  try {
    const db = await initializeFirebase();
    
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
            fixedBy: 'direct-firebase-script'
          });
          
          console.log('✅ Page fixed successfully!');
          console.log('📄 Fixed content structure:', {
            type: 'array',
            length: parsed.length,
            firstItem: parsed[0]
          });
          
          // Verify the fix
          const updatedDoc = await pageRef.get();
          const updatedData = updatedDoc.data();
          console.log('🔍 Verification - Updated content type:', typeof updatedData.content);
          
        } else {
          console.log('⚠️ Content is JSON but not an array, converting...');
          const fixedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(parsed) }] }];
          
          await pageRef.update({
            content: fixedContent,
            lastModified: new Date().toISOString(),
            fixedAt: new Date().toISOString(),
            fixedBy: 'direct-firebase-script'
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
          fixedBy: 'direct-firebase-script'
        });
        
        console.log('✅ Legacy text content converted to proper structure');
      }
    } else if (Array.isArray(pageData.content)) {
      console.log('✅ Content is already in proper array format');
    } else {
      console.log('⚠️ Content has unexpected format:', typeof pageData.content);
    }
    
  } catch (error) {
    console.error('❌ Error fixing page:', error.message);
    throw error;
  }
}

fixPage()
  .then(() => {
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
