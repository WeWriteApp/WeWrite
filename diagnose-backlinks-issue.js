// Comprehensive backlinks diagnosis - paste into browser console

async function diagnoseBacklinksIssue() {
  console.log('🔍 COMPREHENSIVE BACKLINKS DIAGNOSIS\n');
  console.log('This will identify the exact cause of the backlinks issue.\n');
  
  try {
    // Step 1: Test link extraction logic
    console.log('STEP 1: Testing link extraction logic');
    console.log('=' .repeat(50));
    
    const { extractLinksFromNodes } = await import('./app/firebase/database/links');
    
    // Test with editor-created link format
    const testLink = {
      type: "link",
      url: "/test-page-123",
      pageId: "test-page-123",
      pageTitle: "Test Page",
      isPageLink: true,
      children: [{ text: "Test Page" }]
    };
    
    const testContent = [{
      type: 'paragraph',
      children: [
        { text: 'Link to ' },
        testLink,
        { text: '.' }
      ]
    }];
    
    const extracted = extractLinksFromNodes(testContent);
    console.log(`✅ Extracted ${extracted.length} links from test content`);
    
    if (extracted.length > 0) {
      const link = extracted[0];
      console.log(`   Type: ${link.type}, PageID: ${link.pageId}, URL: ${link.url}`);
      
      if (link.type === 'page' && link.pageId === 'test-page-123') {
        console.log('✅ Link extraction is working correctly');
      } else {
        console.log('❌ Link extraction has issues');
        return;
      }
    } else {
      console.log('❌ No links extracted - extraction logic is broken');
      return;
    }
    
    // Step 2: Test database query
    console.log('\nSTEP 2: Testing database query');
    console.log('=' .repeat(50));
    
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const { db } = await import('./app/firebase/config');
    
    const pagesQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc'),
      limit(20)
    );
    
    const snapshot = await getDocs(pagesQuery);
    console.log(`✅ Database query returned ${snapshot.docs.length} pages`);
    
    // Step 3: Analyze database content
    console.log('\nSTEP 3: Analyzing database content');
    console.log('=' .repeat(50));
    
    let totalPages = 0;
    let pagesWithContent = 0;
    let pagesWithValidContent = 0;
    let pagesWithPageLinks = 0;
    let totalPageLinks = 0;
    const linkExamples = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      totalPages++;
      
      if (!data.content) continue;
      pagesWithContent++;
      
      // Parse content
      let contentNodes;
      if (typeof data.content === 'string') {
        try {
          contentNodes = JSON.parse(data.content);
          pagesWithValidContent++;
        } catch (e) {
          console.log(`⚠️  Failed to parse content for "${data.title}" (${doc.id})`);
          continue;
        }
      } else if (Array.isArray(data.content)) {
        contentNodes = data.content;
        pagesWithValidContent++;
      } else {
        continue;
      }
      
      // Extract links
      const links = extractLinksFromNodes(contentNodes);
      const pageLinks = links.filter(link => link.type === 'page');
      
      if (pageLinks.length > 0) {
        pagesWithPageLinks++;
        totalPageLinks += pageLinks.length;
        
        // Store examples for testing
        pageLinks.forEach(link => {
          linkExamples.push({
            sourcePageId: doc.id,
            sourcePageTitle: data.title,
            targetPageId: link.pageId,
            linkUrl: link.url,
            linkText: link.text
          });
        });
        
        console.log(`📄 "${data.title}" (${doc.id}) has ${pageLinks.length} page links:`);
        pageLinks.forEach(link => {
          console.log(`   → ${link.url} (pageId: ${link.pageId}, text: "${link.text}")`);
        });
      }
    }
    
    console.log(`\n📊 Database Analysis Results:`);
    console.log(`   Total pages analyzed: ${totalPages}`);
    console.log(`   Pages with content: ${pagesWithContent}`);
    console.log(`   Pages with valid content: ${pagesWithValidContent}`);
    console.log(`   Pages with page links: ${pagesWithPageLinks}`);
    console.log(`   Total page links found: ${totalPageLinks}`);
    
    if (pagesWithPageLinks === 0) {
      console.log('\n🎯 ROOT CAUSE IDENTIFIED: NO PAGE LINKS IN DATABASE');
      console.log('   The backlinks section shows "No pages link to this page" because');
      console.log('   there are literally no pages in the database that contain links to other pages.');
      console.log('\n💡 SOLUTION:');
      console.log('   1. Create a test page');
      console.log('   2. Add a link to another page using the link editor');
      console.log('   3. Save the page');
      console.log('   4. Check the backlinks section on the linked page');
      console.log('\n   This is not a bug - it\'s expected behavior when no links exist.');
      return;
    }
    
    // Step 4: Test backlinks detection with real data
    console.log('\nSTEP 4: Testing backlinks detection with real data');
    console.log('=' .repeat(50));
    
    const { findBacklinks } = await import('./app/firebase/database/links');
    
    // Test backlinks for the first few linked pages
    const testedTargets = new Set();
    let testsRun = 0;
    let issuesFound = 0;
    
    for (const example of linkExamples.slice(0, 5)) { // Test first 5 examples
      if (testedTargets.has(example.targetPageId) || testsRun >= 3) continue;
      
      testedTargets.add(example.targetPageId);
      testsRun++;
      
      console.log(`\n🔍 Testing backlinks for page: ${example.targetPageId}`);
      console.log(`   Expected backlink from: "${example.sourcePageTitle}" (${example.sourcePageId})`);
      
      const backlinks = await findBacklinks(example.targetPageId, 10);
      console.log(`   Found ${backlinks.length} backlinks`);
      
      const hasExpectedBacklink = backlinks.some(bl => bl.id === example.sourcePageId);
      
      if (hasExpectedBacklink) {
        console.log(`   ✅ SUCCESS: Expected backlink found`);
      } else {
        issuesFound++;
        console.log(`   ❌ ISSUE: Expected backlink NOT found`);
        console.log(`   🔍 Debugging this specific case...`);
        
        // Check if target page exists
        const { getPageById } = await import('./app/firebase/database/pages');
        try {
          const targetPage = await getPageById(example.targetPageId);
          if (targetPage) {
            console.log(`   ✅ Target page exists: "${targetPage.title}"`);
            console.log(`   🚨 This indicates a bug in the backlinks detection logic!`);
          } else {
            console.log(`   ❌ Target page does not exist - link is broken`);
          }
        } catch (error) {
          console.log(`   ❌ Error checking target page: ${error.message}`);
        }
      }
    }
    
    // Step 5: Final diagnosis
    console.log('\nSTEP 5: Final diagnosis');
    console.log('=' .repeat(50));
    
    if (issuesFound === 0) {
      console.log('✅ DIAGNOSIS: Backlinks detection is working correctly!');
      console.log('   If you\'re seeing "No pages link to this page", it\'s because');
      console.log('   no pages actually link to the current page you\'re viewing.');
    } else {
      console.log(`❌ DIAGNOSIS: Found ${issuesFound} issues with backlinks detection`);
      console.log('   There is a bug in the backlinks detection system that needs to be fixed.');
      
      // Provide specific debugging info
      console.log('\n🔧 DEBUG INFO FOR DEVELOPERS:');
      console.log('   - Link extraction logic: ✅ Working');
      console.log('   - Database query: ✅ Working');
      console.log('   - Content parsing: ✅ Working');
      console.log('   - Backlinks matching: ❌ Has issues');
      console.log('\n   The issue is likely in the findBacklinks function\'s matching logic.');
    }
    
    console.log('\n✅ Diagnosis completed!');
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  }
}

// Run the diagnosis
diagnoseBacklinksIssue();
