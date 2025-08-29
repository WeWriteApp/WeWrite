/**
 * Subscription Validation Service
 * 
 * Provides utilities for validating subscription state and preventing duplicates.
 * This service ensures data integrity in the subscription system.
 */

import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';

// Create Stripe instance
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2025-06-30.basil',
});

export interface ExistingSubscriptionCheck {
  hasActiveSubscription: boolean;
  existingSubscriptionId?: string;
  existingSubscription?: any;
}

export class SubscriptionValidationService {
  /**
   * Check if a customer already has active subscriptions
   */
  static async checkForExistingSubscriptions(customerId: string): Promise<ExistingSubscriptionCheck> {
    try {
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 10
      });

      if (existingSubscriptions.data.length > 0) {
        const existingSubscription = existingSubscriptions.data[0];
        return {
          hasActiveSubscription: true,
          existingSubscriptionId: existingSubscription.id,
          existingSubscription
        };
      }

      return {
        hasActiveSubscription: false
      };
    } catch (error) {
      console.error('[SUBSCRIPTION VALIDATION] Error checking existing subscriptions:', error);
      throw new Error('Failed to validate existing subscriptions');
    }
  }

  /**
   * Validate that a subscription creation request is allowed
   * Returns error response if validation fails, null if valid
   */
  static validateSubscriptionCreation(existingCheck: ExistingSubscriptionCheck) {
    if (existingCheck.hasActiveSubscription) {
      return {
        error: 'User already has active subscription. Use update endpoint instead.',
        existingSubscriptionId: existingCheck.existingSubscriptionId,
        shouldUpdate: true,
        statusCode: 409
      };
    }
    return null;
  }

  /**
   * Validate subscription status after creation
   */
  static validateSubscriptionStatus(subscription: any, expectedStatus: string = 'active') {
    if (subscription.status !== expectedStatus) {
      throw new Error(`Subscription creation failed with status: ${subscription.status}. Please check your payment method and try again.`);
    }
  }

  /**
   * Log subscription validation events for debugging
   */
  static logValidationEvent(event: string, details: any) {
    console.log(`[SUBSCRIPTION VALIDATION] ${event}:`, details);
  }
}

export const subscriptionValidationService = new SubscriptionValidationService();
