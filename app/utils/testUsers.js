/**
 * Test User Utilities
 * 
 * Centralized configuration for test user identification across the application.
 * This ensures consistent test user detection for feature flags and other systems.
 */

/**
 * Development test user UIDs from DEV_TEST_USERS
 * These UIDs should match the ones defined in developmentAuth.ts
 */
const DEV_TEST_USER_UIDS = [
  'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L', // testUser1
  'mP9yRa3nO6gS8wD4xE2hF5jK7m9N', // testUser2
  'qT1uVb4oQ7hU9xF5yG3iH6kL8n0P', // testAdmin
  'sW2vXc5pR8iV0yH6zI4jJ7lM9o1Q', // testWriter
  'uY3wZd6qS9jW1zJ7aK5kL8mN0p2R'  // testReader
];

/**
 * Check if a user is a test user (development environment)
 * Test users should have all feature flags enabled by default
 * @param {string} userId - The user ID to check
 * @returns {boolean} - Whether the user is a test user
 */
function isTestUser(userId) {
  if (!userId) return false;
  
  // Check for legacy test user patterns
  if (userId.startsWith('dev_test_') || userId.startsWith('test_')) {
    return true;
  }
  
  // Check for development test user UIDs from DEV_TEST_USERS
  return DEV_TEST_USER_UIDS.includes(userId);
}

module.exports = {
  DEV_TEST_USER_UIDS,
  isTestUser
};
