// Test script to debug backlinks functionality
// Run this in the browser console on a WeWrite page

async function testBacklinks() {
  console.log('🧪 Testing backlinks functionality...\n');
  
  try {
    // Test 1: Check if backlinks functions are available
    console.log('1. Testing backlinks function imports...');
    
    const { getBacklinks } = await import('/app/firebase/database/backlinks.js');
    console.log('✅ getBacklinks function imported successfully');
    
    // Test 2: Try to get backlinks for current page
    const currentPageId = window.location.pathname.replace('/', '');
    if (currentPageId && currentPageId !== '') {
      console.log(`2. Testing backlinks for current page: ${currentPageId}`);
      
      const backlinks = await getBacklinks(currentPageId);
      console.log(`✅ Backlinks query completed. Found ${backlinks.length} backlinks:`, backlinks);
      
      if (backlinks.length === 0) {
        console.log('ℹ️ No backlinks found. This could mean:');
        console.log('   - No pages link to this page yet');
        console.log('   - Backlinks index is empty');
        console.log('   - Migration script hasn\'t been run');
      }
    } else {
      console.log('⚠️ Cannot test - not on a page URL');
    }
    
    // Test 3: Check if backlinks collection exists and has data
    console.log('\n3. Testing direct Firestore access...');
    
    const { db } = await import('/app/firebase/config.js');
    const { collection, getDocs, query, limit } = await import('firebase/firestore');
    
    const backlinksRef = collection(db, 'backlinks');
    const sampleQuery = query(backlinksRef, limit(5));
    const snapshot = await getDocs(sampleQuery);
    
    console.log(`✅ Backlinks collection query completed. Found ${snapshot.size} sample entries`);
    
    if (snapshot.size > 0) {
      console.log('Sample backlinks data:');
      snapshot.docs.forEach((doc, index) => {
        console.log(`   ${index + 1}.`, doc.id, ':', doc.data());
      });
    } else {
      console.log('⚠️ Backlinks collection is empty - migration may be needed');
    }
    
    // Test 4: Check if BacklinksSection component is working
    console.log('\n4. Testing BacklinksSection component...');
    
    const backlinksSections = document.querySelectorAll('[data-component="BacklinksSection"]');
    if (backlinksSections.length > 0) {
      console.log(`✅ Found ${backlinksSections.length} BacklinksSection component(s) on page`);
      
      backlinksSections.forEach((section, index) => {
        const loadingIndicator = section.querySelector('.animate-spin');
        const backlinksContent = section.querySelector('.flex-wrap');
        const noBacklinksMessage = section.textContent.includes('No pages link to this page');
        
        console.log(`   Section ${index + 1}:`);
        console.log(`     Loading: ${!!loadingIndicator}`);
        console.log(`     Has content: ${!!backlinksContent}`);
        console.log(`     Shows "no backlinks": ${noBacklinksMessage}`);
      });
    } else {
      console.log('⚠️ No BacklinksSection components found on page');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}

// Run the test
testBacklinks();
