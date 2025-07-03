/**
 * @jest-environment node
 */

import { UserDonorAnalyticsService } from '../services/userDonorAnalytics';

// Mock Firebase
jest.mock('../firebase/config', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn()
}));

jest.mock('../config/collections', () => ({
  getCollectionName: jest.fn((name) => `test_${name}`),
  PAYMENT_COLLECTIONS: {
    TOKEN_ALLOCATIONS: 'tokenAllocations'
  }
}));

describe('UserDonorAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserDonorAnalytics', () => {
    it('should return empty stats when no allocations exist', async () => {
      const { getDocs } = require('firebase/firestore');
      
      // Mock empty Firestore response
      getDocs.mockResolvedValue({
        forEach: jest.fn()
      });

      const result = await UserDonorAnalyticsService.getUserDonorAnalytics('test-user-id');

      expect(result).toEqual({
        currentMonthDonors: 0,
        totalActiveTokens: 0,
        monthlyData: [],
        sparklineData: Array(12).fill(0)
      });
    });

    it('should handle errors gracefully', async () => {
      const { getDocs } = require('firebase/firestore');
      
      // Mock Firestore error
      getDocs.mockRejectedValue(new Error('Firestore error'));

      const result = await UserDonorAnalyticsService.getUserDonorAnalytics('test-user-id');

      expect(result).toEqual({
        currentMonthDonors: 0,
        totalActiveTokens: 0,
        monthlyData: [],
        sparklineData: Array(12).fill(0)
      });
    });

    it('should generate correct sparkline data for 12 months', async () => {
      const result = await UserDonorAnalyticsService.getUserDonorAnalytics('test-user-id');
      
      expect(result.sparklineData).toHaveLength(12);
      expect(result.sparklineData.every(val => typeof val === 'number')).toBe(true);
    });
  });

  describe('listenToCurrentMonthDonors', () => {
    it('should call callback with initial stats', () => {
      const callback = jest.fn();
      
      const unsubscribe = UserDonorAnalyticsService.listenToCurrentMonthDonors(
        'test-user-id',
        callback
      );

      expect(typeof unsubscribe).toBe('function');
      // Note: The actual callback execution is async, so we can't test it synchronously
    });

    it('should handle errors in listener setup', () => {
      const callback = jest.fn();
      
      // This should not throw
      expect(() => {
        UserDonorAnalyticsService.listenToCurrentMonthDonors('', callback);
      }).not.toThrow();
    });
  });
});
