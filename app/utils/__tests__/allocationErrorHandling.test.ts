import { 
  AllocationErrorHandler, 
  allocationErrorHandler,
  getUserFriendlyErrorMessage,
  getErrorRecoveryActions,
  shouldRetryError,
  getRetryConfiguration
} from '../allocationErrorHandling';
import { AllocationError, ALLOCATION_ERROR_CODES } from '../../types/allocation';

describe('AllocationErrorHandler', () => {
  let handler: AllocationErrorHandler;

  beforeEach(() => {
    handler = new AllocationErrorHandler();
  });

  afterEach(() => {
    handler.clearErrorTracking();
  });

  describe('handleError', () => {
    it('should handle insufficient funds error', () => {
      const error = new AllocationError(
        'Not enough funds',
        ALLOCATION_ERROR_CODES.INSUFFICIENT_FUNDS
      );

      const result = handler.handleError(error);

      expect(result.severity).toBe('medium');
      expect(result.shouldRetry).toBe(false);
      expect(result.userMessage).toContain('enough funds');
      expect(result.recoveryActions).toContain('Add funds to your account');
      expect(result.showToUser).toBe(true);
      expect(result.reportToAnalytics).toBe(true);
    });

    it('should handle invalid amount error', () => {
      const error = new AllocationError(
        'Invalid amount',
        ALLOCATION_ERROR_CODES.INVALID_AMOUNT
      );

      const result = handler.handleError(error);

      expect(result.severity).toBe('low');
      expect(result.shouldRetry).toBe(false);
      expect(result.userMessage).toContain('invalid');
      expect(result.recoveryActions).toContain('Try a positive allocation amount');
    });

    it('should handle unauthorized error', () => {
      const error = new AllocationError(
        'Not authenticated',
        ALLOCATION_ERROR_CODES.UNAUTHORIZED
      );

      const result = handler.handleError(error);

      expect(result.severity).toBe('high');
      expect(result.shouldRetry).toBe(false);
      expect(result.userMessage).toContain('logged in');
      expect(result.recoveryActions).toContain('Sign in to your account');
    });

    it('should handle rate limited error', () => {
      const error = new AllocationError(
        'Too many requests',
        ALLOCATION_ERROR_CODES.RATE_LIMITED,
        true
      );

      const result = handler.handleError(error);

      expect(result.severity).toBe('medium');
      expect(result.shouldRetry).toBe(true);
      expect(result.retryDelay).toBe(5000);
      expect(result.maxRetries).toBe(3);
      expect(result.userMessage).toContain('too quickly');
    });

    it('should handle network error', () => {
      const error = new AllocationError(
        'Network failed',
        ALLOCATION_ERROR_CODES.NETWORK_ERROR,
        true
      );

      const result = handler.handleError(error);

      expect(result.severity).toBe('medium');
      expect(result.shouldRetry).toBe(true);
      expect(result.retryDelay).toBe(2000);
      expect(result.userMessage).toContain('Connection failed');
      expect(result.recoveryActions).toContain('Check your internet connection');
    });

    it('should handle page not found error', () => {
      const error = new AllocationError(
        'Page does not exist',
        ALLOCATION_ERROR_CODES.PAGE_NOT_FOUND
      );

      const result = handler.handleError(error);

      expect(result.severity).toBe('medium');
      expect(result.shouldRetry).toBe(false);
      expect(result.userMessage).toContain("doesn't exist");
      expect(result.recoveryActions).toContain('Check that the page URL is correct');
    });

    it('should handle generic errors', () => {
      const error = new Error('Something went wrong');

      const result = handler.handleError(error);

      expect(result.severity).toBe('medium');
      expect(result.shouldRetry).toBe(true);
      expect(result.userMessage).toContain('Something went wrong');
      expect(result.recoveryActions).toContain('Try refreshing the page');
    });
  });

  describe('error frequency tracking', () => {
    it('should track error frequency', () => {
      const error = new AllocationError(
        'Network error',
        ALLOCATION_ERROR_CODES.NETWORK_ERROR,
        true
      );
      const context = { pageId: 'test-page', userId: 'test-user' };

      // First few errors should be normal
      for (let i = 0; i < 3; i++) {
        const result = handler.handleError(error, context);
        expect(result.severity).toBe('medium');
        expect(result.retryDelay).toBe(2000);
      }

      // After threshold, should be treated as frequent error
      for (let i = 0; i < 3; i++) {
        const result = handler.handleError(error, context);
        expect(result.severity).toBe('high');
        expect(result.retryDelay).toBe(30000);
        expect(result.maxRetries).toBe(1);
        expect(result.userMessage).toContain('experiencing connection issues');
      }
    });

    it('should reset error count after time window', () => {
      const error = new AllocationError(
        'Network error',
        ALLOCATION_ERROR_CODES.NETWORK_ERROR,
        true
      );
      const context = { pageId: 'test-page', userId: 'test-user' };

      // Trigger frequent errors
      for (let i = 0; i < 6; i++) {
        handler.handleError(error, context);
      }

      // Mock time passage (more than 1 minute)
      const originalNow = Date.now;
      const mockNow = jest.spyOn(Date, 'now').mockReturnValue(originalNow() + 70000);

      // Next error should be treated as normal again
      const result = handler.handleError(error, context);
      expect(result.severity).toBe('medium');
      expect(result.retryDelay).toBe(2000);

      mockNow.mockRestore();
    });

    it('should provide error statistics', () => {
      const error1 = new AllocationError('Error 1', ALLOCATION_ERROR_CODES.NETWORK_ERROR);
      const error2 = new AllocationError('Error 2', ALLOCATION_ERROR_CODES.INVALID_AMOUNT);

      handler.handleError(error1, { pageId: 'page1' });
      handler.handleError(error1, { pageId: 'page1' });
      handler.handleError(error2, { pageId: 'page2' });

      const stats = handler.getErrorStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.frequentErrors).toHaveLength(0); // Below threshold
    });
  });

  describe('error analytics', () => {
    it('should create error analytics data', () => {
      const error = new AllocationError(
        'Test error',
        ALLOCATION_ERROR_CODES.NETWORK_ERROR
      );
      const context = {
        pageId: 'test-page',
        userId: 'test-user',
        changeCents: 100,
        source: 'FloatingBar'
      };

      const analytics = handler.createErrorAnalytics(error, context);

      expect(analytics.errorCode).toBe(ALLOCATION_ERROR_CODES.NETWORK_ERROR);
      expect(analytics.errorMessage).toBe('Test error');
      expect(analytics.context).toEqual(context);
      expect(analytics.timestamp).toBeInstanceOf(Date);
      expect(analytics.userId).toBe('test-user');
    });

    it('should handle generic error analytics', () => {
      const error = new Error('Generic error');
      const context = { pageId: 'test-page' };

      const analytics = handler.createErrorAnalytics(error, context);

      expect(analytics.errorCode).toBe('GENERIC_ERROR');
      expect(analytics.errorMessage).toBe('Generic error');
    });
  });

  describe('utility functions', () => {
    it('should get user-friendly error message', () => {
      const error = new AllocationError(
        'Insufficient funds',
        ALLOCATION_ERROR_CODES.INSUFFICIENT_FUNDS
      );

      const message = getUserFriendlyErrorMessage(error);
      expect(message).toContain('enough funds');
    });

    it('should get recovery actions', () => {
      const error = new AllocationError(
        'Network error',
        ALLOCATION_ERROR_CODES.NETWORK_ERROR,
        true
      );

      const actions = getErrorRecoveryActions(error);
      expect(actions).toContain('Check your internet connection');
      expect(actions).toContain('Try refreshing the page');
    });

    it('should determine retry eligibility', () => {
      const retryableError = new AllocationError(
        'Network error',
        ALLOCATION_ERROR_CODES.NETWORK_ERROR,
        true
      );
      const nonRetryableError = new AllocationError(
        'Invalid amount',
        ALLOCATION_ERROR_CODES.INVALID_AMOUNT
      );

      expect(shouldRetryError(retryableError)).toBe(true);
      expect(shouldRetryError(nonRetryableError)).toBe(false);
    });

    it('should get retry configuration', () => {
      const error = new AllocationError(
        'Rate limited',
        ALLOCATION_ERROR_CODES.RATE_LIMITED,
        true
      );

      const config = getRetryConfiguration(error);
      expect(config.delay).toBe(5000);
      expect(config.maxRetries).toBe(3);
    });
  });

  describe('global error handler instance', () => {
    it('should use the same instance across calls', () => {
      const error = new AllocationError(
        'Test error',
        ALLOCATION_ERROR_CODES.NETWORK_ERROR
      );

      const result1 = allocationErrorHandler.handleError(error);
      const result2 = allocationErrorHandler.handleError(error);

      // Should track frequency across calls
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
