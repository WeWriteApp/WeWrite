// Debug script to investigate backlinks detection issues
// Run this in the browser console on any page

async function debugBacklinks() {
  console.log('🔍 Starting comprehensive backlinks debug investigation...\n');

  try {
    // Get current page ID from URL
    const currentPageId = window.location.pathname.replace('/', '');
    console.log(`📄 Current page ID: ${currentPageId}`);

    // Import database functions
    const { findBacklinks, extractLinksFromNodes, getPageById } = await import('./app/firebase/database');
    const { getNavigationBacklinks } = await import('./app/utils/navigationTracking');

    // Test 1: Check if current page exists and has content
    console.log('\n🧪 Test 1: Current page analysis');
    try {
      const currentPage = await getPageById(currentPageId);
      if (currentPage) {
        console.log(`✅ Current page found: "${currentPage.title}"`);
        console.log(`📝 Content type: ${typeof currentPage.content}`);
        console.log(`📝 Content length: ${JSON.stringify(currentPage.content).length} characters`);
        console.log(`🔗 Public: ${currentPage.isPublic}`);
        console.log(`👤 Username: ${currentPage.username || 'no username'}`);
        console.log(`🗓️ Last modified: ${currentPage.lastModified}`);

        // Extract links from current page content
        if (currentPage.content) {
          let contentNodes = currentPage.content;
          if (typeof contentNodes === 'string') {
            try {
              contentNodes = JSON.parse(contentNodes);
            } catch (e) {
              console.error('❌ Failed to parse content JSON:', e);
              return;
            }
          }

          const links = extractLinksFromNodes(contentNodes);
          console.log(`🔗 Links found in current page: ${links.length}`);
          links.forEach((link, index) => {
            console.log(`  ${index + 1}. ${link.type}: ${link.url || link.pageId} (${link.text})`);
          });
        }
      } else {
        console.log('❌ Current page not found');
      }
    } catch (error) {
      console.error('❌ Error getting current page:', error);
    }

    // Test 2: Find content-based backlinks to current page
    console.log('\n🧪 Test 2: Content-based backlinks detection');
    try {
      const backlinks = await findBacklinks(currentPageId, 20);
      console.log(`🔗 Content-based backlinks found: ${backlinks.length}`);
      backlinks.forEach((backlink, index) => {
        console.log(`  ${index + 1}. "${backlink.title}" (${backlink.id}) - ${backlink.username || 'no username'}`);
      });

      if (backlinks.length === 0) {
        console.log('⚠️  No content-based backlinks found!');
      }
    } catch (error) {
      console.error('❌ Error finding content-based backlinks:', error);
    }

    // Test 3: Check navigation-based backlinks
    console.log('\n🧪 Test 3: Navigation-based backlinks detection');
    try {
      const navBacklinks = getNavigationBacklinks(currentPageId);
      console.log(`🧭 Navigation-based backlinks found: ${navBacklinks.length}`);
      navBacklinks.forEach((pageId, index) => {
        console.log(`  ${index + 1}. Page ID: ${pageId}`);
      });

      if (navBacklinks.length === 0) {
        console.log('⚠️  No navigation-based backlinks found (this is normal for new sessions)');
      }
    } catch (error) {
      console.error('❌ Error finding navigation-based backlinks:', error);
    }

    // Test 4: Deep dive into database query and link extraction
    console.log('\n🧪 Test 4: Deep database analysis');
    try {
      // Get some public pages to analyze
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      const { db } = await import('./app/firebase/config');

      const pagesQuery = query(
        collection(db, 'pages'),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(pagesQuery);
      console.log(`📄 Found ${snapshot.docs.length} recent public pages to analyze`);

      const pagesWithLinks = [];
      let pagesProcessed = 0;
      let pagesWithContent = 0;
      let pagesWithInternalLinks = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        pagesProcessed++;

        if (!data.content) {
          console.log(`  📄 "${data.title}" (${doc.id}) - No content`);
          continue;
        }

        pagesWithContent++;

        // Parse content
        let contentNodes = data.content;
        if (typeof contentNodes === 'string') {
          try {
            contentNodes = JSON.parse(contentNodes);
          } catch (e) {
            console.log(`  📄 "${data.title}" (${doc.id}) - Failed to parse content JSON`);
            continue;
          }
        }

        // Extract links
        const links = extractLinksFromNodes(contentNodes);
        const internalLinks = links.filter(link =>
          link.type === 'page' ||
          (link.url && (link.url.startsWith('/') || link.url.includes('wewrite.app')))
        );

        if (internalLinks.length > 0) {
          pagesWithInternalLinks++;
          pagesWithLinks.push({
            id: doc.id,
            title: data.title,
            linkCount: internalLinks.length,
            links: internalLinks
          });

          console.log(`  📄 "${data.title}" (${doc.id}) has ${internalLinks.length} internal links:`);
          internalLinks.forEach(link => {
            console.log(`    → ${link.type}: ${link.url || link.pageId} (${link.text})`);
          });
        }
      }

      console.log(`\n📊 Database Analysis Summary:`);
      console.log(`  - Pages processed: ${pagesProcessed}`);
      console.log(`  - Pages with content: ${pagesWithContent}`);
      console.log(`  - Pages with internal links: ${pagesWithInternalLinks}`);

      // Test backlinks for pages that should have them
      if (pagesWithLinks.length > 0) {
        console.log('\n🧪 Test 5: Cross-reference backlinks detection');

        let testCasesFound = 0;
        let correctBacklinks = 0;

        for (const pageWithLinks of pagesWithLinks.slice(0, 3)) { // Test first 3 to avoid too many requests
          for (const link of pageWithLinks.links.slice(0, 2)) { // Test first 2 links per page
            const targetPageId = link.pageId || (link.url && link.url.replace(/^\//, '').split('/')[0]);

            if (targetPageId && targetPageId !== pageWithLinks.id && targetPageId.length > 5) {
              console.log(`\n🔍 Testing backlinks for page: ${targetPageId}`);
              try {
                const targetBacklinks = await findBacklinks(targetPageId, 15);
                console.log(`  📊 Found ${targetBacklinks.length} backlinks for ${targetPageId}`);

                const hasExpectedBacklink = targetBacklinks.some(bl => bl.id === pageWithLinks.id);
                if (!hasExpectedBacklink) {
                  testCasesFound++;
                  console.log(`  ⚠️  ISSUE FOUND: Page "${pageWithLinks.title}" (${pageWithLinks.id}) links to ${targetPageId} but is NOT in its backlinks!`);
                  console.log(`  🎯 TEST CASE: Use page ${targetPageId} to debug backlinks detection`);
                  console.log(`  🔗 Expected backlink from: "${pageWithLinks.title}" (${pageWithLinks.id})`);
                } else {
                  correctBacklinks++;
                  console.log(`  ✅ Backlink correctly detected`);
                }
              } catch (error) {
                console.error(`  ❌ Error testing backlinks for ${targetPageId}:`, error);
              }
            }
          }
        }

        console.log(`\n📊 Backlinks Test Summary:`);
        console.log(`  - Issues found: ${testCasesFound}`);
        console.log(`  - Correct backlinks: ${correctBacklinks}`);

        if (testCasesFound > 0) {
          console.log(`\n🚨 BACKLINKS DETECTION ISSUE CONFIRMED!`);
          console.log(`   ${testCasesFound} cases where expected backlinks were not found.`);
        }
      }

    } catch (error) {
      console.error('❌ Error in deep database analysis:', error);
    }
    
    console.log('\n✅ Backlinks debug investigation completed!');
    console.log('\n📋 Summary:');
    console.log('- Check the console output above for any issues or test cases');
    console.log('- Look for "ISSUE" and "TEST CASE FOUND" messages');
    console.log('- If no backlinks are found where expected, there may be a detection problem');
    
  } catch (error) {
    console.error('❌ Fatal error in debug script:', error);
  }
}

// Auto-run the debug script
debugBacklinks();
