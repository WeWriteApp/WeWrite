/**
 * Comprehensive tests for Financial State Synchronization Service
 * 
 * Tests conflict detection, resolution, and state synchronization
 * across token system, Stripe, and database.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FinancialStateSynchronizationService } from '../services/financialStateSynchronizationService';
import { FinancialUtils } from '../types/financial';

// Mock Firebase
jest.mock('../firebase/config', () => ({
  db: {}}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  runTransaction: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  increment: jest.fn((value) => ({ _increment: value }))}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    accounts: {
      retrieve: jest.fn()},
    balance: {
      retrieve: jest.fn()}}));
});

jest.mock('../utils/stripeConfig', () => ({
  getStripeSecretKey: jest.fn(() => 'sk_test_mock')}));

describe('Financial State Synchronization Service', () => {
  let syncService: FinancialStateSynchronizationService;
  let correlationId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    syncService = FinancialStateSynchronizationService.getInstance();
    correlationId = FinancialUtils.generateCorrelationId();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('State Snapshot Creation', () => {
    test('should create comprehensive state snapshot', async () => {
      const userId = 'user_123';

      // Mock token balance
      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId,
          availableUsdValue: 100.50,
          availableTokens: 1005,
          totalUsdEarned: 150.75,
          paidOutUsdValue: 50.25,
          stripeConnectedAccountId: 'acct_test123'
        })
      });

      // Mock earnings, payouts, and allocations
      const { getDocs } = require('firebase/firestore');
      getDocs
        .mockResolvedValueOnce({ // payouts
          docs: [{
            id: 'payout_1',
            data: () => ({
              id: 'payout_1',
              userId,
              amount: 50.25,
              status: 'completed',
              createdAt: new Date('2024-01-15')
            })
          }]
        })
        .mockResolvedValueOnce({ // earnings
          docs: [{
            id: 'earnings_1',
            data: () => ({
              id: 'earnings_1',
              userId,
              month: '2024-01',
              tokensEarned: 1005,
              usdValue: 100.50,
              status: 'available'
            })
          }]
        })
        .mockResolvedValueOnce({ // allocations
          docs: [{
            id: 'allocation_1',
            data: () => ({
              id: 'allocation_1',
              userId: 'allocator_123',
              recipientUserId: userId,
              tokens: 1005,
              month: '2024-01',
              status: 'active'
            })
          }]
        });

      // Mock Stripe balance
      const Stripe = require('stripe');
      const mockStripe = new Stripe();
      mockStripe.accounts.retrieve.mockResolvedValue({
        external_accounts: { data: [{ id: 'bank_123' }] }
      });
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 10050, currency: 'usd' }],
        pending: [{ amount: 0, currency: 'usd' }]
      });

      const result = await syncService.synchronizeUserFinancialState(userId, correlationId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.conflicts).toBeDefined();
      expect(result.data!.checksumBefore).toBeDefined();
      expect(result.data!.checksumAfter).toBeDefined();
    });
  });

  describe('Conflict Detection', () => {
    test('should detect balance mismatch conflicts', async () => {
      const userId = 'user_balance_mismatch';

      // Mock inconsistent data
      const { getDoc, getDocs } = require('firebase/firestore');
      
      // Token balance shows $100 available
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId,
          availableUsdValue: 100.00,
          availableTokens: 1000,
          totalUsdEarned: 150.00,
          paidOutUsdValue: 50.00
        })
      });

      // But earnings show $120 and payouts show $30 (should be $90 available)
      getDocs
        .mockResolvedValueOnce({ // payouts
          docs: [{
            id: 'payout_1',
            data: () => ({
              id: 'payout_1',
              userId,
              amount: 30.00,
              status: 'completed'
            })
          }]
        })
        .mockResolvedValueOnce({ // earnings
          docs: [{
            id: 'earnings_1',
            data: () => ({
              id: 'earnings_1',
              userId,
              month: '2024-01',
              tokensEarned: 1200,
              usdValue: 120.00,
              status: 'available'
            })
          }]
        })
        .mockResolvedValueOnce({ // allocations
          docs: [{
            id: 'allocation_1',
            data: () => ({
              id: 'allocation_1',
              recipientUserId: userId,
              tokens: 1200,
              month: '2024-01'
            })
          }]
        });

      const result = await syncService.synchronizeUserFinancialState(userId, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.conflicts.length).toBeGreaterThan(0);
      
      const balanceConflict = result.data!.conflicts.find(c => c.type === 'balance_mismatch');
      expect(balanceConflict).toBeDefined();
      expect(balanceConflict!.severity).toBe('medium');
    });

    test('should detect duplicate record conflicts', async () => {
      const userId = 'user_duplicates';

      const { getDoc, getDocs } = require('firebase/firestore');
      
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId,
          availableUsdValue: 100.00,
          availableTokens: 1000
        })
      });

      // Mock duplicate earnings records
      getDocs
        .mockResolvedValueOnce({ // payouts
          docs: []
        })
        .mockResolvedValueOnce({ // earnings - duplicates
          docs: [
            {
              id: 'earnings_1',
              data: () => ({
                id: 'earnings_1',
                userId,
                month: '2024-01',
                tokensEarned: 500,
                usdValue: 50.00,
                status: 'available',
                createdAt: new Date('2024-01-15T10:00:00Z')
              })
            },
            {
              id: 'earnings_2',
              data: () => ({
                id: 'earnings_2',
                userId,
                month: '2024-01',
                tokensEarned: 500,
                usdValue: 50.00,
                status: 'available',
                createdAt: new Date('2024-01-15T10:05:00Z')
              })
            }
          ]
        })
        .mockResolvedValueOnce({ // allocations
          docs: []
        });

      const result = await syncService.synchronizeUserFinancialState(userId, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.conflicts.length).toBeGreaterThan(0);
      
      const duplicateConflict = result.data!.conflicts.find(c => c.type === 'duplicate_record');
      expect(duplicateConflict).toBeDefined();
      expect(duplicateConflict!.severity).toBe('high');
    });

    test('should detect missing record conflicts', async () => {
      const userId = 'user_missing_records';

      const { getDoc, getDocs } = require('firebase/firestore');
      
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId,
          availableUsdValue: 0,
          availableTokens: 0
        })
      });

      getDocs
        .mockResolvedValueOnce({ // payouts
          docs: []
        })
        .mockResolvedValueOnce({ // earnings - empty
          docs: []
        })
        .mockResolvedValueOnce({ // allocations - has data but no corresponding earnings
          docs: [{
            id: 'allocation_1',
            data: () => ({
              id: 'allocation_1',
              recipientUserId: userId,
              tokens: 1000,
              month: '2024-01',
              status: 'active'
            })
          }]
        });

      const result = await syncService.synchronizeUserFinancialState(userId, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.conflicts.length).toBeGreaterThan(0);
      
      const missingConflict = result.data!.conflicts.find(c => c.type === 'missing_record');
      expect(missingConflict).toBeDefined();
      expect(missingConflict!.severity).toBe('high');
    });
  });

  describe('Conflict Resolution', () => {
    test('should resolve duplicate records in aggressive mode', async () => {
      const aggressiveService = FinancialStateSynchronizationService.getInstance({
        conflictResolutionStrategy: 'aggressive',
        enableAutoResolution: true
      });

      const userId = 'user_aggressive_resolution';

      const { getDoc, getDocs, updateDoc } = require('firebase/firestore');
      
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId, availableUsdValue: 50.00 })
      });

      // Mock duplicate earnings
      getDocs
        .mockResolvedValueOnce({ docs: [] }) // payouts
        .mockResolvedValueOnce({ // earnings - duplicates
          docs: [
            {
              id: 'earnings_1',
              data: () => ({
                id: 'earnings_1',
                userId,
                month: '2024-01',
                amount: 50.00,
                createdAt: new Date('2024-01-15T10:00:00Z')
              })
            },
            {
              id: 'earnings_2',
              data: () => ({
                id: 'earnings_2',
                userId,
                month: '2024-01',
                amount: 50.00,
                createdAt: new Date('2024-01-15T10:05:00Z')
              })
            }
          ]
        })
        .mockResolvedValueOnce({ docs: [] }); // allocations

      updateDoc.mockResolvedValue(undefined);

      const result = await aggressiveService.synchronizeUserFinancialState(userId, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.resolvedConflicts.length).toBeGreaterThan(0);
      expect(updateDoc).toHaveBeenCalled();
    });

    test('should not auto-resolve in conservative mode', async () => {
      const conservativeService = FinancialStateSynchronizationService.getInstance({
        conflictResolutionStrategy: 'conservative',
        enableAutoResolution: true
      });

      const userId = 'user_conservative_resolution';

      const { getDoc, getDocs } = require('firebase/firestore');
      
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ userId, availableUsdValue: 100.00 })
      });

      // Mock balance mismatch
      getDocs
        .mockResolvedValueOnce({ // payouts
          docs: [{
            id: 'payout_1',
            data: () => ({ amount: 25.00, status: 'completed' })
          }]
        })
        .mockResolvedValueOnce({ // earnings
          docs: [{
            id: 'earnings_1',
            data: () => ({
              userId,
              usdValue: 150.00,
              status: 'available'
            })
          }]
        })
        .mockResolvedValueOnce({ docs: [] }); // allocations

      const result = await conservativeService.synchronizeUserFinancialState(userId, correlationId);

      expect(result.success).toBe(false); // Should not auto-resolve critical conflicts
      expect(result.data!.unresolvedConflicts.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    test('should allow configuration updates', () => {
      const newConfig = {
        enableAutoResolution: false,
        conflictResolutionStrategy: 'manual' as const,
        maxRetries: 5
      };

      syncService.updateConfig(newConfig);
      const config = syncService.getConfig();

      expect(config.enableAutoResolution).toBe(false);
      expect(config.conflictResolutionStrategy).toBe('manual');
      expect(config.maxRetries).toBe(5);
    });

    test('should maintain default values for unspecified config', () => {
      const partialConfig = {
        enableAutoResolution: false
      };

      syncService.updateConfig(partialConfig);
      const config = syncService.getConfig();

      expect(config.enableAutoResolution).toBe(false);
      expect(config.enableChecksumValidation).toBe(true); // Should keep default
      expect(config.enableVersionControl).toBe(true); // Should keep default
    });
  });

  describe('Checksum Validation', () => {
    test('should generate consistent checksums for identical states', () => {
      const state1 = {
        tokenBalance: { availableUsdValue: 100 },
        earnings: [{ amount: 50 }],
        payouts: []
      };

      const state2 = {
        tokenBalance: { availableUsdValue: 100 },
        earnings: [{ amount: 50 }],
        payouts: []
      };

      // Access private method for testing
      const checksum1 = (syncService as any).calculateStateChecksum(state1);
      const checksum2 = (syncService as any).calculateStateChecksum(state2);

      expect(checksum1).toBe(checksum2);
    });

    test('should generate different checksums for different states', () => {
      const state1 = {
        tokenBalance: { availableUsdValue: 100 },
        earnings: [{ amount: 50 }]
      };

      const state2 = {
        tokenBalance: { availableUsdValue: 200 },
        earnings: [{ amount: 50 }]
      };

      const checksum1 = (syncService as any).calculateStateChecksum(state1);
      const checksum2 = (syncService as any).calculateStateChecksum(state2);

      expect(checksum1).not.toBe(checksum2);
    });
  });
});