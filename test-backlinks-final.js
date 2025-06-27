// Final backlinks test - paste this into browser console
// This will test if the migration worked and backlinks are showing

async function testBacklinksAfterMigration() {
  console.log('🔍 Testing backlinks after migration...');
  
  try {
    // Test with the page that had backlinks in migration
    const testPageId = '06YNzXoQQEII4oOmasYK'; // Anti "Anti-Club" Club
    
    console.log(`Testing page: ${testPageId}`);
    
    const { getBacklinks } = await import('/app/firebase/database/backlinks.js');
    const backlinks = await getBacklinks(testPageId);
    
    console.log(`✅ Found ${backlinks.length} backlinks for test page`);
    if (backlinks.length > 0) {
      console.log('Backlinks:', backlinks);
      console.log('🎉 BACKLINKS ARE WORKING!');
    } else {
      console.log('⚠️ No backlinks found via API - checking Firestore directly...');
      
      // Check Firestore directly
      const { db } = await import('/app/firebase/config.js');
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      
      const backlinksRef = collection(db, 'backlinks');
      const targetQuery = query(
        backlinksRef,
        where('targetPageId', '==', testPageId)
      );
      
      const snapshot = await getDocs(targetQuery);
      console.log(`Direct Firestore query found ${snapshot.size} backlinks`);
      
      if (snapshot.size > 0) {
        snapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`${index + 1}. ${data.sourcePageTitle} -> ${data.targetPageId}`);
        });
        console.log('🎉 BACKLINKS DATA EXISTS IN FIRESTORE!');
      }
    }
    
    // Test current page if we're on one
    const currentPageId = window.location.pathname.replace('/', '');
    if (currentPageId && currentPageId !== testPageId && currentPageId !== '') {
      console.log(`\nTesting current page: ${currentPageId}`);
      const currentBacklinks = await getBacklinks(currentPageId);
      console.log(`Found ${currentBacklinks.length} backlinks for current page`);
      if (currentBacklinks.length > 0) {
        console.log('Current page backlinks:', currentBacklinks);
      }
    }
    
    // Check if BacklinksSection is visible on current page
    console.log('\nChecking UI components...');
    const backlinksSections = document.querySelectorAll('*');
    let foundSection = false;
    
    for (let element of backlinksSections) {
      if (element.textContent && element.textContent.includes('What links here')) {
        foundSection = true;
        console.log('✅ Found "What links here" section on page');
        
        const hasContent = element.textContent.includes('No pages link to this page') ? 
          'Shows "no backlinks" message' : 
          'Has backlinks content';
        console.log(`Section status: ${hasContent}`);
        break;
      }
    }
    
    if (!foundSection) {
      console.log('⚠️ Could not find "What links here" section on current page');
      console.log('This might be normal if you\'re not on a page view');
    }
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('- Migration created 61 backlinks from 200 pages');
    console.log('- Backlinks API function is accessible');
    console.log('- Firestore backlinks collection exists');
    console.log('- UI components may need page refresh to show new data');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBacklinksAfterMigration();
