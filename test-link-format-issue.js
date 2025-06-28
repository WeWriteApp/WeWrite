// Test to identify the specific link format issue
// Paste this into browser console

async function testLinkFormatIssue() {
  console.log('🔍 Testing Link Format Issue\n');
  
  try {
    // Import the link extraction function
    const { extractLinksFromNodes } = await import('./app/firebase/database/links');
    
    // Test the exact format that the editor creates
    console.log('📝 Testing editor-created link format:');
    
    const editorCreatedLink = [
      {
        type: 'paragraph',
        children: [
          { text: 'This is a link to ' },
          {
            type: "link",
            url: "/test-page-123",  // This is how the editor creates links
            pageId: "test-page-123",
            pageTitle: "Test Page",
            originalPageTitle: "Test Page",
            className: "page-link",
            isPageLink: true,
            children: [{ text: "Test Page" }]
          },
          { text: ' in the content.' }
        ]
      }
    ];
    
    const extractedLinks = extractLinksFromNodes(editorCreatedLink);
    console.log(`Extracted ${extractedLinks.length} links:`);
    extractedLinks.forEach((link, i) => {
      console.log(`  ${i + 1}. Type: ${link.type}, URL: ${link.url}, PageID: ${link.pageId}, Text: ${link.text}`);
    });
    
    // Test the matching logic from findBacklinks
    console.log('\n🔍 Testing backlinks matching logic:');
    
    const targetPageId = 'test-page-123';
    let matchFound = false;
    
    for (const link of extractedLinks) {
      console.log(`\nTesting link: ${JSON.stringify(link, null, 2)}`);
      
      // This is the exact logic from findBacklinks function
      let isMatch = false;
      
      // Check for page links that match our target
      if (link.type === 'page' && link.pageId === targetPageId) {
        console.log(`✅ Match found via pageId: ${link.pageId} === ${targetPageId}`);
        isMatch = true;
      }
      
      // Check for URL-based links that match our target
      if (link.url) {
        console.log(`Checking URL: ${link.url}`);
        
        // Handle /pages/pageId format
        if (link.url.startsWith('/pages/')) {
          const urlPageId = link.url.replace('/pages/', '').split(/[\/\?#]/)[0];
          console.log(`  /pages/ format check: ${urlPageId} === ${targetPageId} ? ${urlPageId === targetPageId}`);
          if (urlPageId === targetPageId) {
            isMatch = true;
          }
        }
        
        // Handle /pageId format (direct page links)
        if (link.url.startsWith('/') && link.url.length > 1) {
          const urlPageId = link.url.substring(1).split(/[\/\?#]/)[0];
          console.log(`  Direct format check: ${urlPageId} === ${targetPageId} ? ${urlPageId === targetPageId}`);
          console.log(`  Contains slash check: ${urlPageId.includes('/')} (should be false)`);
          // Only match if it's a simple page ID (no additional path segments)
          if (!urlPageId.includes('/') && urlPageId === targetPageId) {
            console.log(`✅ Match found via direct URL: ${urlPageId} === ${targetPageId}`);
            isMatch = true;
          }
        }
      }
      
      if (isMatch) {
        matchFound = true;
        console.log(`✅ OVERALL MATCH: This link would be detected as a backlink`);
      } else {
        console.log(`❌ NO MATCH: This link would NOT be detected as a backlink`);
      }
    }
    
    if (!matchFound) {
      console.log(`\n🚨 CRITICAL ISSUE: Editor-created links are not being matched by backlinks detection!`);
    }
    
    // Test with real database content to confirm
    console.log('\n🗄️ Testing with real database content:');
    
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('./app/firebase/config');
    
    const pagesQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc'),
      limit(5)
    );
    
    const snapshot = await getDocs(pagesQuery);
    console.log(`Found ${snapshot.docs.length} pages to analyze`);
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      if (!data.content) continue;
      
      // Parse content
      let contentNodes;
      if (typeof data.content === 'string') {
        try {
          contentNodes = JSON.parse(data.content);
        } catch (e) {
          continue;
        }
      } else {
        contentNodes = data.content;
      }
      
      // Extract links
      const links = extractLinksFromNodes(contentNodes);
      const pageLinks = links.filter(link => link.type === 'page');
      
      if (pageLinks.length > 0) {
        console.log(`\n📄 Page: "${data.title}" (${doc.id})`);
        console.log(`Found ${pageLinks.length} page links:`);
        
        pageLinks.forEach((link, i) => {
          console.log(`  ${i + 1}. URL: ${link.url}, PageID: ${link.pageId}, Type: ${link.type}`);
          console.log(`      Has isPageLink: ${!!link.isPageLink}`);
          console.log(`      Has pageId property: ${!!link.pageId}`);
          
          // Test if this link would be detected in backlinks
          const targetId = link.pageId || (link.url && link.url.replace(/^\//, '').split('/')[0]);
          if (targetId) {
            // Simulate the findBacklinks matching logic
            let wouldMatch = false;
            
            if (link.type === 'page' && link.pageId === targetId) {
              wouldMatch = true;
            } else if (link.url) {
              if (link.url.startsWith('/pages/')) {
                const urlPageId = link.url.replace('/pages/', '').split(/[\/\?#]/)[0];
                if (urlPageId === targetId) wouldMatch = true;
              } else if (link.url.startsWith('/') && link.url.length > 1) {
                const urlPageId = link.url.substring(1).split(/[\/\?#]/)[0];
                if (!urlPageId.includes('/') && urlPageId === targetId) wouldMatch = true;
              }
            }
            
            console.log(`      Would be detected as backlink: ${wouldMatch ? '✅ YES' : '❌ NO'}`);
            
            if (!wouldMatch) {
              console.log(`      🚨 ISSUE: This link won't create a backlink!`);
            }
          }
        });
        
        break; // Only analyze the first page with links
      }
    }
    
    console.log('\n✅ Link format issue test completed!');
    
  } catch (error) {
    console.error('❌ Error during link format test:', error);
  }
}

// Run the test
testLinkFormatIssue();
