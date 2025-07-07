/**
 * Unified Subscription Service for WeWrite
 * 
 * Consolidates all subscription-related functionality including:
 * - Stripe Checkout integration
 * - Token allocation management
 * - Subscription status tracking
 * - Integration with existing pledge system
 */

import { loadStripe } from '@stripe/stripe-js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { TokenService } from './tokenService';
import {
  SUBSCRIPTION_TIERS,
  CUSTOM_TIER_CONFIG,
  getTierById,
  validateCustomAmount,
  calculateTokensForAmount
} from '../utils/subscriptionTiers';
import { getStripePublishableKey } from '../utils/stripeConfig';
// import { getAnalyticsService } from '../utils/analytics-service';

// Types
export interface SubscriptionData {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: 'active' | 'cancelled' | 'past_due' | 'pending';
  tier: string;
  amount: number;
  tokens: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: any;
  updatedAt: any;
}

export interface CheckoutSessionParams {
  userId: string;
  tier: string;
  customAmount?: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResponse {
  sessionId?: string;
  url?: string;
  error?: string;
}

export class SubscriptionService {
  private static stripePromise: Promise<any> | null = null;

  /**
   * Initialize Stripe
   */
  private static getStripe() {
    if (!this.stripePromise) {
      const publishableKey = getStripePublishableKey();
      if (!publishableKey) {
        console.error('Stripe publishable key not found');
        return Promise.resolve(null);
      }
      this.stripePromise = loadStripe(publishableKey);
    }
    return this.stripePromise;
  }

  /**
   * Create embedded checkout URL for subscription
   * @deprecated Use embedded checkout flow instead of hosted checkout
   */
  static createEmbeddedCheckoutUrl(params: {
    tier: string;
    customAmount?: number;
    returnUrl?: string;
  }): string {
    const { tier, customAmount, returnUrl } = params;
    const url = new URL('/settings/subscription/checkout', window.location.origin);
    url.searchParams.set('tier', tier);

    if (customAmount) {
      url.searchParams.set('amount', customAmount.toString());
    }

    if (returnUrl) {
      url.searchParams.set('return_to', returnUrl);
    }

    return url.toString();
  }

  /**
   * Redirect to Stripe Checkout
   */
  static async redirectToCheckout(sessionId: string): Promise<{ error?: string }> {
    try {
      const stripe = await this.getStripe();
      if (!stripe) {
        return { error: 'Stripe failed to load' };
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        console.error('Stripe redirect error:', error);
        return { error: error.message };
      }

      return {};
    } catch (error) {
      console.error('Error redirecting to checkout:', error);
      return { error: 'Failed to redirect to checkout' };
    }
  }

  /**
   * Get user's current subscription
   */
  static async getUserSubscription(userId: string): Promise<SubscriptionData | null> {
    try {
      const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
      const subscriptionDoc = await getDoc(subscriptionRef);
      
      if (!subscriptionDoc.exists()) {
        return null;
      }
      
      return subscriptionDoc.data() as SubscriptionData;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription after successful payment
   */
  static async updateSubscriptionFromWebhook(
    userId: string,
    stripeSubscription: any
  ): Promise<void> {
    try {
      const price = stripeSubscription.items.data[0].price;
      const amount = price.unit_amount / 100; // Convert from cents
      const tokens = calculateTokensForAmount(amount);
      
      // Determine tier
      let tier = 'custom';
      const matchingTier = SUBSCRIPTION_TIERS.find(t => t.amount === amount);
      if (matchingTier) {
        tier = matchingTier.id;
      }

      const subscriptionData: Partial<SubscriptionData> = {
        userId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: price.id,
        status: stripeSubscription.status,
        tier,
        amount,
        tokens,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        updatedAt: serverTimestamp()
      };

      const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
      await updateDoc(subscriptionRef, subscriptionData);

      console.log(`Subscription updated for user ${userId}: ${tier} - $${amount}/mo - ${tokens} tokens`);

    } catch (error) {
      console.error('Error updating subscription from webhook:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        return { success: false, error: 'No active subscription found' };
      }

      // Get authentication token
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const token = await user.getIdToken();

      // Cancel via API
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`},
        body: JSON.stringify({
          userId,
          subscriptionId: subscription.stripeSubscriptionId
        })});

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to cancel subscription' };
      }

      // Update local subscription status
      const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
      await updateDoc(subscriptionRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });

      // Track analytics
      // if (typeof window !== 'undefined') {
      //   const analytics = getAnalyticsService();
      //   analytics.trackSubscriptionCancelled(subscription.tier, subscription.amount);
      // }

      return { success: true };

    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return { success: false, error: 'Failed to cancel subscription' };
    }
  }

  /**
   * Reactivate subscription (remove cancellation)
   */
  static async reactivateSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        return { success: false, error: 'No subscription found' };
      }

      if (!subscription.cancelAtPeriodEnd) {
        return { success: false, error: 'Subscription is not set to cancel' };
      }

      // Get authentication token
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const token = await user.getIdToken();

      // Reactivate via API
      const response = await fetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`},
        body: JSON.stringify({
          userId,
          subscriptionId: subscription.stripeSubscriptionId
        })});

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to reactivate subscription' };
      }

