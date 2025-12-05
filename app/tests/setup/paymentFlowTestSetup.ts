/**
 * Comprehensive Payment Flow Testing Setup
 * 
 * This module provides utilities for testing all payment flows including:
 * - User state simulation (logged out, no subscription, active subscription)
 * - Token allocation states (unfunded, funded pending, funded locked)
 * - Subscription management and billing cycles
 * - Earnings tracking and payout processing
 */

import { jest } from '@jest/globals';

// Test User States
export interface TestUser {
  uid: string;
  email: string;
  username: string;
  subscriptionStatus: 'none' | 'active' | 'cancelled' | 'past_due' | 'incomplete';
  subscriptionTier?: 'basic' | 'premium' | 'custom';
  subscriptionAmount?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  tokenBalance?: {
    totalTokens: number;
    allocatedTokens: number;
    availableTokens: number;
  };
  writerEarnings?: {
    totalEarned: number;
    availableForPayout: number;
    pendingThisMonth: number;
    lockedLastMonth: number;
  };
  payoutSetup?: {
    stripeAccountId?: string;
    accountVerified: boolean;
    canReceivePayouts: boolean;
  };
}

// Test Token Allocation States
export interface TestTokenAllocation {
  id: string;
  userId: string;
  recipientUserId: string;
  pageId: string;
  pageTitle: string;
  tokens: number;
  month: string;
  status: 'unfunded_logged_out' | 'unfunded_no_subscription' | 'unfunded_over_budget' | 'funded_pending' | 'funded_locked';
  createdAt: Date;
  fundingSource?: 'subscription' | 'simulated';
}

// Test Subscription Tiers
export const TEST_SUBSCRIPTION_TIERS = {
  basic: {
    id: 'basic',
    name: 'Basic',
    amount: 5,
    tokens: 50,
    stripePriceId: 'price_test_basic'
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    amount: 15,
    tokens: 150,
    stripePriceId: 'price_test_premium'
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    amount: 25,
    tokens: 250,
    stripePriceId: 'price_test_custom'
  }
};

// Test Users with Different States
export const TEST_USERS: Record<string, TestUser> = {
  loggedOut: {
    uid: '',
    email: '',
    username: 'logged_out_user',
    subscriptionStatus: 'none'
  },
  
  noSubscription: {
    uid: 'user_no_sub_123',
    email: 'nosub@test.com',
    username: 'user_without_sub',
    subscriptionStatus: 'none',
    tokenBalance: {
      totalTokens: 0,
      allocatedTokens: 0,
      availableTokens: 0
    }
  },
  
  activeBasic: {
    uid: 'user_basic_456',
    email: 'basic@test.com',
    username: 'basic_subscriber',
    subscriptionStatus: 'active',
    subscriptionTier: 'basic',
    subscriptionAmount: 5,
    stripeCustomerId: 'cus_test_basic',
    stripeSubscriptionId: 'sub_test_basic',
    tokenBalance: {
      totalTokens: 50,
      allocatedTokens: 30,
      availableTokens: 20
    }
  },
  
  activePremium: {
    uid: 'user_premium_789',
    email: 'premium@test.com',
    username: 'premium_subscriber',
    subscriptionStatus: 'active',
    subscriptionTier: 'premium',
    subscriptionAmount: 15,
    stripeCustomerId: 'cus_test_premium',
    stripeSubscriptionId: 'sub_test_premium',
    tokenBalance: {
      totalTokens: 150,
      allocatedTokens: 100,
      availableTokens: 50
    }
  },
  
  overBudget: {
    uid: 'user_over_budget_101',
    email: 'overbudget@test.com',
    username: 'over_budget_user',
    subscriptionStatus: 'active',
    subscriptionTier: 'basic',
    subscriptionAmount: 5,
    stripeCustomerId: 'cus_test_over_budget',
    stripeSubscriptionId: 'sub_test_over_budget',
    tokenBalance: {
      totalTokens: 50,
      allocatedTokens: 60, // Over allocated
      availableTokens: -10
    }
  },
  
  writer: {
    uid: 'writer_123',
    email: 'writer@test.com',
    username: 'content_writer',
    subscriptionStatus: 'active',
    subscriptionTier: 'basic',
    subscriptionAmount: 5,
    stripeCustomerId: 'cus_test_writer',
    stripeSubscriptionId: 'sub_test_writer',
    tokenBalance: {
      totalTokens: 50,
      allocatedTokens: 20,
      availableTokens: 30
    },
    writerEarnings: {
      totalEarned: 125.50,
      availableForPayout: 75.25,
      pendingThisMonth: 35.00,
      lockedLastMonth: 15.25
    },
    payoutSetup: {
      stripeAccountId: 'acct_test_writer',
      accountVerified: true,
      canReceivePayouts: true
    }
  },
  
  writerUnverified: {
    uid: 'writer_unverified_456',
    email: 'unverified@test.com',
    username: 'unverified_writer',
    subscriptionStatus: 'none',
    writerEarnings: {
      totalEarned: 45.00,
      availableForPayout: 45.00,
      pendingThisMonth: 0,
      lockedLastMonth: 0
    },
    payoutSetup: {
      accountVerified: false,
      canReceivePayouts: false
    }
  }
};

