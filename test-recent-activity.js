// Quick test to create recent activity and check recent edits
const testRecentActivity = async () => {
  try {
    console.log('🧪 Testing recent activity generation...');
    
    // First, let's check what the current recent edits look like
    console.log('📊 Checking current recent edits...');
    const recentEditsResponse = await fetch('https://wewrite.app/api/recent-edits?limit=5');
    const recentEditsData = await recentEditsResponse.json();
    
    console.log('Current recent edits:', {
      count: recentEditsData.edits?.length || 0,
      edits: recentEditsData.edits?.map(edit => ({
        title: edit.title,
        username: edit.username,
        lastModified: edit.lastModified,
        id: edit.id
      })) || []
    });
    
    // Check if we can access the debug endpoint
    console.log('🔍 Checking debug endpoint...');
    try {
      const debugResponse = await fetch('https://wewrite.app/api/debug/recent-edits-analysis?limit=3');
      if (debugResponse.ok) {
        const debugData = await debugResponse.json();
        console.log('Debug analysis:', debugData);
      } else {
        console.log('Debug endpoint not available:', debugResponse.status);
      }
    } catch (error) {
      console.log('Debug endpoint error:', error.message);
    }
    
    // Let's also check what pages exist for a specific user
    console.log('📄 Checking pages for a user...');
    const myPagesResponse = await fetch('https://wewrite.app/api/my-pages?limit=5');
    if (myPagesResponse.ok) {
      const myPagesData = await myPagesResponse.json();
      console.log('My pages:', {
        count: myPagesData.pages?.length || 0,
        pages: myPagesData.pages?.map(page => ({
          title: page.title,
          lastModified: page.lastModified,
          id: page.id
        })) || []
      });
    } else {
      console.log('My pages not accessible (not logged in)');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Run the test
testRecentActivity();
