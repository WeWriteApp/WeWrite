// Simple test of link extraction - paste into browser console

async function testSimpleExtraction() {
  console.log('🧪 Simple Link Extraction Test\n');
  
  try {
    // Import the function
    const { extractLinksFromNodes } = await import('./app/firebase/database/links');
    
    // Test with the exact structure the editor creates
    const testContent = [
      {
        type: 'paragraph',
        children: [
          { text: 'Here is a link to ' },
          {
            type: "link",
            url: "/my-test-page",
            pageId: "my-test-page",
            pageTitle: "My Test Page",
            originalPageTitle: "My Test Page",
            className: "page-link",
            isPageLink: true,
            children: [{ text: "My Test Page" }]
          },
          { text: ' and that is it.' }
        ]
      }
    ];
    
    console.log('Input content:');
    console.log(JSON.stringify(testContent, null, 2));
    
    const extracted = extractLinksFromNodes(testContent);
    
    console.log('\nExtracted links:');
    console.log(JSON.stringify(extracted, null, 2));
    
    if (extracted.length === 1) {
      const link = extracted[0];
      console.log('\n✅ Successfully extracted 1 link:');
      console.log(`  Type: ${link.type}`);
      console.log(`  URL: ${link.url}`);
      console.log(`  PageID: ${link.pageId}`);
      console.log(`  Text: ${link.text}`);
      
      if (link.type === 'page' && link.pageId === 'my-test-page') {
        console.log('✅ Link extraction is working correctly!');
        
        // Now test the backlinks matching logic
        console.log('\n🔍 Testing backlinks matching logic:');
        
        const targetPageId = 'my-test-page';
        let wouldMatch = false;
        
        // This is the exact logic from findBacklinks
        if (link.type === 'page' && link.pageId === targetPageId) {
          wouldMatch = true;
          console.log('✅ Would match via pageId property');
        }
        
        if (link.url) {
          if (link.url.startsWith('/pages/')) {
            const urlPageId = link.url.replace('/pages/', '').split(/[\/\?#]/)[0];
            if (urlPageId === targetPageId) {
              wouldMatch = true;
              console.log('✅ Would match via /pages/ URL format');
            }
          }
          
          if (link.url.startsWith('/') && link.url.length > 1) {
            const urlPageId = link.url.substring(1).split(/[\/\?#]/)[0];
            if (!urlPageId.includes('/') && urlPageId === targetPageId) {
              wouldMatch = true;
              console.log('✅ Would match via direct URL format');
            }
          }
        }
        
        if (wouldMatch) {
          console.log('✅ Backlinks matching logic is working correctly!');
          console.log('\n🤔 The issue might be elsewhere...');
          
          // Let's test with a real database query
          console.log('\n🗄️ Testing with real database to find the actual issue:');
          
          const { findBacklinks } = await import('./app/firebase/database/links');
          
          // Test with a known page ID
          console.log('Testing findBacklinks function directly...');
          
          const backlinks = await findBacklinks('my-test-page', 5);
          console.log(`Found ${backlinks.length} backlinks for 'my-test-page'`);
          
          if (backlinks.length === 0) {
            console.log('⚠️  No backlinks found - this suggests the issue is in the database query or data');
            
            // Let's check what pages exist in the database
            const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
            const { db } = await import('./app/firebase/config');
            
            const pagesQuery = query(
              collection(db, 'pages'),
              where('isPublic', '==', true),
              orderBy('lastModified', 'desc'),
              limit(10)
            );
            
            const snapshot = await getDocs(pagesQuery);
            console.log(`\nFound ${snapshot.docs.length} public pages in database:`);
            
            let pagesWithContent = 0;
            let pagesWithLinks = 0;
            
            for (const doc of snapshot.docs) {
              const data = doc.data();
              console.log(`  📄 "${data.title}" (${doc.id}) - Has content: ${!!data.content}`);
              
              if (data.content) {
                pagesWithContent++;
                
                // Parse and check for links
                let contentNodes;
                if (typeof data.content === 'string') {
                  try {
                    contentNodes = JSON.parse(data.content);
                  } catch (e) {
                    console.log(`    ❌ Failed to parse content`);
                    continue;
                  }
                } else {
                  contentNodes = data.content;
                }
                
                const links = extractLinksFromNodes(contentNodes);
                const pageLinks = links.filter(l => l.type === 'page');
                
                if (pageLinks.length > 0) {
                  pagesWithLinks++;
                  console.log(`    🔗 Has ${pageLinks.length} page links`);
                  pageLinks.forEach(link => {
                    console.log(`      → ${link.url} (pageId: ${link.pageId})`);
                  });
                }
              }
            }
            
            console.log(`\n📊 Database Summary:`);
            console.log(`  - Total public pages: ${snapshot.docs.length}`);
            console.log(`  - Pages with content: ${pagesWithContent}`);
            console.log(`  - Pages with page links: ${pagesWithLinks}`);
            
            if (pagesWithLinks === 0) {
              console.log('\n🎯 ROOT CAUSE FOUND: No pages in the database contain page links!');
              console.log('   This explains why backlinks are always empty.');
              console.log('   To test backlinks, you need to:');
              console.log('   1. Create a page');
              console.log('   2. Add a link to another page in that content');
              console.log('   3. Save the page');
              console.log('   4. Check backlinks on the linked page');
            }
          }
          
        } else {
          console.log('❌ Backlinks matching logic has an issue!');
        }
        
      } else {
        console.log('❌ Link extraction failed - wrong type or pageId');
      }
    } else {
      console.log(`❌ Expected 1 link, got ${extracted.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testSimpleExtraction();
