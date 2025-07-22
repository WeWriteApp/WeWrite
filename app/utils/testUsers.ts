/**
 * Test User Utilities
 *
 * Centralized configuration for test user identification across the application.
 * This ensures consistent test user detection for feature flags and other systems.
 */

/**
 * Simple test users for development - replaces complex developmentAuth system
 */
export const DEV_TEST_USERS = {
  'jamie@wewrite.app': {
    uid: 'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L',
    email: 'jamie@wewrite.app',
    username: 'jamie',
    password: 'TestPassword123!',
    displayName: 'Jamie Gray',
    isAdmin: true,
    description: 'Admin test user for development'
  },
  'test@wewrite.app': {
    uid: 'mP9yRa3nO6gS8wD4xE2hF5jK7m9N',
    email: 'test@wewrite.app',
    username: 'testuser',
    password: 'TestPassword123!',
    displayName: 'Test User',
    isAdmin: false,
    description: 'Regular test user for development'
  },
  'getwewrite@gmail.com': {
    uid: 'gW5eR8iT3eA9pP2mN6oQ4sT7uV1X',
    email: 'getwewrite@gmail.com',
    username: 'getwewrite',
    password: 'TestPassword123!',
    displayName: 'WeWrite',
    isAdmin: false,
    description: 'WeWrite official test account'
  }
};

/**
 * Development test user UIDs from DEV_TEST_USERS
 */
export const DEV_TEST_USER_UIDS: string[] = [
  'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L', // jamie@wewrite.app
  'mP9yRa3nO6gS8wD4xE2hF5jK7m9N', // test@wewrite.app
  'gW5eR8iT3eA9pP2mN6oQ4sT7uV1X', // getwewrite@gmail.com
  'qT1uVb4oQ7hU9xF5yG3iH6kL8n0P', // testAdmin
  'sW2vXc5pR8iV0yH6zI4jJ7lM9o1Q', // testWriter
  'uY3wZd6qS9jW1zJ7aK5kL8mN0p2R'  // testReader
];

/**
 * Check if a user is a test user (development environment)
 * Test users should have all feature flags enabled by default
 */
export function isTestUser(userId: string | null | undefined): boolean {
  if (!userId) return false;

  // Check for legacy test user patterns
  if (userId.startsWith('dev_test_') || userId.startsWith('test_')) {
    return true;
  }

  // Check for development test user UIDs from DEV_TEST_USERS
  return DEV_TEST_USER_UIDS.includes(userId);
}
