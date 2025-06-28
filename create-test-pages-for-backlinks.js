// Script to create test pages for backlinks testing
// Paste this into browser console on WeWrite

async function createTestPagesForBacklinks() {
  console.log('🧪 Creating test pages for backlinks testing\n');
  
  try {
    // Check if user is authenticated
    const { useAuth } = await import('./app/providers/AuthProvider');
    
    // Import page creation functions
    const { createPage } = await import('./app/firebase/database/pages');
    
    // Test page 1: Target page (will receive backlinks)
    const targetPageContent = [
      {
        type: 'paragraph',
        children: [
          { text: 'This is the target page that should receive backlinks from other pages.' }
        ]
      },
      {
        type: 'paragraph',
        children: [
          { text: 'If the backlinks system is working, this page should show backlinks from the source pages.' }
        ]
      }
    ];
    
    console.log('📄 Creating target page...');
    const targetPageId = 'backlinks-test-target-' + Date.now();
    
    try {
      const targetPage = await createPage({
        id: targetPageId,
        title: 'Backlinks Test Target Page',
        content: targetPageContent,
        isPublic: true
      });
      
      console.log(`✅ Created target page: ${targetPageId}`);
      console.log(`   URL: ${window.location.origin}/${targetPageId}`);
    } catch (error) {
      console.error('❌ Error creating target page:', error);
      return;
    }
    
    // Test page 2: Source page (will link to target page)
    const sourcePageContent = [
      {
        type: 'paragraph',
        children: [
          { text: 'This is a source page that contains a link to the ' },
          {
            type: "link",
            url: `/${targetPageId}`,
            pageId: targetPageId,
            pageTitle: "Backlinks Test Target Page",
            originalPageTitle: "Backlinks Test Target Page",
            className: "page-link",
            isPageLink: true,
            children: [{ text: "target page" }]
          },
          { text: '.' }
        ]
      },
      {
        type: 'paragraph',
        children: [
          { text: 'This link should create a backlink that appears on the target page.' }
        ]
      }
    ];
    
    console.log('📄 Creating source page...');
    const sourcePageId = 'backlinks-test-source-' + Date.now();
    
    try {
      const sourcePage = await createPage({
        id: sourcePageId,
        title: 'Backlinks Test Source Page',
        content: sourcePageContent,
        isPublic: true
      });
      
      console.log(`✅ Created source page: ${sourcePageId}`);
      console.log(`   URL: ${window.location.origin}/${sourcePageId}`);
    } catch (error) {
      console.error('❌ Error creating source page:', error);
      return;
    }
    
    // Test page 3: Another source page with different link format
    const sourcePageContent2 = [
      {
        type: 'paragraph',
        children: [
          { text: 'This is another source page with a link using /pages/ format: ' },
          {
            type: "link",
            url: `/pages/${targetPageId}`,
            pageId: targetPageId,
            pageTitle: "Backlinks Test Target Page",
            className: "page-link",
            isPageLink: true,
            children: [{ text: "target page" }]
          },
          { text: '.' }
        ]
      }
    ];
    
    console.log('📄 Creating second source page...');
    const sourcePageId2 = 'backlinks-test-source2-' + Date.now();
    
    try {
      const sourcePage2 = await createPage({
        id: sourcePageId2,
        title: 'Backlinks Test Source Page 2',
        content: sourcePageContent2,
        isPublic: true
      });
      
      console.log(`✅ Created second source page: ${sourcePageId2}`);
      console.log(`   URL: ${window.location.origin}/${sourcePageId2}`);
    } catch (error) {
      console.error('❌ Error creating second source page:', error);
      return;
    }
    
    // Wait a moment for database to update
    console.log('\n⏳ Waiting 3 seconds for database to update...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test backlinks detection
    console.log('\n🔍 Testing backlinks detection...');
    
    const { findBacklinks } = await import('./app/firebase/database/links');
    const backlinks = await findBacklinks(targetPageId, 10);
    
    console.log(`\n📊 Backlinks test results:`);
    console.log(`   Target page: ${targetPageId}`);
    console.log(`   Expected backlinks: 2 (from source pages)`);
    console.log(`   Actual backlinks found: ${backlinks.length}`);
    
    if (backlinks.length >= 2) {
      console.log('✅ SUCCESS: Backlinks detection is working correctly!');
      backlinks.forEach((backlink, i) => {
        console.log(`   ${i + 1}. "${backlink.title}" (${backlink.id})`);
      });
    } else if (backlinks.length === 1) {
      console.log('⚠️  PARTIAL SUCCESS: Found 1 backlink, expected 2');
      console.log('   This might indicate an issue with one of the link formats');
      backlinks.forEach((backlink, i) => {
        console.log(`   ${i + 1}. "${backlink.title}" (${backlink.id})`);
      });
    } else {
      console.log('❌ FAILURE: No backlinks found');
      console.log('   This indicates a problem with the backlinks detection system');
    }
    
    console.log('\n📋 Next steps:');
    console.log(`1. Visit the target page: ${window.location.origin}/${targetPageId}`);
    console.log(`2. Check the "What Links Here" section at the bottom`);
    console.log(`3. You should see 2 backlinks from the source pages`);
    console.log(`4. If you don't see them, there's a bug in the backlinks system`);
    
    console.log('\n🧹 Cleanup:');
    console.log('To clean up these test pages, you can delete them from the admin interface or database.');
    
  } catch (error) {
    console.error('❌ Error creating test pages:', error);
    console.log('\n💡 Make sure you are:');
    console.log('1. Logged in to WeWrite');
    console.log('2. Have permission to create pages');
    console.log('3. Running this script on the WeWrite domain');
  }
}

// Run the test
createTestPagesForBacklinks();
