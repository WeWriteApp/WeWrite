/**
 * Authentication Wrapper
 * 
 * This module provides a unified authentication interface that automatically
 * switches between production Firebase Auth and development mock auth based
 * on the current environment.
 * 
 * This ensures proper environment separation for authentication.
 */

import { getEnvironmentType } from '../utils/environmentConfig';
import { DevelopmentAuthService, DEV_TEST_USERS } from './developmentAuth';
import { 
  getEnvironmentAwareAuth,
  getEnvironmentAwareFirestore 
} from './environmentAwareConfig';
import {
  type Auth,
  type User as FirebaseUser,
  type UserCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged
} from 'firebase/auth';

/**
 * Unified authentication interface
 */
export interface AuthWrapper {
  currentUser: FirebaseUser | null;
  signIn: (email: string, password: string) => Promise<UserCredential | any>;
  signUp: (email: string, password: string) => Promise<UserCredential | any>;
  signOut: () => Promise<void>;
  onAuthStateChanged: (callback: (user: FirebaseUser | null) => void) => () => void;
  isDevelopmentMode: boolean;
  getTestUsers?: () => typeof DEV_TEST_USERS;
  signInWithTestUser?: (userKey: keyof typeof DEV_TEST_USERS) => Promise<any>;
}

/**
 * Get the appropriate authentication service based on environment
 */
export const getAuthWrapper = (): AuthWrapper => {
  const envType = getEnvironmentType();
  const isDevelopmentMode = envType === 'development';
  const useDevelopmentAuth = isDevelopmentMode && process.env.USE_DEV_AUTH === 'true';

  if (useDevelopmentAuth) {
    return createDevelopmentAuthWrapper();
  } else {
    return createProductionAuthWrapper();
  }
};

/**
 * Create development authentication wrapper
 */
function createDevelopmentAuthWrapper(): AuthWrapper {
  const devAuth = DevelopmentAuthService.getInstance();

  return {
    get currentUser() {
      return devAuth.getCurrentUser();
    },

    async signIn(emailOrUsername: string, password: string) {
      // Check if it's a test user by email
      let testUser = Object.values(DEV_TEST_USERS).find(user => user.email === emailOrUsername);
      let userKey: keyof typeof DEV_TEST_USERS | undefined;

      if (testUser) {
        userKey = Object.keys(DEV_TEST_USERS).find(
          key => DEV_TEST_USERS[key as keyof typeof DEV_TEST_USERS].email === emailOrUsername
        ) as keyof typeof DEV_TEST_USERS;
      } else {
        // Check if it's a test user by username
        testUser = Object.values(DEV_TEST_USERS).find(user => user.username === emailOrUsername);
        if (testUser) {
          userKey = Object.keys(DEV_TEST_USERS).find(
            key => DEV_TEST_USERS[key as keyof typeof DEV_TEST_USERS].username === emailOrUsername
          ) as keyof typeof DEV_TEST_USERS;
        }
      }

      if (testUser && testUser.password === password && userKey) {
        console.log(`[Dev Auth] Signing in test user: ${testUser.username} (${testUser.email})`);
        return await devAuth.signInWithTestUser(userKey);
      }

      // Provide helpful error message with available test users
      const availableUsers = Object.values(DEV_TEST_USERS).map(user =>
        `${user.username} (${user.email})`
      ).join(', ');

      throw new Error(`Invalid test user credentials. Available test users: ${availableUsers}`);
    },

    async signUp(email: string, password: string) {
      // In development, create a mock user
      const username = email.split('@')[0];
      return await devAuth.createTestUser({
        email,
        password,
        username
      });
    },

    async signOut() {
      return await devAuth.signOut();
    },

    onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
      return devAuth.onAuthStateChanged(callback);
    },

    isDevelopmentMode: true,

    getTestUsers() {
      return devAuth.getAvailableTestUsers();
    },

    async signInWithTestUser(userKey: keyof typeof DEV_TEST_USERS) {
      return await devAuth.signInWithTestUser(userKey);
    }
  };
}

/**
 * Create production authentication wrapper
 */
function createProductionAuthWrapper(): AuthWrapper {
  const auth = getEnvironmentAwareAuth();

  return {
    get currentUser() {
      return auth.currentUser;
    },

    async signIn(email: string, password: string) {
      // Note: In production mode, username lookup is handled in auth.ts before calling this
      return await signInWithEmailAndPassword(auth, email, password);
    },

    async signUp(email: string, password: string) {
      return await createUserWithEmailAndPassword(auth, email, password);
    },

    async signOut() {
      return await firebaseSignOut(auth);
    },

    onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
      return firebaseOnAuthStateChanged(auth, callback);
    },

    isDevelopmentMode: false
  };
}

/**
 * Global auth wrapper instance
 */
let authWrapperInstance: AuthWrapper | null = null;

/**
 * Get the global authentication wrapper instance
 */
export const getGlobalAuthWrapper = (): AuthWrapper => {
  if (!authWrapperInstance) {
    authWrapperInstance = getAuthWrapper();
    
    // Log authentication mode
    const envType = getEnvironmentType();
    if (authWrapperInstance.isDevelopmentMode) {
      console.log(`[Auth Wrapper] Using development authentication for ${envType} environment`);
      console.log('[Auth Wrapper] Available test users:', Object.keys(DEV_TEST_USERS));
    } else {
      console.log(`[Auth Wrapper] Using production Firebase Auth for ${envType} environment`);
    }
  }
  
  return authWrapperInstance;
};

/**
 * Reset auth wrapper (for testing)
 */
export const resetAuthWrapper = (): void => {
  authWrapperInstance = null;
};

/**
 * Check if development authentication is active
 */
export const isDevelopmentAuthActive = (): boolean => {
  const wrapper = getGlobalAuthWrapper();
  return wrapper.isDevelopmentMode;
};

/**
 * Get authentication environment info
 */
export const getAuthEnvironmentInfo = () => {
  const envType = getEnvironmentType();
  const wrapper = getGlobalAuthWrapper();
  
  return {
    environment: envType,
    isDevelopmentAuth: wrapper.isDevelopmentMode,
    usesTestUsers: wrapper.isDevelopmentMode,
    availableTestUsers: wrapper.isDevelopmentMode ? Object.keys(DEV_TEST_USERS) : [],
    authType: wrapper.isDevelopmentMode ? 'Development Mock Auth' : 'Firebase Auth',
    isEnvironmentSeparated: wrapper.isDevelopmentMode
  };
};

/**
 * Development auth helper functions
 */
export const devAuthHelpers = {
  /**
   * Quick sign in with test user 1
   */
  async signInAsTestUser1() {
    const wrapper = getGlobalAuthWrapper();
    if (wrapper.signInWithTestUser) {
      return await wrapper.signInWithTestUser('testUser1');
    }
    throw new Error('Development auth not active');
  },

  /**
   * Quick sign in with test admin
   */
  async signInAsTestAdmin() {
    const wrapper = getGlobalAuthWrapper();
    if (wrapper.signInWithTestUser) {
      return await wrapper.signInWithTestUser('testAdmin');
    }
    throw new Error('Development auth not active');
  },

  /**
   * Get all test user credentials
   */
  getTestUserCredentials() {
    const wrapper = getGlobalAuthWrapper();
    if (wrapper.getTestUsers) {
      return wrapper.getTestUsers();
    }
    return null;
  }
};
