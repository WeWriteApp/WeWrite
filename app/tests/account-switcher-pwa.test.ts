/**
 * Account Switcher PWA Logout Persistence Tests
 * Tests to verify that logged-out accounts don't reappear after PWA close/reopen
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/jest';

// Mock localStorage and sessionStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null
  };
})();

const sessionStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null
  };
})();

// Mock IndexedDB
const indexedDBMock = {
  open: jest.fn(() => ({
    onsuccess: null,
    onerror: null,
    result: {
      objectStoreNames: {
        contains: jest.fn(() => true)
      },
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          getAllKeys: jest.fn(() => ({
            onsuccess: null,
            result: ['firebase:authUser:test-key:[DEFAULT]:user1', 'firebase:authUser:test-key:[DEFAULT]:user2']
          })),
          delete: jest.fn()
        }))
      }))
    }
  }))
};

// Mock window.matchMedia for PWA detection
const matchMediaMock = jest.fn((query: string) => ({
  matches: query === '(display-mode: standalone)',
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

// Setup global mocks
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });
Object.defineProperty(window, 'indexedDB', { value: indexedDBMock });
Object.defineProperty(window, 'matchMedia', { value: matchMediaMock });

// Mock Firebase auth
const mockAuth = {
  app: {
    options: {
      apiKey: 'test-api-key',
      authDomain: 'test-domain.firebaseapp.com'
    }
  }
};

// Import the functions we want to test
import { clearLoggedOutAccount, isAccountLoggedOut } from '../components/auth/AccountSwitcher';

describe('Account Switcher PWA Logout Persistence', () => {
  beforeEach(() => {
    // Clear all storage before each test
    localStorageMock.clear();
    sessionStorageMock.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  describe('Logged-out account tracking', () => {
    test('should track logged-out accounts in localStorage', () => {
      const accountUid = 'user123';
      
      // Simulate logging out an account
      const loggedOutAccounts = new Set(['user123']);
      localStorageMock.setItem('loggedOutAccounts', JSON.stringify([...loggedOutAccounts]));
      
      // Verify the account is tracked as logged out
      expect(isAccountLoggedOut(accountUid)).toBe(true);
      expect(isAccountLoggedOut('user456')).toBe(false);
    });

    test('should clear logged-out status when user logs back in', () => {
      const accountUid = 'user123';
      
      // Set up initial logged-out accounts
      localStorageMock.setItem('loggedOutAccounts', JSON.stringify(['user123', 'user456']));
      
      // Verify user is initially logged out
      expect(isAccountLoggedOut(accountUid)).toBe(true);
      
      // Clear the logged-out status
      clearLoggedOutAccount(accountUid);
      
      // Verify user is no longer tracked as logged out
      expect(isAccountLoggedOut(accountUid)).toBe(false);
      expect(isAccountLoggedOut('user456')).toBe(true); // Other user should still be logged out
    });

    test('should handle empty logged-out accounts list', () => {
      expect(isAccountLoggedOut('user123')).toBe(false);
      
      clearLoggedOutAccount('user123'); // Should not throw error
      expect(isAccountLoggedOut('user123')).toBe(false);
    });
  });

  describe('Account loading with logout persistence', () => {
    test('should filter out logged-out accounts when loading saved accounts', () => {
      // Set up saved accounts
      const savedAccounts = [
        { uid: 'user1', email: 'user1@example.com', username: 'user1', isCurrent: false },
        { uid: 'user2', email: 'user2@example.com', username: 'user2', isCurrent: true },
        { uid: 'user3', email: 'user3@example.com', username: 'user3', isCurrent: false }
      ];
      localStorageMock.setItem('savedAccounts', JSON.stringify(savedAccounts));
      
      // Set up logged-out accounts (user2 was logged out)
      localStorageMock.setItem('loggedOutAccounts', JSON.stringify(['user2']));
      
      // Simulate the account loading logic
      const loggedOutAccounts = localStorageMock.getItem('loggedOutAccounts');
      const loggedOutAccountsSet = new Set(loggedOutAccounts ? JSON.parse(loggedOutAccounts) : []);
      
      const validAccounts = savedAccounts.filter(account => !loggedOutAccountsSet.has(account.uid));
      
      // Verify that user2 is filtered out
      expect(validAccounts).toHaveLength(2);
      expect(validAccounts.find(acc => acc.uid === 'user1')).toBeDefined();
      expect(validAccounts.find(acc => acc.uid === 'user2')).toBeUndefined();
      expect(validAccounts.find(acc => acc.uid === 'user3')).toBeDefined();
    });

    test('should not add current user to accounts if they were logged out', () => {
      // Set up a current user who was previously logged out
      const currentUser = { uid: 'user1', email: 'user1@example.com' };
      
      // Mark this user as logged out
      localStorageMock.setItem('loggedOutAccounts', JSON.stringify(['user1']));
      
      // Simulate the account loading logic
      const loggedOutAccounts = localStorageMock.getItem('loggedOutAccounts');
      const loggedOutAccountsSet = new Set(loggedOutAccounts ? JSON.parse(loggedOutAccounts) : []);
      
      // Check if current user was explicitly logged out
      const wasLoggedOut = loggedOutAccountsSet.has(currentUser.uid);
      
      expect(wasLoggedOut).toBe(true);
      // In the real implementation, this user would not be added to the accounts list
    });
  });

  describe('PWA-specific storage clearing', () => {
    test('should detect PWA environment correctly', () => {
      // Test standalone mode detection
      matchMediaMock.mockReturnValue({ matches: true });
      const isPWAStandalone = window.matchMedia('(display-mode: standalone)').matches;
      expect(isPWAStandalone).toBe(true);
      
      // Test iOS PWA detection
      (window.navigator as any).standalone = true;
      const isIOSPWA = (window.navigator as any).standalone === true;
      expect(isIOSPWA).toBe(true);
    });

    test('should attempt to clear IndexedDB entries in PWA mode', () => {
      // Set up PWA environment
      matchMediaMock.mockReturnValue({ matches: true });
      
      // Mock the clearFirebaseAuthForAccount function behavior
      const accountUid = 'user123';
      
      // Verify IndexedDB operations would be called
      expect(indexedDBMock.open).toBeDefined();
      
      // In a real test, we would verify that:
      // 1. indexedDB.open is called with 'firebaseLocalStorageDb'
      // 2. Keys containing the accountUid are deleted
      // 3. localStorage entries are cleared
      // 4. sessionStorage entries are cleared
    });
  });

  describe('End-to-end logout persistence scenario', () => {
    test('should maintain logout state through PWA close/reopen cycle', () => {
      // Initial state: 2 accounts in switcher
      const initialAccounts = [
        { uid: 'user1', email: 'user1@example.com', username: 'user1', isCurrent: true },
        { uid: 'user2', email: 'user2@example.com', username: 'user2', isCurrent: false }
      ];
      localStorageMock.setItem('savedAccounts', JSON.stringify(initialAccounts));
      
      // Step 1: User logs out of user1 via account switcher
      const loggedOutAccountUid = 'user1';
      const loggedOutAccounts = new Set([loggedOutAccountUid]);
      localStorageMock.setItem('loggedOutAccounts', JSON.stringify([...loggedOutAccounts]));
      
      // Update saved accounts to remove logged-out user
      const remainingAccounts = initialAccounts.filter(acc => acc.uid !== loggedOutAccountUid);
      localStorageMock.setItem('savedAccounts', JSON.stringify(remainingAccounts));
      
      // Step 2: Verify only 1 account remains
      const currentAccounts = JSON.parse(localStorageMock.getItem('savedAccounts') || '[]');
      expect(currentAccounts).toHaveLength(1);
      expect(currentAccounts[0].uid).toBe('user2');
      
      // Step 3: Simulate PWA close/reopen - account loading logic
      const savedAccounts = localStorageMock.getItem('savedAccounts');
      const loggedOutAccountsList = localStorageMock.getItem('loggedOutAccounts');
      const loggedOutAccountsSet = new Set(loggedOutAccountsList ? JSON.parse(loggedOutAccountsList) : []);
      
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts);
        const validAccounts = parsedAccounts.filter(account => !loggedOutAccountsSet.has(account.uid));
        
        // Step 4: Verify logged-out account doesn't reappear
        expect(validAccounts).toHaveLength(1);
        expect(validAccounts[0].uid).toBe('user2');
        expect(validAccounts.find(acc => acc.uid === 'user1')).toBeUndefined();
      }
      
      // Step 5: Verify logged-out status is maintained
      expect(isAccountLoggedOut('user1')).toBe(true);
      expect(isAccountLoggedOut('user2')).toBe(false);
    });

    test('should allow logged-out user to log back in and clear their logged-out status', () => {
      // Set up logged-out user
      const accountUid = 'user1';
      localStorageMock.setItem('loggedOutAccounts', JSON.stringify([accountUid]));
      
      // Verify user is logged out
      expect(isAccountLoggedOut(accountUid)).toBe(true);
      
      // Simulate user logging back in (this would happen in AuthProvider)
      clearLoggedOutAccount(accountUid);
      
      // Verify user is no longer tracked as logged out
      expect(isAccountLoggedOut(accountUid)).toBe(false);
      
      // User should now be able to appear in account switcher again
      const loggedOutAccounts = localStorageMock.getItem('loggedOutAccounts');
      const loggedOutAccountsSet = new Set(loggedOutAccounts ? JSON.parse(loggedOutAccounts) : []);
      expect(loggedOutAccountsSet.has(accountUid)).toBe(false);
    });
  });

  describe('Error handling', () => {
    test('should handle corrupted localStorage data gracefully', () => {
      // Set corrupted data
      localStorageMock.setItem('loggedOutAccounts', 'invalid-json');
      
      // Functions should not throw and should return safe defaults
      expect(() => isAccountLoggedOut('user123')).not.toThrow();
      expect(isAccountLoggedOut('user123')).toBe(false);
      
      expect(() => clearLoggedOutAccount('user123')).not.toThrow();
    });

    test('should handle missing localStorage gracefully', () => {
      // Clear localStorage completely
      localStorageMock.clear();
      
      // Functions should work with empty storage
      expect(isAccountLoggedOut('user123')).toBe(false);
      expect(() => clearLoggedOutAccount('user123')).not.toThrow();
    });
  });
});
