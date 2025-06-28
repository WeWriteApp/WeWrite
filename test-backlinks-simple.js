// Simple backlinks test - paste this into browser console
// This will test the backlinks detection system step by step

async function testBacklinksDetection() {
  console.log('🧪 Testing Backlinks Detection System\n');
  
  try {
    // Step 1: Test link extraction function
    console.log('Step 1: Testing link extraction...');
    
    // Create test content with internal links
    const testContent = [
      {
        type: 'paragraph',
        children: [
          { text: 'This is a test page with a link to ' },
          {
            type: 'link',
            url: '/test-target-page',
            children: [{ text: 'another page' }]
          },
          { text: ' and also to ' },
          {
            type: 'link',
            url: '/another-test-page',
            children: [{ text: 'second page' }]
          }
        ]
      }
    ];
    
    // Import the link extraction function
    const { extractLinksFromNodes } = await import('./app/firebase/database/links');
    const extractedLinks = extractLinksFromNodes(testContent);
    
    console.log(`✅ Extracted ${extractedLinks.length} links from test content:`);
    extractedLinks.forEach((link, i) => {
      console.log(`  ${i + 1}. Type: ${link.type}, URL: ${link.url}, PageID: ${link.pageId}, Text: ${link.text}`);
    });
    
    // Step 2: Test database query
    console.log('\nStep 2: Testing database query...');
    
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('./app/firebase/config');
    
    const pagesQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc'),
      limit(5)
    );
    
    const snapshot = await getDocs(pagesQuery);
    console.log(`✅ Database query returned ${snapshot.docs.length} pages`);
    
    // Step 3: Test content parsing and link detection
    console.log('\nStep 3: Testing content parsing...');
    
    let foundLinksInDatabase = false;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      if (!data.content) continue;
      
      // Parse content
      let contentNodes;
      if (typeof data.content === 'string') {
        try {
          contentNodes = JSON.parse(data.content);
        } catch (e) {
          console.log(`❌ Failed to parse content for ${doc.id}`);
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
        foundLinksInDatabase = true;
        console.log(`✅ Found ${internalLinks.length} internal links in "${data.title}" (${doc.id}):`);
        internalLinks.forEach(link => {
          console.log(`  → ${link.url || link.pageId} (${link.text})`);
        });
        
        // Test backlinks detection for the first linked page
        const firstLink = internalLinks[0];
        const targetPageId = firstLink.pageId || (firstLink.url && firstLink.url.replace(/^\//, '').split('/')[0]);
        
        if (targetPageId) {
          console.log(`\nStep 4: Testing backlinks detection for ${targetPageId}...`);
          
          const { findBacklinks } = await import('./app/firebase/database/links');
          const backlinks = await findBacklinks(targetPageId, 10);
          
          console.log(`📊 Found ${backlinks.length} backlinks for ${targetPageId}`);
          
          const hasExpectedBacklink = backlinks.some(bl => bl.id === doc.id);
          if (hasExpectedBacklink) {
            console.log(`✅ SUCCESS: Backlink correctly detected!`);
          } else {
            console.log(`❌ ISSUE: Expected backlink from "${data.title}" (${doc.id}) not found!`);
            console.log(`🔍 This indicates a problem with the backlinks detection system.`);
            
            // Debug the specific issue
            console.log('\nDebugging the issue...');
            console.log(`Target page ID: ${targetPageId}`);
            console.log(`Source page ID: ${doc.id}`);
            console.log(`Source page title: ${data.title}`);
            console.log(`Link found: ${firstLink.url || firstLink.pageId} (${firstLink.text})`);
            console.log(`Link type: ${firstLink.type}`);
            
            // Check if the target page exists
            const { getPageById } = await import('./app/firebase/database/pages');
            try {
              const targetPage = await getPageById(targetPageId);
              if (targetPage) {
                console.log(`✅ Target page exists: "${targetPage.title}"`);
              } else {
                console.log(`❌ Target page does not exist - this explains why no backlink was found`);
              }
            } catch (error) {
              console.log(`❌ Error checking target page: ${error.message}`);
            }
          }
        }
        
        break; // Only test the first page with links
      }
    }
    
    if (!foundLinksInDatabase) {
      console.log('⚠️  No internal links found in recent pages. This might be why backlinks appear empty.');
      console.log('   Try creating some test pages with internal links to test the system.');
    }
    
    console.log('\n✅ Backlinks detection test completed!');
    
  } catch (error) {
    console.error('❌ Error during backlinks test:', error);
  }
}

// Run the test
testBacklinksDetection();
