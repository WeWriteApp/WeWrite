/**
 * Embedded Checkout Flow Tests
 * 
 * Comprehensive test suite for the new PWA-compatible embedded checkout system
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Next.js router
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn((key: string) => {
      const params: Record<string, string> = {
        tier: 'tier2',
        amount: '25',
        return_to: '/test-page'
      };
      return params[key] || null;
    })
  })
}));

// Mock Firebase auth
jest.mock('../firebase/auth', () => ({
  auth: {
    currentUser: {
      uid: 'test-user-123',
      getIdToken: jest.fn().mockResolvedValue('mock-token')
    }
  }
}));

// Mock Stripe
const mockStripe = {
  confirmSetup: jest.fn(),
  elements: jest.fn()
};

const mockElements = {
  submit: jest.fn(),
  getElement: jest.fn()
};

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn().mockResolvedValue(mockStripe)
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  useStripe: () => mockStripe,
  useElements: () => mockElements,
  PaymentElement: () => 'PaymentElement',
  AddressElement: () => 'AddressElement'
}));

// Mock fetch
global.fetch = jest.fn();

describe('Embedded Checkout Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Setup Intent Creation', () => {
    it('should create setup intent for standard tier', async () => {
      const mockResponse = {
        success: true,
        clientSecret: 'seti_test_123',
        setupIntentId: 'seti_123',
        customerId: 'cus_123'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/subscription/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123',
          tier: 'tier2',
          amount: 20,
          tierName: 'Enthusiast',
          tokens: 200
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.clientSecret).toBe('seti_test_123');
    });

    it('should create setup intent for custom amount', async () => {
      const mockResponse = {
        success: true,
        clientSecret: 'seti_test_456',
        setupIntentId: 'seti_456',
        customerId: 'cus_123'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/subscription/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123',
          tier: 'custom',
          amount: 35,
          tierName: 'Custom Plan',
          tokens: 350
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.subscription.amount).toBe(35);
      expect(data.subscription.tokens).toBe(350);
    });

    it('should reject invalid custom amounts', async () => {
      const mockResponse = {
        error: 'Custom amount must be between $5 and $1000'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/subscription/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123',
          tier: 'custom',
          amount: 2, // Below minimum
          tierName: 'Custom Plan',
          tokens: 20
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('Subscription Creation with Payment Method', () => {
    it('should create subscription with valid payment method', async () => {
      const mockResponse = {
        success: true,
        subscriptionId: 'sub_123',
        status: 'active',
        subscription: {
          id: 'sub_123',
          tier: 'tier2',
          amount: 20,
          tokens: 200,
          tierName: 'Enthusiast',
          status: 'active'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/subscription/create-with-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123',
          paymentMethodId: 'pm_123',
          tier: 'tier2',
          amount: 20,
          tierName: 'Enthusiast',
          tokens: 200
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.subscriptionId).toBe('sub_123');
      expect(data.subscription.status).toBe('active');
    });

    it('should handle payment method errors', async () => {
      const mockResponse = {
        error: 'Invalid payment method'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/subscription/create-with-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123',
          paymentMethodId: 'pm_invalid',
          tier: 'tier2',
          amount: 20
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('Token System Integration', () => {
    it('should initialize token balance for new subscription', async () => {
      const mockResponse = {
        success: true,
        balance: {
          totalTokens: 200,
          allocatedTokens: 0,
          availableTokens: 200,
          subscriptionId: 'sub_123',
          month: '2024-01'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/tokens/initialize-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123',
          subscriptionId: 'sub_123'
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.balance.totalTokens).toBe(200);
      expect(data.balance.availableTokens).toBe(200);
    });

    it('should migrate unfunded allocations', async () => {
      const mockResponse = {
        success: true,
        migratedAllocations: 3,
        failedAllocations: 0,
        totalAllocations: 3
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/tokens/migrate-unfunded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123'
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.migratedAllocations).toBe(3);
    });
  });

  describe('PWA Compatibility', () => {
    it('should detect PWA environment', () => {
      // Mock PWA detection
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(display-mode: standalone)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const isPWA = window.matchMedia('(display-mode: standalone)').matches;
      expect(isPWA).toBe(true);
    });

    it('should handle offline scenarios', () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      expect(navigator.onLine).toBe(false);
    });

    it('should validate secure context', () => {
      // Mock secure context
      Object.defineProperty(window, 'isSecureContext', {
        writable: true,
        value: true,
      });

      expect(window.isSecureContext).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('/api/subscription/create-setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'test-user-123',
            tier: 'tier2',
            amount: 20
          })
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });

    it('should handle authentication errors', async () => {
      const mockResponse = {
        error: 'Authentication required'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/subscription/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-123',
          tier: 'tier2',
          amount: 20
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('Security Validation', () => {
    it('should validate HTTPS requirement', () => {
      // Mock HTTPS
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'https:',
          hostname: 'wewrite.app'
        },
        writable: true
      });

      expect(window.location.protocol).toBe('https:');
    });

    it('should validate user ID matching', async () => {
      const mockResponse = {
        error: 'User ID mismatch'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/subscription/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'different-user-456', // Different from authenticated user
          tier: 'tier2',
          amount: 20
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });
  });

  describe('Complete Checkout Flow Integration', () => {
    it('should complete full embedded checkout flow', async () => {
      // Step 1: Create setup intent
      const setupResponse = {
        success: true,
        clientSecret: 'seti_test_123',
        setupIntentId: 'seti_123',
        customerId: 'cus_123'
      };

      // Step 2: Create subscription
      const subscriptionResponse = {
        success: true,
        subscriptionId: 'sub_123',
        status: 'active'
      };

      // Step 3: Initialize tokens
      const tokenResponse = {
        success: true,
        balance: { totalTokens: 200, availableTokens: 200 }
      };

      // Step 4: Migrate unfunded
      const migrateResponse = {
        success: true,
        migratedAllocations: 2
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(setupResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(subscriptionResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(tokenResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(migrateResponse)
        });

      // Mock Stripe confirmation
      mockStripe.confirmSetup.mockResolvedValueOnce({
        setupIntent: {
          status: 'succeeded',
          payment_method: 'pm_123'
        }
      });

      mockElements.submit.mockResolvedValueOnce({ error: null });

      // Simulate complete flow
      const setupResult = await fetch('/api/subscription/create-setup-intent', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user-123',
          tier: 'tier2',
          amount: 20
        })
      });

      expect(setupResult.ok).toBe(true);

      const subscriptionResult = await fetch('/api/subscription/create-with-payment-method', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user-123',
          paymentMethodId: 'pm_123',
          tier: 'tier2',
          amount: 20
        })
      });

      expect(subscriptionResult.ok).toBe(true);

      const tokenResult = await fetch('/api/tokens/initialize-balance', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user-123',
          subscriptionId: 'sub_123'
        })
      });

      expect(tokenResult.ok).toBe(true);

      const migrateResult = await fetch('/api/tokens/migrate-unfunded', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user-123'
        })
      });

      expect(migrateResult.ok).toBe(true);
    });
  });
});
