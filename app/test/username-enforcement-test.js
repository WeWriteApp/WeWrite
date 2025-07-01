/**
 * Username Enforcement Flow Test
 * 
 * This test verifies that the username enforcement system works correctly
 * and that users who need usernames will see the enforcement modal.
 */

const { checkUserHasUsername, userNeedsUsername, getBestUsername } = require('../utils/usernameValidation');

// Test cases for username validation
const testCases = [
  {
    name: "User with valid username",
    user: { uid: "123", email: "test@example.com", username: "validuser" },
    expectedNeedsUsername: false,
    expectedUsername: "validuser"
  },
  {
    name: "User with valid displayName",
    user: { uid: "123", email: "test@example.com", displayName: "validuser" },
    expectedNeedsUsername: false,
    expectedUsername: "validuser"
  },
  {
    name: "User with email only (valid prefix)",
    user: { uid: "123", email: "validuser@example.com" },
    expectedNeedsUsername: false,
    expectedUsername: "validuser"
  },
  {
    name: "User with invalid username (whitespace)",
    user: { uid: "123", email: "test@example.com", username: "invalid user" },
    expectedNeedsUsername: true,
    expectedUsername: null
  },
  {
    name: "User with invalid username (generated pattern)",
    user: { uid: "123", email: "test@example.com", username: "user_abc123" },
    expectedNeedsUsername: true,
    expectedUsername: null
  },
  {
    name: "User with placeholder username",
    user: { uid: "123", email: "test@example.com", username: "anonymous" },
    expectedNeedsUsername: true,
    expectedUsername: null
  },
  {
    name: "User with no username data",
    user: { uid: "123", email: "test@example.com" },
    expectedNeedsUsername: false, // Should use email prefix
    expectedUsername: "test"
  },
  {
    name: "User not logged in",
    user: null,
    expectedNeedsUsername: false, // Not logged in, so no username needed
    expectedUsername: null
  }
];

// Run tests
console.log("🧪 Running Username Enforcement Tests...\n");

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  
  try {
    // Test userNeedsUsername function
    const needsUsername = userNeedsUsername(testCase.user);
    const usernameResult = getBestUsername(testCase.user);
    const fullResult = checkUserHasUsername(testCase.user);
    
    // Check if results match expectations
    const needsUsernameMatch = needsUsername === testCase.expectedNeedsUsername;
    const usernameMatch = usernameResult === testCase.expectedUsername;
    
    if (needsUsernameMatch && usernameMatch) {
      console.log(`✅ PASS`);
      console.log(`   - Needs username: ${needsUsername} (expected: ${testCase.expectedNeedsUsername})`);
      console.log(`   - Best username: "${usernameResult}" (expected: "${testCase.expectedUsername}")`);
      console.log(`   - Source: ${fullResult.source}`);
      passedTests++;
    } else {
      console.log(`❌ FAIL`);
      console.log(`   - Needs username: ${needsUsername} (expected: ${testCase.expectedNeedsUsername}) ${needsUsernameMatch ? '✅' : '❌'}`);
      console.log(`   - Best username: "${usernameResult}" (expected: "${testCase.expectedUsername}") ${usernameMatch ? '✅' : '❌'}`);
      console.log(`   - Source: ${fullResult.source}`);
      console.log(`   - Reason: ${fullResult.reason || 'N/A'}`);
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
  
  console.log('');
});

console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log("🎉 All tests passed! Username enforcement logic is working correctly.");
} else {
  console.log("⚠️  Some tests failed. Please review the username validation logic.");
}

// Export for use in other tests
module.exports = { testCases };
