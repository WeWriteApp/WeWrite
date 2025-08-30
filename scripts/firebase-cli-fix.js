#!/usr/bin/env node

/**
 * Fix using Firebase CLI and a cloud function
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// The proper content structure
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

console.log('🔧 Creating Firebase function to fix the page...');

// Create a simple cloud function
const functionCode = `
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.fixPage = functions.https.onRequest(async (req, res) => {
  try {
    const db = admin.firestore();
    const pageId = 'Ca2OFJ5QPiJm0rPO2IHn';
    
    const pageRef = db.collection('pages').doc(pageId);
    const pageDoc = await pageRef.get();
    
    if (!pageDoc.exists) {
      res.status(404).send('Page not found');
      return;
    }
    
    const pageData = pageDoc.data();
    console.log('Current content type:', typeof pageData.content);
    
    // The proper content structure
    const properContent = ${JSON.stringify(properContent)};
    
    await pageRef.update({
      content: properContent,
      lastModified: new Date().toISOString(),
      fixedAt: new Date().toISOString(),
      fixedBy: 'firebase-function-fix'
    });
    
    res.json({
      success: true,
      message: 'Page fixed successfully',
      contentType: typeof properContent,
      isArray: Array.isArray(properContent)
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
`;

// Write the function to the functions directory
const functionsDir = path.join(__dirname, '..', 'functions', 'src');
const functionFile = path.join(functionsDir, 'fixPage.js');

// Create the function file
fs.writeFileSync(functionFile, functionCode);
console.log('📄 Created cloud function');

// Deploy the function
try {
  console.log('🚀 Deploying function...');
  execSync('npx firebase deploy --only functions:fixPage --project wewrite-app', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  console.log('✅ Function deployed successfully');
  
  // Call the function
  console.log('📞 Calling function to fix the page...');
  const result = execSync('curl -s https://us-central1-wewrite-app.cloudfunctions.net/fixPage', {
    encoding: 'utf8'
  });
  
  console.log('📄 Function result:', result);
  
  // Clean up
  fs.unlinkSync(functionFile);
  console.log('🧹 Cleaned up function file');
  
  console.log('');
  console.log('🎉 Fix completed!');
  console.log('🔗 Test the fix at: https://www.getwewrite.app/Ca2OFJ5QPiJm0rPO2IHn');
  
} catch (error) {
  console.error('❌ Error deploying or calling function:', error.message);
  
  // Clean up on error
  if (fs.existsSync(functionFile)) {
    fs.unlinkSync(functionFile);
  }
}
