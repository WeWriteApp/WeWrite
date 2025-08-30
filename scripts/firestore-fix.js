#!/usr/bin/env node

/**
 * Fix the malformed page using Firebase CLI and Firestore
 */

const { execSync } = require('child_process');

function runFirestoreCommand(command) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8',
      cwd: '/Users/jamiegray/Documents/GitHub/WeWrite'
    });
    return result.trim();
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    throw error;
  }
}

async function fixPage() {
  const pageId = 'Ca2OFJ5QPiJm0rPO2IHn';
  
  console.log(`🔧 Fixing page: ${pageId}`);
  
  try {
    // First, get the current page data
    console.log('📄 Fetching current page data...');
    const getCommand = `npx firebase firestore:get pages/${pageId} --project wewrite-app`;
    const pageDataRaw = runFirestoreCommand(getCommand);
    
    console.log('📄 Raw page data:', pageDataRaw);
    
    // Parse the page data
    const pageData = JSON.parse(pageDataRaw);
    
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
          
          // Create the update data
          const updateData = {
            content: parsed,
            lastModified: new Date().toISOString(),
            fixedAt: new Date().toISOString(),
            fixedBy: 'firestore-cli-script'
          };
          
          // Write the update data to a temporary file
          const fs = require('fs');
          const tempFile = '/tmp/page-update.json';
          fs.writeFileSync(tempFile, JSON.stringify(updateData, null, 2));
          
          // Update the page using Firebase CLI
          const updateCommand = `npx firebase firestore:set pages/${pageId} ${tempFile} --merge --project wewrite-app`;
          console.log('🔧 Running update command...');
          const updateResult = runFirestoreCommand(updateCommand);
          
          console.log('✅ Page fixed successfully!');
          console.log('📄 Update result:', updateResult);
          
          // Clean up temp file
          fs.unlinkSync(tempFile);
          
          // Verify the fix
          console.log('🔍 Verifying the fix...');
          const verifyCommand = `npx firebase firestore:get pages/${pageId} --project wewrite-app`;
          const verifyDataRaw = runFirestoreCommand(verifyCommand);
          const verifyData = JSON.parse(verifyDataRaw);
          
          console.log('🔍 Verification - Updated content type:', typeof verifyData.content);
          console.log('🔍 Verification - Content is array:', Array.isArray(verifyData.content));
          
        } else {
          console.log('⚠️ Content is JSON but not an array, converting...');
          const fixedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(parsed) }] }];
          
          const updateData = {
            content: fixedContent,
            lastModified: new Date().toISOString(),
            fixedAt: new Date().toISOString(),
            fixedBy: 'firestore-cli-script'
          };
          
          const fs = require('fs');
          const tempFile = '/tmp/page-update.json';
          fs.writeFileSync(tempFile, JSON.stringify(updateData, null, 2));
          
          const updateCommand = `npx firebase firestore:set pages/${pageId} ${tempFile} --merge --project wewrite-app`;
          runFirestoreCommand(updateCommand);
          
          fs.unlinkSync(tempFile);
          console.log('✅ Content converted to proper structure');
        }
        
      } catch (e) {
        console.log('⚠️ Content is string but not valid JSON, converting to paragraph...');
        const fixedContent = [{ type: "paragraph", children: [{ text: pageData.content }] }];
        
        const updateData = {
          content: fixedContent,
          lastModified: new Date().toISOString(),
          fixedAt: new Date().toISOString(),
          fixedBy: 'firestore-cli-script'
        };
        
        const fs = require('fs');
        const tempFile = '/tmp/page-update.json';
        fs.writeFileSync(tempFile, JSON.stringify(updateData, null, 2));
        
        const updateCommand = `npx firebase firestore:set pages/${pageId} ${tempFile} --merge --project wewrite-app`;
        runFirestoreCommand(updateCommand);
        
        fs.unlinkSync(tempFile);
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
