/**
 * Test script to verify username availability checking works correctly
 * Run this in the browser console on the registration page
 */

async function testUsernameAvailability() {
  console.log('🧪 Testing Username Availability System...');
  
  try {
    // Import the checkUsernameAvailability function
    const { checkUsernameAvailability } = await import('./app/firebase/auth');
    
    console.log('\n1. Testing valid username format...');
    
    // Test 1: Valid username that should be available
    const testUsername = 'testuser' + Date.now();
    console.log(`Testing username: ${testUsername}`);
    
    const result1 = await checkUsernameAvailability(testUsername);
    console.log('Result:', result1);
    
    if (result1.isAvailable) {
      console.log('✅ Valid username correctly identified as available');
    } else {
      console.log('❌ Valid username incorrectly identified as unavailable');
      console.log('Error:', result1.error);
      console.log('Message:', result1.message);
    }
    
    console.log('\n2. Testing invalid username formats...');
    
    // Test 2: Username too short
    const result2 = await checkUsernameAvailability('ab');
    console.log('Short username result:', result2);
    
    if (!result2.isAvailable && result2.error === 'TOO_SHORT') {
      console.log('✅ Short username correctly rejected');
    } else {
      console.log('❌ Short username validation failed');
    }
    
    // Test 3: Username with spaces
    const result3 = await checkUsernameAvailability('test user');
    console.log('Username with spaces result:', result3);
    
    if (!result3.isAvailable && result3.error === 'CONTAINS_WHITESPACE') {
      console.log('✅ Username with spaces correctly rejected');
    } else {
      console.log('❌ Username with spaces validation failed');
    }
    
    // Test 4: Username with invalid characters
    const result4 = await checkUsernameAvailability('test@user');
    console.log('Username with invalid chars result:', result4);
    
    if (!result4.isAvailable && result4.error === 'INVALID_CHARACTERS') {
      console.log('✅ Username with invalid characters correctly rejected');
    } else {
      console.log('❌ Username with invalid characters validation failed');
    }
    
    console.log('\n3. Testing known taken username...');
    
    // Test 5: Known taken username (jamie)
    const result5 = await checkUsernameAvailability('jamie');
    console.log('Known taken username result:', result5);
    
    if (!result5.isAvailable && result5.error === 'USERNAME_TAKEN') {
      console.log('✅ Known taken username correctly identified');
      if (result5.suggestions && result5.suggestions.length > 0) {
        console.log('✅ Username suggestions provided:', result5.suggestions);
      }
    } else {
      console.log('❌ Known taken username validation failed');
    }
    
    console.log('\n4. Testing environment configuration...');
    
    // Test 6: Check if environment configuration is working
    const { getEnvironmentType, getCollectionName } = await import('./app/utils/environmentConfig');
    
    const envType = getEnvironmentType();
    const usernamesCollection = getCollectionName('usernames');
    
    console.log('Environment type:', envType);
    console.log('Usernames collection name:', usernamesCollection);
    
    if (envType === 'development' && usernamesCollection === 'dev_usernames') {
      console.log('✅ Development environment configuration correct');
    } else if (envType === 'preview' && usernamesCollection === 'preview_usernames') {
      console.log('✅ Preview environment configuration correct');
    } else if (envType === 'production' && usernamesCollection === 'usernames') {
      console.log('✅ Production environment configuration correct');
    } else {
      console.log('❌ Environment configuration mismatch');
      console.log('Expected collection for', envType, 'environment');
    }
    
    console.log('\n✅ Username availability testing completed');
    
    return {
      success: true,
      environmentType: envType,
      collectionName: usernamesCollection,
      testResults: {
        validUsername: result1.isAvailable,
        shortUsername: !result2.isAvailable && result2.error === 'TOO_SHORT',
        spacesUsername: !result3.isAvailable && result3.error === 'CONTAINS_WHITESPACE',
        invalidCharsUsername: !result4.isAvailable && result4.error === 'INVALID_CHARACTERS',
        takenUsername: !result5.isAvailable && result5.error === 'USERNAME_TAKEN'
      }
    };
    
  } catch (error) {
    console.error('❌ Username availability test failed:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Auto-run the test if this script is loaded
if (typeof window !== 'undefined') {
  // Wait a moment for the page to load
  setTimeout(() => {
    testUsernameAvailability().then(result => {
      console.log('\n📊 Test Results Summary:', result);
      
      if (result.success) {
        const allTestsPassed = Object.values(result.testResults).every(test => test === true);
        if (allTestsPassed) {
          console.log('🎉 All username availability tests passed!');
        } else {
          console.log('⚠️ Some tests failed. Check individual test results above.');
        }
      }
    });
  }, 1000);
}

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testUsernameAvailability };
}
