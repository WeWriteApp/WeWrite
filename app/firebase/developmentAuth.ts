/**
 * Development Authentication System
 * 
 * This module provides a separate authentication system for development environments
 * to prevent mixing development testing with production user accounts.
 * 
 * In development mode, this creates isolated test users that don't affect production.
 */

import { getEnvironmentType } from '../utils/environmentConfig';

/**
 * Generate Firebase-style UID for development
 * Mimics real Firebase Auth UID format: 28 character alphanumeric string
 */
function generateFirebaseStyleUID(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 28; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Development test user accounts
 * These are isolated from production and safe for testing
 * UIDs are Firebase-style to match real user system architecture
 */
export const DEV_TEST_USERS = {
  testUser1: {
    email: 'test1@wewrite.dev',
    password: 'testpass123',
    username: 'testuser1',
    uid: 'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L', // Firebase-style UID
    description: 'Primary test user - use for main testing'
  },
  testUser2: {
    email: 'test2@wewrite.dev',
    password: 'testpass123',
    username: 'testuser2',
    uid: 'mP9yRa3nO6gS8wD4xE2hF5jK7m9N', // Firebase-style UID
    description: 'Secondary user - for testing interactions'
  },
  testAdmin: {
    email: 'admin@wewrite.dev',
    password: 'adminpass123',
    username: 'testadmin',
    uid: 'qT1uVb4oQ7hU9xF5yG3iH6kL8n0P', // Firebase-style UID
    isAdmin: true,
    description: 'Admin user - for testing admin features'
  },
  testWriter: {
    email: 'writer@wewrite.dev',
    password: 'testpass123',
    username: 'testwriter',
    uid: 'sW2vXc5pR8iV0yH6zI4jJ7lM9o1Q', // Firebase-style UID
    description: 'Active writer - for testing content creation'
  },
  testReader: {
    email: 'reader@wewrite.dev',
    password: 'testpass123',
    username: 'testreader',
    uid: 'uY3wZd6qS9jW1zJ7aK5kL8mN0p2R', // Firebase-style UID
    description: 'Reader only - for testing consumption features'
  }
} as const;

/**
 * Mock authentication state for development
 */
interface MockAuthState {
  currentUser: any | null;
  isSignedIn: boolean;
}

let mockAuthState: MockAuthState = {
  currentUser: null,
  isSignedIn: false
};

/**
 * Development authentication service
 * Provides isolated authentication for development environments
 */
export class DevelopmentAuthService {
  private static instance: DevelopmentAuthService;
  private authStateListeners: ((user: any) => void)[] = [];

  static getInstance(): DevelopmentAuthService {
    if (!DevelopmentAuthService.instance) {
      DevelopmentAuthService.instance = new DevelopmentAuthService();
    }
    return DevelopmentAuthService.instance;
  }

  /**
   * Check if we should use development auth
   */
  static shouldUseDevelopmentAuth(): boolean {
    const envType = getEnvironmentType();
    return envType === 'development' && process.env.USE_DEV_AUTH === 'true';
  }

  /**
   * Sign in with development test user
   */
  async signInWithTestUser(userKey: keyof typeof DEV_TEST_USERS): Promise<any> {
    if (!DevelopmentAuthService.shouldUseDevelopmentAuth()) {
      throw new Error('Development auth not enabled');
    }

    const testUser = DEV_TEST_USERS[userKey];
    if (!testUser) {
      throw new Error(`Test user ${userKey} not found`);
    }

    const mockUser = {
      uid: testUser.uid,
      email: testUser.email,
      emailVerified: true,
      isAnonymous: false,
      metadata: {
        creationTime: new Date().toISOString(),
        lastSignInTime: new Date().toISOString()
      },
      providerData: [{
        providerId: 'password',
        uid: testUser.email,
        email: testUser.email
      }]
    };

    mockAuthState.currentUser = mockUser;
    mockAuthState.isSignedIn = true;

    // Notify listeners
    this.authStateListeners.forEach(listener => listener(mockUser));

    console.log(`[Dev Auth] Signed in as test user: ${testUser.username}`);
    return { user: mockUser };
  }

  /**
   * Sign out development user
   */
  async signOut(): Promise<void> {
    if (!DevelopmentAuthService.shouldUseDevelopmentAuth()) {
      throw new Error('Development auth not enabled');
    }

    console.log('[Dev Auth] Starting logout process...');

    // Clear mock auth state
    mockAuthState.currentUser = null;
    mockAuthState.isSignedIn = false;

    // Clear all session-related data for development
    if (typeof window !== 'undefined') {
      // Clear localStorage
      localStorage.removeItem('previousUserSession');
      localStorage.removeItem('wewrite_accounts');
      localStorage.removeItem('wewrite_current_account');
      localStorage.removeItem('wewrite_auth_state');
      localStorage.removeItem('authState');
      localStorage.removeItem('accountSwitchInProgress');
      localStorage.removeItem('switchToAccount');
      localStorage.removeItem('savedAccounts');

      // Clear cookies using document.cookie (more reliable for development)
      const cookies = ['session', 'authenticated', 'userSession', 'devUserSession', 'currentUser'];
      cookies.forEach(cookieName => {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost;`;
      });

      console.log('[Dev Auth] Cleared localStorage and cookies');
    }

    // Notify listeners
    this.authStateListeners.forEach(listener => listener(null));

    console.log('[Dev Auth] Signed out successfully');
  }

  /**
   * Get current development user
   */
  getCurrentUser(): any | null {
    if (!DevelopmentAuthService.shouldUseDevelopmentAuth()) {
      return null;
    }
    return mockAuthState.currentUser;
  }

  /**
   * Add auth state change listener
   */
  onAuthStateChanged(callback: (user: any) => void): () => void {
    this.authStateListeners.push(callback);
    
    // Call immediately with current state
    callback(mockAuthState.currentUser);

    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Create development test user account
   */
  async createTestUser(userData: {
    email: string;
    password: string;
    username: string;
  }): Promise<any> {
    if (!DevelopmentAuthService.shouldUseDevelopmentAuth()) {
      throw new Error('Development auth not enabled');
    }

    const mockUser = {
      uid: generateFirebaseStyleUID(), // Use Firebase-style UID
      email: userData.email,
      emailVerified: false,
      isAnonymous: false,
      metadata: {
        creationTime: new Date().toISOString(),
        lastSignInTime: new Date().toISOString()
      },
      providerData: [{
        providerId: 'password',
        uid: userData.email,
        email: userData.email
      }]
    };

    console.log(`[Dev Auth] Created test user: ${userData.username}`);
    return { user: mockUser };
  }

  /**
   * Get available test users for development
   */
  getAvailableTestUsers(): typeof DEV_TEST_USERS {
    return DEV_TEST_USERS;
  }
}

/**
 * Development auth warning component
 */
export const showDevelopmentAuthWarning = (): void => {
  if (typeof window !== 'undefined' && DevelopmentAuthService.shouldUseDevelopmentAuth()) {
    console.warn(`
🚨 DEVELOPMENT AUTHENTICATION ACTIVE 🚨

You are using isolated development authentication.
This prevents mixing test data with production user accounts.

Available test users:
${Object.entries(DEV_TEST_USERS).map(([key, user]) => 
  `- ${key}: ${user.email} (${user.username})`
).join('\n')}

To disable development auth, remove USE_DEV_AUTH=true from your environment.
    `);
  }
};

/**
 * Initialize development authentication if enabled
 */
export const initializeDevelopmentAuth = (): DevelopmentAuthService | null => {
  if (DevelopmentAuthService.shouldUseDevelopmentAuth()) {
    showDevelopmentAuthWarning();
    return DevelopmentAuthService.getInstance();
  }
  return null;
};