// Test Token Allocations with Different States
export const TEST_TOKEN_ALLOCATIONS: TestTokenAllocation[] = [
  {
    id: 'alloc_unfunded_logged_out_1',
    userId: '',
    recipientUserId: 'writer_123',
    pageId: 'page_test_1',
    pageTitle: 'Test Page 1',
    tokens: 10,
    month: '2024-01',
    status: 'unfunded_logged_out',
    createdAt: new Date('2024-01-15'),
    fundingSource: 'simulated'
  },
  {
    id: 'alloc_unfunded_no_sub_1',
    userId: 'user_no_sub_123',
    recipientUserId: 'writer_123',
    pageId: 'page_test_2',
    pageTitle: 'Test Page 2',
    tokens: 15,
    month: '2024-01',
    status: 'unfunded_no_subscription',
    createdAt: new Date('2024-01-16'),
    fundingSource: 'simulated'
  },
  {
    id: 'alloc_unfunded_over_budget_1',
    userId: 'user_over_budget_101',
    recipientUserId: 'writer_123',
    pageId: 'page_test_3',
    pageTitle: 'Test Page 3',
    tokens: 20,
    month: '2024-01',
    status: 'unfunded_over_budget',
    createdAt: new Date('2024-01-17'),
    fundingSource: 'subscription'
  },
  {
    id: 'alloc_funded_pending_1',
    userId: 'user_basic_456',
    recipientUserId: 'writer_123',
    pageId: 'page_test_4',
    pageTitle: 'Test Page 4',
    tokens: 25,
    month: '2024-01',
    status: 'funded_pending',
    createdAt: new Date('2024-01-18'),
    fundingSource: 'subscription'
  },
  {
    id: 'alloc_funded_locked_1',
    userId: 'user_premium_789',
    recipientUserId: 'writer_123',
    pageId: 'page_test_5',
    pageTitle: 'Test Page 5',
    tokens: 30,
    month: '2023-12',
    status: 'funded_locked',
    createdAt: new Date('2023-12-20'),
    fundingSource: 'subscription'
  }
];

// Test Pages for Token Allocation
export const TEST_PAGES = [
  {
    id: 'page_test_1',
    title: 'Understanding Token Economics',
    authorId: 'writer_123',
    authorUsername: 'contentwriter',
    content: 'A comprehensive guide to token economics...',
    createdAt: new Date('2024-01-10')
  },
  {
    id: 'page_test_2',
    title: 'Payment System Design',
    authorId: 'writer_123',
    authorUsername: 'contentwriter',
    content: 'How to design robust payment systems...',
    createdAt: new Date('2024-01-12')
  },
  {
    id: 'page_test_3',
    title: 'Subscription Models',
    authorId: 'writer_456',
    authorUsername: 'businesswriter',
    content: 'Different subscription models and their benefits...',
    createdAt: new Date('2024-01-14')
  }
];

// Mock Service Utilities
export class PaymentFlowTestUtils {

  /**
   * Mock Firebase Auth for different user states
   */
  static mockFirebaseAuth(user: TestUser | null = null) {
    const mockAuth = {
      currentUser: user ? {
        uid: user.uid,
        email: user.email,
        // WeWrite uses username field, not Firebase displayName
        displayName: user.username
      } : null,
      onAuthStateChanged: jest.fn(),
      signInWithEmailAndPassword: jest.fn(),
      signOut: jest.fn()
    };

    return mockAuth;
  }

