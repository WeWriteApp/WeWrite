/**
 * Tests for Stripe Error Message Utility
 */

import { parseStripeError, formatStripeErrorForDisplay, createDetailedErrorLog } from '../stripeErrorMessages';

describe('Stripe Error Message Utility', () => {
  describe('parseStripeError', () => {
    it('should handle generic decline code', () => {
      const error = {
        type: 'card_error',
        code: 'generic_decline',
        decline_code: 'generic_decline',
        message: 'Your card was declined.'
      };

      const result = parseStripeError(error);

      expect(result.userMessage).toContain('Your card was declined by your bank');
      expect(result.category).toBe('card_declined');
      expect(result.severity).toBe('medium');
      expect(result.retryable).toBe(true);
      expect(result.actionableSteps).toContain('Try a different payment method');
    });

    it('should handle insufficient funds', () => {
      const error = {
        type: 'card_error',
        code: 'insufficient_funds',
        message: 'Your card has insufficient funds.'
      };

      const result = parseStripeError(error);

      expect(result.userMessage).toContain('insufficient funds');
      expect(result.category).toBe('insufficient_funds');
      expect(result.actionableSteps).toContain('Add funds to your account');
    });

    it('should handle expired card', () => {
      const error = {
        type: 'card_error',
        code: 'expired_card',
        message: 'Your card has expired.'
      };

      const result = parseStripeError(error);

      expect(result.userMessage).toContain('expired');
      expect(result.category).toBe('expired_card');
      expect(result.retryable).toBe(false);
    });

    it('should handle authentication required', () => {
      const error = {
        type: 'authentication_required',
        message: 'Additional authentication is required.'
      };

      const result = parseStripeError(error);

      expect(result.userMessage).toContain('Additional authentication');
      expect(result.category).toBe('authentication');
      expect(result.actionableSteps).toContain('Complete the authentication process');
    });

    it('should handle fraudulent transactions', () => {
      const error = {
        type: 'card_error',
        code: 'fraudulent',
        message: 'Your card was declined.'
      };

      const result = parseStripeError(error);

      expect(result.userMessage).toContain('fraudulent');
      expect(result.severity).toBe('high');
      expect(result.actionableSteps).toContain('Contact your bank to verify');
    });

    it('should handle unknown errors gracefully', () => {
      const error = {
        message: 'Some unknown error occurred'
      };

      const result = parseStripeError(error);

      expect(result.userMessage).toContain('try a different payment method');
      expect(result.category).toBe('other');
      expect(result.retryable).toBe(true);
    });

    it('should detect error patterns in messages', () => {
      const insufficientFundsError = {
        message: 'Transaction failed due to insufficient funds'
      };

      const result = parseStripeError(insufficientFundsError);
      expect(result.category).toBe('insufficient_funds');
    });
  });

  describe('formatStripeErrorForDisplay', () => {
    it('should format error for UI display', () => {
      const error = {
        type: 'card_error',
        code: 'card_declined',
        message: 'Your card was declined.'
      };

      const result = formatStripeErrorForDisplay(error);

      expect(result.title).toBe('Card Declined');
      expect(result.message).toBeTruthy();
      expect(result.steps).toBeInstanceOf(Array);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.severity).toBeTruthy();
      expect(typeof result.retryable).toBe('boolean');
    });
  });

  describe('createDetailedErrorLog', () => {
    it('should create detailed error log', () => {
      const error = {
        type: 'card_error',
        code: 'insufficient_funds',
        message: 'Your card has insufficient funds.'
      };

      const context = {
        userId: 'test-user-123',
        amount: 29.99
      };

      const result = createDetailedErrorLog(error, context);
      const parsed = JSON.parse(result);

      expect(parsed.timestamp).toBeTruthy();
      expect(parsed.userMessage).toBeTruthy();
      expect(parsed.technicalMessage).toBeTruthy();
      expect(parsed.category).toBe('insufficient_funds');
      expect(parsed.context.userId).toBe('test-user-123');
      expect(parsed.context.amount).toBe(29.99);
    });
  });

  describe('Edge cases', () => {
    it('should handle null/undefined errors', () => {
      const result1 = parseStripeError(null);
      const result2 = parseStripeError(undefined);
      const result3 = parseStripeError({});

      [result1, result2, result3].forEach(result => {
        expect(result.userMessage).toBeTruthy();
        expect(result.actionableSteps).toBeInstanceOf(Array);
        expect(result.actionableSteps.length).toBeGreaterThan(0);
      });
    });

    it('should handle errors with only message', () => {
      const error = 'Simple error string';
      const result = parseStripeError(error);

      expect(result.userMessage).toBeTruthy();
      expect(result.technicalMessage).toContain('Simple error string');
    });
  });
});
