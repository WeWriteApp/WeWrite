// Debug script to test backlinks functionality in the browser
// Paste this into the browser console on WeWrite

async function debugBacklinks() {
  console.log('🔍 Debugging backlinks functionality...\n');
  
  try {
    // Test 1: Check if we can import the backlinks module
    console.log('1. Testing backlinks module import...');
    
    let getBacklinks;
    try {
      const module = await import('/app/firebase/database/backlinks.js');
      getBacklinks = module.getBacklinks;
      console.log('✅ Successfully imported getBacklinks function');
    } catch (importError) {
      console.error('❌ Failed to import backlinks module:', importError);
      return;
    }
    
    // Test 2: Get current page ID
    const currentPageId = window.location.pathname.replace('/', '');
    console.log(`\n2. Current page ID: ${currentPageId}`);
    
    if (!currentPageId || currentPageId === '') {
      console.log('⚠️ Not on a page URL, cannot test backlinks');
      return;
    }
    
    // Test 3: Try to get backlinks for current page
    console.log('\n3. Testing backlinks query...');
    
    try {
      const backlinks = await getBacklinks(currentPageId);
      console.log(`✅ Backlinks query successful. Found ${backlinks.length} backlinks:`);
      
      if (backlinks.length > 0) {
        backlinks.forEach((backlink, index) => {
          console.log(`   ${index + 1}. ${backlink.title} (by ${backlink.username})`);
        });
      } else {
        console.log('   No backlinks found for this page');
      }
    } catch (queryError) {
      console.error('❌ Backlinks query failed:', queryError);
      
      // Check if it's an index issue
      if (queryError.code === 'failed-precondition' && queryError.message.includes('index')) {
        console.log('🔄 Index issue detected, testing fallback...');
        
        try {
          const { findBacklinks } = await import('/app/firebase/database/links.js');
          const fallbackResults = await findBacklinks(currentPageId, 10);
          console.log(`✅ Fallback method worked. Found ${fallbackResults.length} backlinks`);
        } catch (fallbackError) {
          console.error('❌ Fallback method also failed:', fallbackError);
        }
      }
    }
    
    // Test 4: Check Firestore backlinks collection directly
    console.log('\n4. Testing direct Firestore access...');
    
    try {
      const { db } = await import('/app/firebase/config.js');
      const { collection, getDocs, query, limit, where } = await import('firebase/firestore');
      
      // Check if backlinks collection exists and has any data
      const backlinksRef = collection(db, 'backlinks');
      const sampleQuery = query(backlinksRef, limit(5));
      const snapshot = await getDocs(sampleQuery);
      
      console.log(`✅ Direct Firestore query successful. Found ${snapshot.size} sample backlinks`);
      
      if (snapshot.size > 0) {
        console.log('Sample backlinks data:');
        snapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`   ${index + 1}. ${data.sourcePageTitle} -> ${data.targetPageId}`);
        });
      } else {
        console.log('⚠️ Backlinks collection is empty');
      }
      
      // Test specific query for current page
      if (currentPageId) {
        const targetQuery = query(
          backlinksRef, 
          where('targetPageId', '==', currentPageId),
          where('isPublic', '==', true)
        );
        const targetSnapshot = await getDocs(targetQuery);
        console.log(`✅ Target-specific query found ${targetSnapshot.size} backlinks for ${currentPageId}`);
      }
      
    } catch (firestoreError) {
      console.error('❌ Direct Firestore access failed:', firestoreError);
    }
    
    // Test 5: Check if BacklinksSection component is present and working
    console.log('\n5. Testing BacklinksSection component...');
    
    const backlinksSections = document.querySelectorAll('[data-testid*="backlinks"], .backlinks-section, [class*="backlinks"]');
    console.log(`Found ${backlinksSections.length} potential backlinks sections`);
    
    // Look for the actual component by checking for specific text
    const allElements = document.querySelectorAll('*');
    let foundBacklinksComponent = false;
    
    for (let element of allElements) {
      if (element.textContent && element.textContent.includes('What links here')) {
        console.log('✅ Found "What links here" section');
        foundBacklinksComponent = true;
        
        // Check the content
        const loadingIndicator = element.querySelector('.animate-spin');
        const noBacklinksMessage = element.textContent.includes('No pages link to this page');
        const hasBacklinks = element.querySelectorAll('a[href^="/"]').length > 0;
        
        console.log(`   Loading: ${!!loadingIndicator}`);
        console.log(`   Shows "no backlinks": ${noBacklinksMessage}`);
        console.log(`   Has backlink elements: ${hasBacklinks}`);
        break;
      }
    }
    
    if (!foundBacklinksComponent) {
      console.log('⚠️ Could not find BacklinksSection component on page');
    }
    
    console.log('\n📊 Debug Summary:');
    console.log('- Module import: ✅');
    console.log('- Current page detection: ✅');
    console.log('- Backlinks query: Check above for results');
    console.log('- Firestore access: Check above for results');
    console.log('- Component presence: Check above for results');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugBacklinks();
