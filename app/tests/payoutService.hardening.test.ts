import { describe, expect, test, jest, beforeEach } from '@jest/globals';

jest.mock('../firebase/firebaseAdmin', () => ({
  getFirebaseAdmin: jest.fn(() => {
    throw new Error('Database not available');
  }),
  FieldValue: {
    serverTimestamp: jest.fn(),
    increment: jest.fn(),
  },
}));

jest.mock('../lib/stripe', () => ({
  getStripe: jest.fn(() => ({
    accounts: {
      retrieve: jest.fn(),
    },
  })),
}));

jest.mock('../services/stripeStorageBalanceService', () => ({
  stripeStorageBalanceService: {
    processPayoutFromStorage: jest.fn(),
  },
}));

describe('PayoutService hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('processPayout returns structured error when admin is unavailable', async () => {
    const { PayoutService } = await import('../services/payoutService');
    const result = await PayoutService.processPayout('payout_test_123');

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error).toContain('Database not available');
  });
});
