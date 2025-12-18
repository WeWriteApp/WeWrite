/**
 * Test User Utilities
 *
 * Centralized configuration for test user identification across the application.
 * This ensures consistent test user detection for feature flags and other systems.
 *
 * SECURITY: Passwords are loaded from environment variable, not hardcoded.
 */

/**
 * Get the dev test user password from environment variable
 * Returns undefined if not set (will fail login in dev mode)
 */
export function getDevTestUserPassword(): string | undefined {
  return process.env.DEV_TEST_USER_PASSWORD;
}

/**
 * Test user interface without password (passwords loaded separately from env)
 */
interface DevTestUser {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  description: string;
}

/**
 * Simple test users for development - replaces complex developmentAuth system
 *
 * NOTE: In development mode, ALL dev test users have admin access,
 * but they can ONLY access DEV_ prefixed collections (not production data).
 *
 * SECURITY: Passwords are NOT stored here - they come from DEV_TEST_USER_PASSWORD env var
 */
export const DEV_TEST_USERS: Record<string, DevTestUser> = {
  'jamie@wewrite.app': {
    uid: 'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L',
    email: 'jamie@wewrite.app',
    username: 'jamie',
    displayName: 'Jamie Gray',
    isAdmin: true,
    description: 'Admin test user for development'
  },
  'test@wewrite.app': {
    uid: 'mP9yRa3nO6gS8wD4xE2hF5jK7m9N',
    email: 'test@wewrite.app',
    username: 'testuser',
    displayName: 'Test User',
    isAdmin: true,
    description: 'Test user for development (admin in dev mode)'
  },
  'getwewrite@gmail.com': {
    uid: 'gW5eR8iT3eA9pP2mN6oQ4sT7uV1X',
    email: 'getwewrite@gmail.com',
    username: 'getwewrite',
    displayName: 'WeWrite',
    isAdmin: true,
    description: 'WeWrite official test account (admin in dev mode)'
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
 * Development test user emails from DEV_TEST_USERS
 */
export const DEV_TEST_USER_EMAILS: string[] = [
  'jamie@wewrite.app',
  'test@wewrite.app',
  'getwewrite@gmail.com'
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

/**
 * Validate a password against the dev test user password
 * Returns true if the password matches, false otherwise
 */
export function validateDevTestPassword(password: string): boolean {
  const devPassword = getDevTestUserPassword();
  if (!devPassword) {
    console.warn('[testUsers] DEV_TEST_USER_PASSWORD not set in environment');
    return false;
  }
  return password === devPassword;
}

/**
 * Hash a password for dev user storage using SHA-256
 * This is used for dynamically registered dev users stored in Firestore
 *
 * Note: For production, Firebase Auth handles password hashing.
 * This is only for local dev auth with DEV_ prefixed collections.
 */
export async function hashDevPassword(password: string): Promise<string> {
  // Use Web Crypto API (available in Node.js 18+)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `dev_sha256_${hashHex}`;
}

/**
 * Verify a password against a stored hash
 * Supports both old base64 format (for backward compatibility) and new SHA-256 format
 */
export async function verifyDevPassword(password: string, storedHash: string): Promise<boolean> {
  // Handle new SHA-256 format
  if (storedHash.startsWith('dev_sha256_')) {
    const expectedHash = await hashDevPassword(password);
    return storedHash === expectedHash;
  }

  // Handle legacy base64 format for backward compatibility with existing dev users
  if (storedHash.startsWith('dev_hash_')) {
    const legacyHash = `dev_hash_${Buffer.from(password).toString('base64')}`;
    return storedHash === legacyHash;
  }

  return false;
}
