/**
 * Tests for embedded bank account components
 * Ensures PWA compatibility and proper functionality
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Mock current account provider
jest.mock('../providers/CurrentAccountProvider', () => ({
  useCurrentAccount: () => ({
    currentAccount: {
      uid: 'test-user-123',
      email: 'test@example.com',
      username: 'testuser'
    }
  })
}));

// Mock toast
jest.mock('../components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

// Mock Stripe configuration
jest.mock('../utils/stripeConfig', () => ({
  getStripePublishableKey: () => 'pk_test_123'
}));

// Mock global fetch
global.fetch = jest.fn();

// Mock Stripe Connect JS
const mockStripeConnect = {
  initialize: jest.fn().mockResolvedValue(undefined),
  create: jest.fn().mockReturnValue({
    setOnExit: jest.fn(),
    setOnLoadError: jest.fn(),
    appendChild: jest.fn()
  })
};

// Mock window.StripeConnect
Object.defineProperty(window, 'StripeConnect', {
  value: jest.fn().mockReturnValue(mockStripeConnect),
  writable: true
});

describe('Embedded Bank Account Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/stripe/account-session')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            client_secret: 'acct_session_test_123',
            account_id: 'acct_test_123',
            expires_at: Date.now() + 3600000
          })
        });
      }
      
      if (url.includes('/api/stripe/account-status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              details_submitted: false,
              payouts_enabled: false,
              bank_account: null,
              requirements: {
                currently_due: []
              }
            }
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  describe('PWA Compatibility', () => {
    test('should handle offline scenarios gracefully', async () => {
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { EmbeddedBankAccountSetup } = await import('../components/payments/EmbeddedBankAccountSetup');
      
      render(<EmbeddedBankAccountSetup />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to initialize bank account setup/i)).toBeInTheDocument();
      });
    });

    test('should work without external dependencies in PWA mode', async () => {
      // Simulate PWA environment
      Object.defineProperty(window, 'navigator', {
        value: {
          ...window.navigator,
          standalone: true, // iOS PWA
          serviceWorker: {
            ready: Promise.resolve({})
          }
        },
        writable: true
      });

      const { EmbeddedBankAccountManager } = await import('../components/payments/EmbeddedBankAccountManager');
      
      render(<EmbeddedBankAccountManager />);
      
      // Should render without errors in PWA mode
      expect(screen.getByText(/Loading bank account management/i)).toBeInTheDocument();
    });
  });

  describe('Security and Error Handling', () => {
    test('should handle authentication errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      });

      const { EmbeddedBankAccountSetup } = await import('../components/payments/EmbeddedBankAccountSetup');
      
      render(<EmbeddedBankAccountSetup />);
      
      await waitFor(() => {
        expect(screen.getByText(/Unauthorized/i)).toBeInTheDocument();
      });
    });

    test('should handle Stripe API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ 
          error: 'Stripe error: Invalid account configuration',
          code: 'account_invalid'
        })
      });

      const { EmbeddedBankAccountSetup } = await import('../components/payments/EmbeddedBankAccountSetup');
      
      render(<EmbeddedBankAccountSetup />);
      
      await waitFor(() => {
        expect(screen.getByText(/Stripe error: Invalid account configuration/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Experience', () => {
    test('should show loading states appropriately', async () => {
      const { EmbeddedBankAccountSetup } = await import('../components/payments/EmbeddedBankAccountSetup');
      
      render(<EmbeddedBankAccountSetup />);
      
      expect(screen.getByText(/Loading bank account setup/i)).toBeInTheDocument();
    });

    test('should handle component mounting and unmounting', async () => {
      const { EmbeddedBankAccountManager } = await import('../components/payments/EmbeddedBankAccountManager');
      
      const { unmount } = render(<EmbeddedBankAccountManager />);
      
      // Should mount without errors
      expect(screen.getByText(/Loading bank account management/i)).toBeInTheDocument();
      
      // Should unmount without errors
      unmount();
    });
  });

  describe('Integration with WeWrite Architecture', () => {
    test('should use environment-aware collections', async () => {
      const { EmbeddedBankAccountSetup } = await import('../components/payments/EmbeddedBankAccountSetup');
      
      render(<EmbeddedBankAccountSetup />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/stripe/account-session',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          })
        );
      });
    });

    test('should follow API-first architecture', async () => {
      const { EmbeddedBankAccountManager } = await import('../components/payments/EmbeddedBankAccountManager');
      
      render(<EmbeddedBankAccountManager />);
      
      // Should make API calls instead of direct Firebase calls
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/stripe/'),
          expect.any(Object)
        );
      });
    });
  });
});
