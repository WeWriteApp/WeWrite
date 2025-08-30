#!/usr/bin/env node

/**
 * EMERGENCY: Fix JSON String Content in Production
 * 
 * This script immediately fixes pages that have content stored as JSON strings
 * instead of proper Slate.js node arrays. This is causing pages to display
 * as raw JSON to users, making them look terrible.
 * 
 * USAGE: node scripts/emergency-fix-json-content.js
 */

console.log('🚨 EMERGENCY: Fixing JSON string content in production');
console.log('This will make pages stop looking like garbage to users');
console.log('');

// Use the API to trigger fixes
const pages = [
  '2MPS2Ty3m1fwEjNL4hfA',
  'RcbI7tOba4zIcncXicNL',
  // Add more page IDs as needed
];

async function fixPage(pageId) {
  try {
    console.log(`🔧 Fixing page: ${pageId}`);
    
    // Call the API to trigger the fix
    const response = await fetch(`https://www.getwewrite.app/api/pages/${pageId}?emergency_fix=${Date.now()}`);
    
    if (response.ok) {
      const data = await response.json();
      
      // Check if content is now an array
      if (Array.isArray(data.pageData.content)) {
        console.log(`✅ Fixed: ${pageId} - Content is now proper array`);
      } else {
        console.log(`❌ Still broken: ${pageId} - Content is still: ${typeof data.pageData.content}`);
      }
    } else {
      console.log(`❌ API Error: ${pageId} - Status: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Error fixing ${pageId}:`, error.message);
  }
}

async function fixAllPages() {
  console.log(`Fixing ${pages.length} pages...`);
  
  for (const pageId of pages) {
    await fixPage(pageId);
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('');
  console.log('✅ Emergency fix complete!');
  console.log('Pages should now display properly to users.');
}

// Run the fix
fixAllPages().catch(error => {
  console.error('💥 Emergency fix failed:', error);
  process.exit(1);
});
