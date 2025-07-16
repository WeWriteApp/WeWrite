/**
 * Test Authentication Isolation
 * 
 * This script tests that the development authentication system properly
 * blocks production accounts and only allows predefined test users.
 */

const BASE_URL = 'http://localhost:3000';

async function testLogin(emailOrUsername, password, testName) {
  try {
    console.log(`\n🧪 Testing: ${testName}`);
    console.log(`   Credentials: ${emailOrUsername} / ${password}`);
    
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailOrUsername,
        password
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`   ✅ SUCCESS: ${result.data.message || 'Login successful'}`);
      console.log(`   User: ${result.data.displayName} (${result.data.email})`);
      return { success: true, data: result.data };
    } else {
      console.log(`   ❌ FAILED: ${result.message || 'Login failed'}`);
      return { success: false, error: result.message };
    }
    
  } catch (error) {
    console.log(`   💥 ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAuthIsolationTests() {
  console.log('🔒 Testing Authentication Environment Isolation');
  console.log('='.repeat(50));
  
  // Test 1: Valid test user (should succeed)
  await testLogin('test1@wewrite.dev', 'testpass123', 'Valid Test User Email');
  
  // Test 2: Valid test user by username (should succeed)
  await testLogin('testuser1', 'testpass123', 'Valid Test User Username');
  
  // Test 3: Valid test admin (should succeed)
  await testLogin('admin@wewrite.dev', 'adminpass123', 'Valid Test Admin');
  
  // Test 4: Production username (should fail - THIS IS THE KEY TEST)
  await testLogin('jamiegray', 'anypassword', 'Production Username (SHOULD FAIL)');
  
  // Test 5: Production email (should fail - THIS IS THE KEY TEST)
  await testLogin('contact@jamiegray.net', 'anypassword', 'Production Email (SHOULD FAIL)');
  
  // Test 6: Invalid test user password (should fail)
  await testLogin('test1@wewrite.dev', 'wrongpassword', 'Invalid Test User Password');
  
  // Test 7: Non-existent user (should fail)
  await testLogin('nonexistent@example.com', 'anypassword', 'Non-existent User');
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 KEY SECURITY TESTS:');
  console.log('   - Production username "jamiegray" should be REJECTED');
  console.log('   - Production email "contact@jamiegray.net" should be REJECTED');
  console.log('   - Only predefined test users should be allowed');
  console.log('\n✅ If production accounts were rejected, authentication isolation is working!');
}

// Run the tests
runAuthIsolationTests().catch(console.error);
