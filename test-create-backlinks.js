// Test script to manually create backlinks for testing
// Run this in the browser console on WeWrite

async function testCreateBacklinks() {
  console.log('🧪 Testing backlinks creation...\n');
  
  try {
    // Get current user
    const { useAuth } = await import('./app/providers/AuthProvider');
    
    // Import required functions
    const { createPage } = await import('./app/firebase/database/pages');
    const { updateBacklinksIndex } = await import('./app/firebase/database/backlinks');
    
    // Get current user info
    const user = firebase.auth().currentUser;
    if (!user) {
      console.error('❌ No authenticated user found');
      return;
    }
    
    console.log(`✅ Authenticated as: ${user.displayName || user.email}`);
    
    // Create a target page first
    console.log('\n1. Creating target page...');
    
    const targetPageData = {
      title: 'Backlinks Test Target Page',
      content: JSON.stringify([
        {
          type: 'paragraph',
          children: [
            { text: 'This is a test page that should receive backlinks from other pages.' }
          ]
        }
      ]),
      isPublic: true,
      location: null,
      groupId: null,
      userId: user.uid,
      username: user.displayName || user.email,
      lastModified: new Date().toISOString(),
      isReply: false
    };
    
    const targetPageId = await createPage(targetPageData);
    if (!targetPageId) {
      console.error('❌ Failed to create target page');
      return;
    }
    
    console.log(`✅ Created target page: ${targetPageId}`);
    
    // Create a source page that links to the target page
    console.log('\n2. Creating source page with link...');
    
    const sourcePageData = {
      title: 'Backlinks Test Source Page',
      content: JSON.stringify([
        {
          type: 'paragraph',
          children: [
            { text: 'This page links to the ' },
            {
              type: 'link',
              url: `/${targetPageId}`,
              children: [{ text: 'target page' }]
            },
            { text: ' for testing backlinks.' }
          ]
        }
      ]),
      isPublic: true,
      location: null,
      groupId: null,
      userId: user.uid,
      username: user.displayName || user.email,
      lastModified: new Date().toISOString(),
      isReply: false
    };
    
    const sourcePageId = await createPage(sourcePageData);
    if (!sourcePageId) {
      console.error('❌ Failed to create source page');
      return;
    }
    
    console.log(`✅ Created source page: ${sourcePageId}`);
    
    // Wait a moment for the database to update
    console.log('\n3. Waiting for database to update...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test backlinks query
    console.log('\n4. Testing backlinks query...');
    
    const { getBacklinks } = await import('./app/firebase/database/backlinks');
    const backlinks = await getBacklinks(targetPageId);
    
    console.log(`✅ Backlinks query completed. Found ${backlinks.length} backlinks:`);
    
    if (backlinks.length > 0) {
      backlinks.forEach((backlink, index) => {
        console.log(`   ${index + 1}. ${backlink.title} (by ${backlink.username})`);
      });
    } else {
      console.log('⚠️ No backlinks found. This could indicate:');
      console.log('   - Backlinks index is not being updated properly');
      console.log('   - Link extraction is not working');
      console.log('   - Firestore indexes are not ready');
    }
    
    // Test direct Firestore query
    console.log('\n5. Testing direct Firestore query...');
    
    const { db } = await import('./app/firebase/config');
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    
    const backlinksRef = collection(db, 'backlinks');
    const targetQuery = query(
      backlinksRef,
      where('targetPageId', '==', targetPageId)
    );
    
    const snapshot = await getDocs(targetQuery);
    console.log(`✅ Direct query found ${snapshot.size} backlinks in Firestore`);
    
    if (snapshot.size > 0) {
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   ${index + 1}. ${data.sourcePageTitle} -> ${data.targetPageId}`);
        console.log(`      Link text: "${data.linkText}"`);
        console.log(`      Public: ${data.isPublic}`);
      });
    }
    
    console.log('\n📊 Test Results:');
    console.log(`- Target page created: ${targetPageId}`);
    console.log(`- Source page created: ${sourcePageId}`);
    console.log(`- Backlinks found via API: ${backlinks.length}`);
    console.log(`- Backlinks found via direct query: ${snapshot.size}`);
    
    console.log('\n🔗 Test URLs:');
    console.log(`- Target page: ${window.location.origin}/${targetPageId}`);
    console.log(`- Source page: ${window.location.origin}/${sourcePageId}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}

// Run the test
testCreateBacklinks();
