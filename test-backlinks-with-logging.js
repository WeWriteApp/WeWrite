// Test backlinks with detailed logging - paste into browser console

async function testBacklinksWithLogging() {
  console.log('🔍 TESTING BACKLINKS WITH DETAILED LOGGING\n');
  
  try {
    // Get current page ID
    const currentPageId = window.location.pathname.replace('/', '');
    console.log(`📄 Current page ID: ${currentPageId}`);
    
    if (!currentPageId || currentPageId.includes('/')) {
      console.log('⚠️  Not on a valid page route, using test page ID');
      // You can change this to any page ID you want to test
      const testPageId = 'test-page-123';
      await testSpecificPage(testPageId);
      return;
    }
    
    await testSpecificPage(currentPageId);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function testSpecificPage(pageId) {
  console.log(`\n🎯 Testing backlinks for page: ${pageId}`);
  console.log('=' .repeat(60));
  
  try {
    // Import required functions
    const { findBacklinks, extractLinksFromNodes } = await import('./app/firebase/database/links');
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('./app/firebase/config');
    
    // Step 1: Check if the target page exists
    console.log('\n📋 Step 1: Checking target page');
    const { getPageById } = await import('./app/firebase/database/pages');
    
    try {
      const targetPage = await getPageById(pageId);
      if (targetPage) {
        console.log(`✅ Target page exists: "${targetPage.title}"`);
        console.log(`   Public: ${targetPage.isPublic}`);
        console.log(`   Username: ${targetPage.username || 'none'}`);
      } else {
        console.log(`❌ Target page does not exist`);
        return;
      }
    } catch (error) {
      console.log(`❌ Error checking target page: ${error.message}`);
      return;
    }
    
    // Step 2: Manual database query with detailed logging
    console.log('\n📋 Step 2: Manual database query');
    
    const pagesQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc'),
      limit(50) // Smaller limit for testing
    );
    
    const snapshot = await getDocs(pagesQuery);
    console.log(`📊 Found ${snapshot.docs.length} public pages to search through`);
    
    let pagesProcessed = 0;
    let pagesWithContent = 0;
    let pagesWithLinks = 0;
    let pagesWithPageLinks = 0;
    let potentialBacklinks = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      pagesProcessed++;
      
      // Skip the target page itself
      if (doc.id === pageId) {
        console.log(`⏭️  Skipping target page itself: ${doc.id}`);
        continue;
      }
      
      // Skip deleted pages
      if (data.deleted === true) {
        console.log(`⏭️  Skipping deleted page: ${doc.id}`);
        continue;
      }
      
      // Check if page has content
      if (!data.content) {
        console.log(`⏭️  Skipping page without content: "${data.title}" (${doc.id})`);
        continue;
      }
      
      pagesWithContent++;
      console.log(`\n🔍 Analyzing page: "${data.title}" (${doc.id})`);
      
      // Parse content
      let contentNodes;
      if (typeof data.content === 'string') {
        try {
          contentNodes = JSON.parse(data.content);
        } catch (parseError) {
          console.log(`   ❌ Failed to parse content JSON`);
          continue;
        }
      } else if (Array.isArray(data.content)) {
        contentNodes = data.content;
      } else {
        console.log(`   ❌ Unexpected content format: ${typeof data.content}`);
        continue;
      }
      
      // Extract links
      const links = extractLinksFromNodes(contentNodes);
      console.log(`   📊 Extracted ${links.length} total links`);
      
      if (links.length > 0) {
        pagesWithLinks++;
        
        // Filter for page links
        const pageLinks = links.filter(link => link.type === 'page');
        console.log(`   📊 Found ${pageLinks.length} page links`);
        
        if (pageLinks.length > 0) {
          pagesWithPageLinks++;
          
          pageLinks.forEach((link, index) => {
            console.log(`     ${index + 1}. URL: ${link.url}, PageID: ${link.pageId}, Text: "${link.text}"`);
          });
          
          // Check if any link points to our target page
          const hasLinkToTarget = pageLinks.some(link => {
            console.log(`     🔍 Checking if link points to target ${pageId}:`);
            console.log(`        Link type: ${link.type}, pageId: ${link.pageId}, url: ${link.url}`);
            
            // Check for page links that match our target
            if (link.type === 'page' && link.pageId === pageId) {
              console.log(`        ✅ MATCH via pageId: ${link.pageId} === ${pageId}`);
              return true;
            }
            
            // Check for URL-based links that match our target
            if (link.url) {
              // Handle /pages/pageId format
              if (link.url.startsWith('/pages/')) {
                const urlPageId = link.url.replace('/pages/', '').split(/[\/\?#]/)[0];
                console.log(`        🔍 Checking /pages/ format: ${urlPageId} === ${pageId} ? ${urlPageId === pageId}`);
                if (urlPageId === pageId) {
                  console.log(`        ✅ MATCH via /pages/ URL`);
                  return true;
                }
              }
              
              // Handle /pageId format (direct page links)
              if (link.url.startsWith('/') && link.url.length > 1) {
                const urlPageId = link.url.substring(1).split(/[\/\?#]/)[0];
                console.log(`        🔍 Checking direct format: ${urlPageId} === ${pageId} ? ${urlPageId === pageId}`);
                console.log(`        🔍 Contains slash: ${urlPageId.includes('/')} (should be false)`);
                // Only match if it's a simple page ID (no additional path segments)
                if (!urlPageId.includes('/') && urlPageId === pageId) {
                  console.log(`        ✅ MATCH via direct URL`);
                  return true;
                }
              }
            }
            
            console.log(`        ❌ No match`);
            return false;
          });
          
          if (hasLinkToTarget) {
            console.log(`   🎯 POTENTIAL BACKLINK FOUND!`);
            potentialBacklinks.push({
              id: doc.id,
              title: data.title || 'Untitled',
              username: data.username,
              lastModified: data.lastModified,
              isPublic: data.isPublic
            });
          } else {
            console.log(`   ⏭️  No links to target page`);
          }
        }
      }
    }
    
    console.log(`\n📊 Manual Analysis Results:`);
    console.log(`   Pages processed: ${pagesProcessed}`);
    console.log(`   Pages with content: ${pagesWithContent}`);
    console.log(`   Pages with any links: ${pagesWithLinks}`);
    console.log(`   Pages with page links: ${pagesWithPageLinks}`);
    console.log(`   Potential backlinks found: ${potentialBacklinks.length}`);
    
    // Step 3: Compare with findBacklinks function
    console.log('\n📋 Step 3: Testing findBacklinks function');
    
    const officialBacklinks = await findBacklinks(pageId, 20);
    console.log(`🔧 findBacklinks() returned ${officialBacklinks.length} backlinks`);
    
    // Compare results
    if (potentialBacklinks.length === officialBacklinks.length) {
      console.log(`✅ Results match! Both methods found ${potentialBacklinks.length} backlinks`);
    } else {
      console.log(`❌ Results don't match!`);
      console.log(`   Manual analysis: ${potentialBacklinks.length}`);
      console.log(`   findBacklinks(): ${officialBacklinks.length}`);
      console.log(`   This indicates a bug in the findBacklinks function`);
    }
    
    // Step 4: Final conclusion
    console.log('\n📋 Step 4: Final conclusion');
    
    if (potentialBacklinks.length === 0) {
      console.log(`🎯 CONCLUSION: No backlinks exist for page "${pageId}"`);
      console.log(`   This is why the UI shows "No pages link to this page"`);
      console.log(`   This is expected behavior, not a bug.`);
      
      if (pagesWithPageLinks === 0) {
        console.log(`\n💡 ADDITIONAL INFO: No pages in the database contain page links at all.`);
        console.log(`   To test backlinks functionality:`);
        console.log(`   1. Create or edit a page`);
        console.log(`   2. Add a link to another page using the link button`);
        console.log(`   3. Save the page`);
        console.log(`   4. Check backlinks on the linked page`);
      }
    } else {
      console.log(`✅ CONCLUSION: Found ${potentialBacklinks.length} valid backlinks`);
      console.log(`   If the UI still shows "No pages link to this page", there's a bug.`);
    }
    
  } catch (error) {
    console.error('❌ Error in detailed test:', error);
  }
}

// Run the test
testBacklinksWithLogging();