      const result = await response.json();
      return { success: true };

    } catch (error) {
      console.error('Error reactivating subscription:', error);
      return { success: false, error: 'Failed to reactivate subscription' };
    }
  }

  /**
   * Force synchronization of subscription status with Stripe
   */
  static async forceSyncSubscription(userId: string): Promise<{
    success: boolean;
    error?: string;
    statusChanged?: boolean;
    previousStatus?: string;
    currentStatus?: string;
    needsWait?: boolean;
  }> {
    try {
      // Get authentication token
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const token = await user.getIdToken();

      // Call sync API
      const response = await fetch('/api/subscription/force-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to sync subscription status' };
      }

      return {
        success: true,
        statusChanged: data.statusChanged,
        previousStatus: data.previousStatus,
        currentStatus: data.currentStatus,
        needsWait: data.needsWait
      };

    } catch (error) {
      console.error('Error forcing subscription sync:', error);
      return { success: false, error: 'Failed to sync subscription status' };
    }
  }

  /**
   * Add amount to existing subscription (bypasses tier validation)
   */
  static async addToSubscription(
    userId: string,
    additionalAmount: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentSubscription = await this.getUserSubscription(userId);
      if (!currentSubscription) {
        return { success: false, error: 'No active subscription found' };
      }

      const newAmount = currentSubscription.amount + additionalAmount;

      // Simple validation for amount increases
      if (newAmount <= 0) {
        return { success: false, error: 'Amount must be greater than $0' };
      }

      if (newAmount > CUSTOM_TIER_CONFIG.maxAmount) {
        return { success: false, error: `Amount cannot exceed $${CUSTOM_TIER_CONFIG.maxAmount}` };
      }

      // Get authentication token
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const token = await user.getIdToken();

      // Update via API with the new total amount (not tier-based)
      const response = await fetch('/api/subscription/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`},
        body: JSON.stringify({
          userId,
          subscriptionId: currentSubscription.stripeSubscriptionId,
          newTier: 'custom', // Always custom for amount-based updates
          newAmount: newAmount,
          skipValidation: true // Flag to skip minimum validation
        })});

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to update subscription' };
      }

      // The server already handles token allocation updates, so we don't need to do it here
      const result = await response.json();
      return {
        success: true,
        data: result.subscription // Include subscription data for success modal
      };

    } catch (error) {
      console.error('Error adding to subscription:', error);
      return { success: false, error: 'Failed to update subscription' };
    }
  }

  /**
   * Update subscription tier/amount (always updates existing subscription, never creates multiple)
   * This ensures one subscription per user by modifying the existing Stripe subscription
   */
  static async updateSubscription(
    userId: string,
    newTier: string,
    customAmount?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentSubscription = await this.getUserSubscription(userId);
      if (!currentSubscription) {
        return { success: false, error: 'No active subscription found' };
      }

      // Validate new tier and amount
      let amount: number;
      if (newTier === 'custom') {
        if (!customAmount) {
          return { success: false, error: 'Custom amount is required' };
        }
        
        // For updates, skip minimum validation to allow adding small amounts like $10
        if (customAmount <= 0) {
          return { success: false, error: 'Amount must be greater than $0' };
        }

        if (customAmount > CUSTOM_TIER_CONFIG.maxAmount) {
          return { success: false, error: `Amount cannot exceed $${CUSTOM_TIER_CONFIG.maxAmount}` };
        }
        
        amount = customAmount;
      } else {
        const tierData = getTierById(newTier);
        if (!tierData) {
          return { success: false, error: 'Invalid tier selected' };
        }
        amount = tierData.amount;
      }

      // Get authentication token
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const token = await user.getIdToken();

      // Update via API
      const response = await fetch('/api/subscription/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`},
        body: JSON.stringify({
          userId,
          subscriptionId: currentSubscription.stripeSubscriptionId,
          newTier,
          newAmount: amount
        })});

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to update subscription' };
      }

      // Track analytics
      // if (typeof window !== 'undefined') {
      //   const analytics = getAnalyticsService();
      //   analytics.trackFeatureEvent('subscription_updated', {
      //     previous_tier: currentSubscription.tier,
      //     new_tier: newTier,
      //     previous_amount: currentSubscription.amount,
      //     new_amount: amount
      //   });
      // }

      return { success: true };

    } catch (error) {
      console.error('Error updating subscription:', error);
      return { success: false, error: 'Failed to update subscription' };
    }
  }

  /**
   * Force sync subscription status from Stripe
   */
  static async syncSubscriptionStatus(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get authentication token
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const token = await user.getIdToken();

      const response = await fetch('/api/subscription/sync-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ userId })});

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to sync subscription status' };
      }

      const result = await response.json();
      return { success: true };

    } catch (error) {
      console.error('Error syncing subscription status:', error);
      return { success: false, error: 'Failed to sync subscription status' };
    }
  }

  /**
   * Create customer portal session
   */
  static async createPortalSession(userId: string): Promise<{ url?: string; error?: string }> {
    try {
      // Get authentication token
      const user = auth.currentUser;
      if (!user) {
        return { error: 'User not authenticated' };
      }

      const token = await user.getIdToken();

      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ userId })});

      if (!response.ok) {
        const errorData = await response.json();
        return { error: errorData.error || 'Failed to create portal session' };
      }

      const sessionData = await response.json();
      return { url: sessionData.url };

    } catch (error) {
      console.error('Error creating portal session:', error);
      return { error: 'Failed to create portal session' };
    }
  }

  /**
   * Get available subscription tiers
   */
  static getAvailableTiers() {
    return SUBSCRIPTION_TIERS;
  }

  /**
   * Get custom tier configuration
   */
  static getCustomTierConfig() {
    return CUSTOM_TIER_CONFIG;
  }
}