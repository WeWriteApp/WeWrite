/**
 * Jest Setup Configuration
 * Global test setup for payment and payout system tests
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_key_for_testing';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_webhook_secret';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_key_for_testing';

// Mock Firebase Admin
jest.mock('./app/firebase/admin', () => ({
  initAdmin: jest.fn(() => ({
    firestore: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        })),
        add: jest.fn(),
        where: jest.fn(() => ({
          get: jest.fn(),
          orderBy: jest.fn(() => ({
            get: jest.fn(),
          })),
        })),
        orderBy: jest.fn(() => ({
          get: jest.fn(),
        })),
        get: jest.fn(),
      })),
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })),
      runTransaction: jest.fn(),
    })),
    auth: jest.fn(() => ({
      getUser: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
    })),
  })),
}));

// Mock Firebase Client
jest.mock('./app/firebase/config', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })),
      add: jest.fn(),
      where: jest.fn(() => ({
        get: jest.fn(),
        orderBy: jest.fn(() => ({
          get: jest.fn(),
        })),
      })),
      orderBy: jest.fn(() => ({
        get: jest.fn(),
      })),
      get: jest.fn(),
    })),
    doc: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
    runTransaction: jest.fn(),
  },
}));

// Mock Stripe configuration
jest.mock('./app/utils/stripeConfig', () => ({
  getStripeSecretKey: jest.fn(() => 'sk_test_mock_key_for_testing'),
  getStripeWebhookSecret: jest.fn(() => 'whsec_test_mock_webhook_secret'),
}));

// Global test utilities
global.testUtils = {
  // Generate test correlation ID
  generateTestCorrelationId: () => `test_corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  
  // Generate test user ID
  generateTestUserId: () => `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  
  // Generate test subscription ID
  generateTestSubscriptionId: () => `sub_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  
  // Mock Firestore document
  mockFirestoreDoc: (data = {}) => ({
    exists: () => Object.keys(data).length > 0,
    data: () => data,
    id: `mock_doc_${Date.now()}`,
  }),
  
  // Mock Firestore collection
  mockFirestoreCollection: (docs = []) => ({
    size: docs.length,
    docs: docs.map(data => global.testUtils.mockFirestoreDoc(data)),
    forEach: (callback) => docs.forEach((data, index) => 
      callback(global.testUtils.mockFirestoreDoc(data), index)
    ),
  }),
  
  // Wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock successful Stripe response
  mockStripeSuccess: (data = {}) => ({
    success: true,
    data: {
      id: `mock_stripe_${Date.now()}`,
      ...data,
    },
  }),
  
  // Mock failed Stripe response
  mockStripeFailure: (error = 'Mock Stripe error') => ({
    success: false,
    error,
  }),
};

// Console override for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  // Only show errors that aren't expected test errors
  if (!args.some(arg => 
    typeof arg === 'string' && 
    (arg.includes('Mock') || arg.includes('test') || arg.includes('Test'))
  )) {
    originalConsoleError(...args);
  }
};

console.warn = (...args) => {
  // Only show warnings that aren't expected test warnings
  if (!args.some(arg => 
    typeof arg === 'string' && 
    (arg.includes('Mock') || arg.includes('test') || arg.includes('Test'))
  )) {
    originalConsoleWarn(...args);
  }
};

// Cleanup after tests
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for integration tests
jest.setTimeout(30000);
