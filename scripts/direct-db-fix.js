#!/usr/bin/env node

/**
 * Direct database fix using the app's Firebase configuration
 */

// Import the Firebase admin from the app
const path = require('path');
const { spawn } = require('child_process');

// The correct content structure
const properContent = [
  {
    "type": "paragraph",
    "children": [
      {
        "text": "was initially derided as \"Russian disinformation\" but ended up being proven to be true"
      }
    ]
  }
];

console.log('🔧 Starting direct database fix...');

// Create a temporary Node.js script that uses the app's Firebase setup
const fixScript = `
const admin = require('firebase-admin');

// Initialize Firebase Admin with project ID
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'wewrite-app'
  });
}

const db = admin.firestore();
const pageId = 'Ca2OFJ5QPiJm0rPO2IHn';

async function fixPage() {
  try {
    console.log('🔧 Connecting to Firestore...');
    
    const pageRef = db.collection('pages').doc(pageId);
    const pageDoc = await pageRef.get();
    
    if (!pageDoc.exists) {
      console.error('❌ Page not found');
      return;
    }
    
    const pageData = pageDoc.data();
    console.log('📄 Current content type:', typeof pageData.content);
    
    // Update with proper content structure
    const properContent = ${JSON.stringify(properContent)};
    
    await pageRef.update({
      content: properContent,
      lastModified: new Date().toISOString(),
      fixedAt: new Date().toISOString(),
      fixedBy: 'direct-db-fix-script'
    });
    
    console.log('✅ Page fixed successfully!');
    console.log('📄 Content updated to proper array structure');
    
    // Verify the fix
    const updatedDoc = await pageRef.get();
    const updatedData = updatedDoc.data();
    console.log('🔍 Verification - Content type:', typeof updatedData.content);
    console.log('🔍 Verification - Is array:', Array.isArray(updatedData.content));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixPage().then(() => process.exit(0)).catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
`;

// Write the script to a temporary file
const fs = require('fs');
const tempScript = path.join(__dirname, 'temp-fix.js');
fs.writeFileSync(tempScript, fixScript);

console.log('📄 Created temporary fix script');

// Set environment variables for Firebase
const env = {
  ...process.env,
  GOOGLE_APPLICATION_CREDENTIALS: path.join(__dirname, '..', 'service-account-key.json'),
  FIRESTORE_EMULATOR_HOST: undefined // Make sure we're not using emulator
};

// Run the script
console.log('🚀 Executing fix script...');
const child = spawn('node', [tempScript], {
  env,
  stdio: 'inherit',
  cwd: path.join(__dirname, '..')
});

child.on('close', (code) => {
  // Clean up temp file
  fs.unlinkSync(tempScript);
  
  if (code === 0) {
    console.log('🎉 Fix completed successfully!');
    console.log('');
    console.log('✅ The page content has been converted from JSON string to proper array structure');
    console.log('✅ The editor should now display the content properly instead of raw JSON');
    console.log('');
    console.log('🔗 Test the fix at: https://www.getwewrite.app/Ca2OFJ5QPiJm0rPO2IHn');
  } else {
    console.error('❌ Fix failed with code:', code);
  }
});
