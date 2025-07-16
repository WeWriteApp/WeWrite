/**
 * Browser-based Test Data Setup
 * 
 * Run this script in the browser console while logged in as testuser2
 * to create test token allocations for testuser1.
 * 
 * Instructions:
 * 1. Log in as testuser2
 * 2. Open browser console
 * 3. Copy and paste this entire script
 * 4. Run setupTestTokenAllocations()
 */

async function setupTestTokenAllocations() {
  console.log('🎯 Setting up test token allocations...');
  
  try {
    // First, let's create some test pages for testuser1 if they don't exist
    const testPages = await createTestPagesForTestUser1();
    
    // Then create token allocations from testuser2 to testuser1's pages
    const allocations = await createTokenAllocations(testPages);
    
    console.log('✅ Test setup complete!');
    console.log('📊 Summary:');
    console.log(`- Created ${testPages.length} test pages for testuser1`);
    console.log(`- Created ${allocations.length} token allocations`);
    console.log('\n🔄 Now log out and log in as testuser1 to see the earnings!');
    
    return {
      success: true,
      testPages,
      allocations
    };
    
  } catch (error) {
    console.error('❌ Error setting up test data:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function createTestPagesForTestUser1() {
  console.log('📄 Creating test pages for testuser1...');
  
  // We'll use the mock token earnings API to create some earnings data
  try {
    const response = await fetch('/api/admin/mock-token-earnings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tokenAmount: 25,
        month: getCurrentMonth()
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Created mock earnings for testuser1:', result);
    } else {
      console.warn('⚠️ Could not create mock earnings, but continuing...');
    }
  } catch (error) {
    console.warn('⚠️ Mock earnings creation failed:', error.message);
  }
  
  // Return some mock page data (these would normally be created through the UI)
  return [
    {
      id: 'mock_page_1',
      title: 'Getting Started with WeWrite',
      authorId: 'dev_test_user_1' // testuser1's UID
    },
    {
      id: 'mock_page_2', 
      title: 'Advanced Writing Techniques',
      authorId: 'dev_test_user_1' // testuser1's UID
    }
  ];
}

async function createTokenAllocations(testPages) {
  console.log('🎯 Creating token allocations...');
  
  const allocations = [];
  
  for (const page of testPages) {
    try {
      const response = await fetch('/api/tokens/pending-allocations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientUserId: 'dev_test_user_1', // testuser1's UID
          resourceType: 'page',
          resourceId: page.id,
          tokens: 15
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Created allocation: 15 tokens → ${page.title}`);
        allocations.push({
          pageId: page.id,
          pageTitle: page.title,
          tokens: 15,
          result
        });
      } else {
        const error = await response.json();
        console.warn(`⚠️ Failed to create allocation for ${page.title}:`, error);
      }
    } catch (error) {
      console.error(`❌ Error creating allocation for ${page.title}:`, error);
    }
  }
  
  return allocations;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Alternative: Create simulated token data for immediate testing
function createSimulatedTokenData() {
  console.log('🎭 Creating simulated token data for immediate testing...');
  
  // This creates localStorage-based simulated data that will show up immediately
  const simulatedData = {
    tokenEarnings: {
      lockedAvailable: true,
      fundedPending: true,
      unfundedPending: false,
      unfundedLoggedOut: false
    }
  };
  
  // Store in localStorage for the admin state simulator
  localStorage.setItem('wewrite_admin_simulated_token_earnings', JSON.stringify(simulatedData));
  
  console.log('✅ Simulated token data created!');
  console.log('🔄 Refresh the page to see the simulated earnings data');
  
  return simulatedData;
}

// Helper function to check current user
function getCurrentUser() {
  // This would need to be adapted based on how the app stores user info
  console.log('Current user info would be checked here');
  return null;
}

// Instructions for use
console.log(`
🎯 Test Token Allocation Setup Script Loaded!

To set up test data:

Option 1 - Real Data (requires being logged in as testuser2):
  setupTestTokenAllocations()

Option 2 - Simulated Data (works immediately):
  createSimulatedTokenData()

After running either option, log in as testuser1 to see the earnings!
`);

// Export functions for use
window.setupTestTokenAllocations = setupTestTokenAllocations;
window.createSimulatedTokenData = createSimulatedTokenData;
