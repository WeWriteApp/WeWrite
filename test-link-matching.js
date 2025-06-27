// Test link matching logic - paste this into browser console
// This tests the specific logic used in findBacklinks to match links

async function testLinkMatching() {
  console.log('🔍 Testing Link Matching Logic\n');
  
  try {
    // Import the link extraction function
    const { extractLinksFromNodes } = await import('./app/firebase/database/links');
    
    // Test different link formats that should be detected
    const testCases = [
      {
        name: 'Direct page link',
        content: [{
          type: 'paragraph',
          children: [
            { text: 'Link to ' },
            { type: 'link', url: '/test-page-123', children: [{ text: 'test page' }] },
            { text: '.' }
          ]
        }],
        targetPageId: 'test-page-123'
      },
      {
        name: 'Pages format link',
        content: [{
          type: 'paragraph',
          children: [
            { text: 'Link to ' },
            { type: 'link', url: '/pages/test-page-456', children: [{ text: 'test page' }] },
            { text: '.' }
          ]
        }],
        targetPageId: 'test-page-456'
      },
      {
        name: 'Page link with pageId property',
        content: [{
          type: 'paragraph',
          children: [
            { text: 'Link to ' },
            { type: 'link', pageId: 'test-page-789', url: '/test-page-789', children: [{ text: 'test page' }] },
            { text: '.' }
          ]
        }],
        targetPageId: 'test-page-789'
      },
      {
        name: 'WeWrite domain link',
        content: [{
          type: 'paragraph',
          children: [
            { text: 'Link to ' },
            { type: 'link', url: 'https://wewrite.app/test-page-abc', children: [{ text: 'test page' }] },
            { text: '.' }
          ]
        }],
        targetPageId: 'test-page-abc'
      }
    ];
    
    console.log('Testing link extraction for different formats:\n');
    
    for (const testCase of testCases) {
      console.log(`📝 Testing: ${testCase.name}`);
      
      // Extract links from test content
      const extractedLinks = extractLinksFromNodes(testCase.content);
      console.log(`  Extracted ${extractedLinks.length} links:`);
      
      extractedLinks.forEach((link, i) => {
        console.log(`    ${i + 1}. Type: ${link.type}, URL: ${link.url}, PageID: ${link.pageId}, Text: ${link.text}`);
      });
      
      // Test the matching logic used in findBacklinks
      const targetPageId = testCase.targetPageId;
      let matchFound = false;
      
      for (const link of extractedLinks) {
        // This is the same logic used in findBacklinks function
        let isMatch = false;
        
        // Check for page links that match our target
        if (link.type === 'page' && link.pageId === targetPageId) {
          isMatch = true;
        }
        
        // Check for URL-based links that match our target
        if (link.url) {
          // Handle /pages/pageId format
          if (link.url.startsWith('/pages/')) {
            const urlPageId = link.url.replace('/pages/', '').split(/[\/\?#]/)[0];
            if (urlPageId === targetPageId) {
              isMatch = true;
            }
          }
          
          // Handle /pageId format (direct page links)
          if (link.url.startsWith('/') && link.url.length > 1) {
            const urlPageId = link.url.substring(1).split(/[\/\?#]/)[0];
            // Only match if it's a simple page ID (no additional path segments)
            if (!urlPageId.includes('/') && urlPageId === targetPageId) {
              isMatch = true;
            }
          }
          
          // Handle WeWrite domain links
          if (link.url.includes('wewrite.app') || link.url.includes('localhost:3000')) {
            const pageIdMatch = link.url.match(/\/pages\/([^\/\?#]+)/) ||
                               link.url.match(/wewrite\.app\/([^\/\?#]+)/) ||
                               link.url.match(/localhost:3000\/([^\/\?#]+)/);
            if (pageIdMatch && pageIdMatch[1] === targetPageId) {
              isMatch = true;
            }
          }
        }
        
        if (isMatch) {
          matchFound = true;
          console.log(`  ✅ MATCH FOUND: Link would be detected as backlink to ${targetPageId}`);
          break;
        }
      }
      
      if (!matchFound) {
        console.log(`  ❌ NO MATCH: Link would NOT be detected as backlink to ${targetPageId}`);
        console.log(`  🔍 This indicates an issue with the link matching logic`);
      }
      
      console.log('');
    }
    
    // Test with real database content
    console.log('🗄️ Testing with real database content:\n');
    
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('./app/firebase/config');
    
    const pagesQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(pagesQuery);
    console.log(`Found ${snapshot.docs.length} pages to test`);
    
    let realTestsRun = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      if (!data.content || realTestsRun >= 3) continue; // Limit to 3 real tests
      
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
      const internalLinks = links.filter(link => 
        link.type === 'page' || 
        (link.url && link.url.startsWith('/') && !link.url.includes('/user/'))
      );
      
      if (internalLinks.length > 0) {
        realTestsRun++;
        console.log(`📄 Testing page: "${data.title}" (${doc.id})`);
        console.log(`  Found ${internalLinks.length} internal links`);
        
        // Test the first internal link
        const firstLink = internalLinks[0];
        const targetPageId = firstLink.pageId || (firstLink.url && firstLink.url.replace(/^\//, '').split('/')[0]);
        
        if (targetPageId) {
          console.log(`  Testing backlink detection for target: ${targetPageId}`);
          
          // Simulate the findBacklinks matching logic
          let wouldMatch = false;
          
          if (firstLink.type === 'page' && firstLink.pageId === targetPageId) {
            wouldMatch = true;
          } else if (firstLink.url) {
            if (firstLink.url.startsWith('/pages/')) {
              const urlPageId = firstLink.url.replace('/pages/', '').split(/[\/\?#]/)[0];
              if (urlPageId === targetPageId) wouldMatch = true;
            } else if (firstLink.url.startsWith('/') && firstLink.url.length > 1) {
              const urlPageId = firstLink.url.substring(1).split(/[\/\?#]/)[0];
              if (!urlPageId.includes('/') && urlPageId === targetPageId) wouldMatch = true;
            }
          }
          
          console.log(`  Link: ${firstLink.url || firstLink.pageId} (type: ${firstLink.type})`);
          console.log(`  Would match: ${wouldMatch ? '✅ YES' : '❌ NO'}`);
          
          if (!wouldMatch) {
            console.log(`  🚨 ISSUE: This link should create a backlink but won't be detected!`);
          }
        }
        
        console.log('');
      }
    }
    
    console.log('✅ Link matching test completed!');
    
  } catch (error) {
    console.error('❌ Error during link matching test:', error);
  }
}

// Run the test
testLinkMatching();
