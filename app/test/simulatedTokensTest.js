/**
 * Test script for simulated token functionality
 * Run this in the browser console to test localStorage operations
 */

// Import functions (these would need to be available in the browser context)
// For testing, we'll define simplified versions here

const testSimulatedTokens = () => {
  console.log('🧪 Testing Simulated Token Functionality');
  console.log('==========================================');

  // Test 1: Logged-out user token allocation
  console.log('\n1. Testing logged-out user token allocation...');
  
  // Clear any existing data
  localStorage.removeItem('wewrite_simulated_tokens_logged_out');
  
  // Simulate allocating tokens to a page
  const testPageId = 'RFsPq1tbcOMtljwHyIMT';
  const testPageTitle = 'Test Page';
  
  // Test initial state
  const initialData = localStorage.getItem('wewrite_simulated_tokens_logged_out');
  console.log('Initial localStorage data:', initialData);
  
  // Test allocation
  const allocationData = {
    allocatedTokens: 10,
    allocations: [{
      pageId: testPageId,
      pageTitle: testPageTitle,
      tokens: 10,
      timestamp: Date.now()
    }],
    lastUpdated: Date.now()
  };
  
  localStorage.setItem('wewrite_simulated_tokens_logged_out', JSON.stringify(allocationData));
  
  // Verify storage
  const storedData = JSON.parse(localStorage.getItem('wewrite_simulated_tokens_logged_out') || '{}');
  console.log('Stored allocation data:', storedData);
  
  // Test 2: User-specific token allocation
  console.log('\n2. Testing user-specific token allocation...');
  
  const testUserId = 'test_user_123';
  const userStorageKey = `wewrite_simulated_tokens_user_${testUserId}`;
  
  // Clear any existing data
  localStorage.removeItem(userStorageKey);
  
  // Test user allocation
  const userAllocationData = {
    allocatedTokens: 25,
    allocations: [
      {
        pageId: testPageId,
        pageTitle: testPageTitle,
        tokens: 15,
        timestamp: Date.now()
      },
      {
        pageId: 'another_page_id',
        pageTitle: 'Another Page',
        tokens: 10,
        timestamp: Date.now()
      }
    ],
    lastUpdated: Date.now()
  };
  
  localStorage.setItem(userStorageKey, JSON.stringify(userAllocationData));
  
  // Verify user storage
  const userStoredData = JSON.parse(localStorage.getItem(userStorageKey) || '{}');
  console.log('User stored allocation data:', userStoredData);
  
  // Test 3: Token balance calculations
  console.log('\n3. Testing token balance calculations...');
  
  const totalTokens = 100;
  const allocatedTokens = userStoredData.allocatedTokens || 0;
  const availableTokens = totalTokens - allocatedTokens;
  
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Allocated tokens: ${allocatedTokens}`);
  console.log(`Available tokens: ${availableTokens}`);
  
  // Test 4: Multiple page allocations
  console.log('\n4. Testing multiple page allocations...');
  
  const allocations = userStoredData.allocations || [];
  allocations.forEach((allocation, index) => {
    console.log(`Allocation ${index + 1}:`);
    console.log(`  Page: ${allocation.pageTitle} (${allocation.pageId})`);
    console.log(`  Tokens: ${allocation.tokens}`);
    console.log(`  Dollar equivalent: $${(allocation.tokens * 0.10).toFixed(2)}`);
  });
  
  // Test 5: Storage cleanup
  console.log('\n5. Testing storage cleanup...');
  
  console.log('Before cleanup - localStorage keys:');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('wewrite_simulated_tokens')) {
      console.log(`  ${key}`);
    }
  }
  
  // Clean up test data
  localStorage.removeItem('wewrite_simulated_tokens_logged_out');
  localStorage.removeItem(userStorageKey);
  
  console.log('\nAfter cleanup - localStorage keys:');
  let hasSimulatedTokenKeys = false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('wewrite_simulated_tokens')) {
      console.log(`  ${key}`);
      hasSimulatedTokenKeys = true;
    }
  }
  
  if (!hasSimulatedTokenKeys) {
    console.log('  (no simulated token keys found)');
  }
  
  console.log('\n✅ Simulated token tests completed!');
  console.log('==========================================');
  
  return {
    success: true,
    testResults: {
      loggedOutAllocation: !!storedData.allocations,
      userAllocation: !!userStoredData.allocations,
      tokenCalculations: availableTokens >= 0,
      multipleAllocations: allocations.length > 0,
      cleanup: !hasSimulatedTokenKeys
    }
  };
};

// Test the pledge bar visibility and interaction
const testPledgeBarVisibility = () => {
  console.log('\n🎯 Testing Pledge Bar Visibility');
  console.log('=================================');
  
  // Check if pledge bar exists
  const pledgeBar = document.querySelector('[data-pledge-bar]');
  console.log('Pledge bar found:', !!pledgeBar);
  
  if (pledgeBar) {
    console.log('Pledge bar classes:', pledgeBar.className);
    console.log('Pledge bar visibility:', getComputedStyle(pledgeBar).visibility);
    console.log('Pledge bar opacity:', getComputedStyle(pledgeBar).opacity);
    
    // Check for token allocation buttons
    const minusButton = pledgeBar.querySelector('button[disabled]');
    const plusButton = pledgeBar.querySelector('button:not([disabled])');
    
    console.log('Minus button found:', !!minusButton);
    console.log('Plus button found:', !!plusButton);
    
    // Check for token display
    const tokenDisplay = pledgeBar.textContent;
    console.log('Token display text:', tokenDisplay);
    
    // Check for demo/preview indicators
    const demoIndicator = pledgeBar.querySelector('[class*="orange"]') || 
                         pledgeBar.querySelector('[class*="blue"]') ||
                         pledgeBar.textContent?.includes('DEMO') ||
                         pledgeBar.textContent?.includes('PREVIEW');
    console.log('Demo/Preview indicator found:', !!demoIndicator);
  }
  
  console.log('\n✅ Pledge bar visibility test completed!');
  
  return {
    pledgeBarExists: !!pledgeBar,
    hasTokenButtons: !!(pledgeBar?.querySelector('button')),
    hasTokenDisplay: !!(pledgeBar?.textContent?.includes('tokens')),
    hasDemoIndicator: !!(pledgeBar?.textContent?.includes('DEMO') || pledgeBar?.textContent?.includes('PREVIEW'))
  };
};

// Export for browser console use
if (typeof window !== 'undefined') {
  window.testSimulatedTokens = testSimulatedTokens;
  window.testPledgeBarVisibility = testPledgeBarVisibility;
  
  console.log('🧪 Simulated Token Test Functions Available:');
  console.log('- testSimulatedTokens() - Test localStorage functionality');
  console.log('- testPledgeBarVisibility() - Test pledge bar UI');
}

// Auto-run tests if in test environment
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  testSimulatedTokens();
  testPledgeBarVisibility();
}
