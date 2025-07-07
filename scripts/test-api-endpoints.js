/**
 * Simple test script to validate API endpoints
 * Run with: node scripts/test-api-endpoints.js
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testEndpoint(endpoint, options = {}) {
  try {
    console.log(`Testing ${options.method || 'GET'} ${endpoint}...`);
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const result = await response.json();
    
    console.log(`  Status: ${response.status}`);
    console.log(`  Success: ${result.success}`);
    
    if (!result.success && result.error) {
      console.log(`  Error: ${result.error}`);
    }
    
    return { status: response.status, result };
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    return { status: 500, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Testing API Endpoints\n');

  // Test feature flags endpoint
  console.log('📋 Feature Flags API:');
  await testEndpoint('/api/feature-flags');
  console.log('');

  // Test username availability
  console.log('👤 Username API:');
  await testEndpoint('/api/users/username?username=testuser123');
  console.log('');

  // Test pages endpoint (should require auth)
  console.log('📄 Pages API:');
  await testEndpoint('/api/pages?limit=5');
  console.log('');

  // Test database stats (should require admin)
  console.log('📊 Database Stats API:');
  await testEndpoint('/api/admin/database-stats');
  console.log('');

  // Test batch user data
  console.log('👥 Batch User Data API:');
  await testEndpoint('/api/users/batch', {
    method: 'POST',
    body: { userIds: ['test-user-1', 'test-user-2'] }
  });
  console.log('');

  console.log('✅ API endpoint tests completed');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, runTests };