  /**
   * Mock Firestore with test data
   */
  static mockFirestore(testData: any = {}) {
    const mockFirestore = {
      collection: jest.fn((collectionName: string) => ({
        doc: jest.fn((docId: string) => ({
          get: jest.fn().mockResolvedValue({
            exists: () => !!testData[collectionName]?.[docId],
            data: () => testData[collectionName]?.[docId] || null,
            id: docId
          }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        })),
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            docs: Object.entries(testData[collectionName] || {}).map(([id, data]) => ({
              id,
              data: () => data,
              exists: () => true
            }))
          })
        })),
        add: jest.fn(),
        get: jest.fn()
      })),
      doc: jest.fn(),
      runTransaction: jest.fn(),
      batch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn()
      }))
    };

    return mockFirestore;
  }

  /**
   * Mock Stripe with test responses
   */
  static mockStripe() {
    const mockStripe = {
      subscriptions: {
        create: jest.fn().mockResolvedValue({
          id: 'sub_test_123',
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
        }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'sub_test_123',
          status: 'active',
          items: {
            data: [{
              price: {
                unit_amount: 500,
                currency: 'usd'
              }
            }]
          }
        }),
        update: jest.fn(),
        cancel: jest.fn()
      },
      customers: {
        create: jest.fn().mockResolvedValue({
          id: 'cus_test_123'
        }),
        retrieve: jest.fn()
      },
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'cs_test_123',
            url: 'https://checkout.stripe.com/pay/cs_test_123'
          })
        }
      },
      transfers: {
        create: jest.fn().mockResolvedValue({
          id: 'tr_test_123',
          amount: 10000,
          currency: 'usd'
        })
      },
      accounts: {
        create: jest.fn().mockResolvedValue({
          id: 'acct_test_123'
        }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'acct_test_123',
          payouts_enabled: true,
          charges_enabled: true
        })
      },
      payouts: {
        create: jest.fn().mockResolvedValue({
          id: 'po_test_123',
          amount: 10000,
          status: 'pending'
        })
      }
    };

    return mockStripe;
  }

  /**
   * Mock localStorage for simulated tokens
   */
  static mockLocalStorage() {
    const storage: Record<string, string> = {};

    const mockLocalStorage = {
      getItem: jest.fn((key: string) => storage[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete storage[key];
      }),
      clear: jest.fn(() => {
        Object.keys(storage).forEach(key => delete storage[key]);
      })
    };

    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    return mockLocalStorage;
  }

  /**
   * Setup test environment with all mocks
   */
  static setupTestEnvironment(options: {
    currentUser?: TestUser;
    firestoreData?: any;
    enableLocalStorage?: boolean;
  } = {}) {
    const { currentUser, firestoreData = {}, enableLocalStorage = true } = options;

    // Mock Firebase Auth
    const mockAuth = this.mockFirebaseAuth(currentUser);

    // Mock Firestore
    const mockFirestore = this.mockFirestore(firestoreData);

    // Mock Stripe
    const mockStripe = this.mockStripe();

    // Mock localStorage if needed
    let mockLocalStorage;
    if (enableLocalStorage) {
      mockLocalStorage = this.mockLocalStorage();
    }

    return {
      mockAuth,
      mockFirestore,
      mockStripe,
      mockLocalStorage
    };
  }

  /**
   * Generate test correlation ID
   */
  static generateTestCorrelationId(): string {
    return `test_corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create test token allocation data
   */
  static createTestTokenAllocation(overrides: Partial<TestTokenAllocation> = {}): TestTokenAllocation {
    return {
      id: `test_alloc_${Date.now()}`,
      userId: 'test_user_123',
      recipientUserId: 'test_writer_456',
      pageId: 'test_page_789',
      pageTitle: 'Test Page',
      tokens: 10,
      month: '2024-01',
      status: 'funded_pending',
      createdAt: new Date(),
      fundingSource: 'subscription',
      ...overrides
    };
  }

  /**
   * Create test user with specific state
   */
  static createTestUser(overrides: Partial<TestUser> = {}): TestUser {
    return {
      uid: `test_user_${Date.now()}`,
      email: 'test@example.com',
      username: 'test_user',
      subscriptionStatus: 'none',
      ...overrides
    };
  }
}
