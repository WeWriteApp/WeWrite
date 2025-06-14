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
import { getAuth } from 'firebase/auth';
import { db } from '../firebase/config';
import { TokenService } from './tokenService';
import { 
  SUBSCRIPTION_TIERS, 
  CUSTOM_TIER_CONFIG, 
  getTierById, 
  validateCustomAmount,
  calculateTokensForAmount 
} from '../utils/subscriptionTiers';
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
      this.stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
    }
    return this.stripePromise;
  }

  /**
   * Create a subscription checkout session
   */
  static async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse> {
    try {
      const { userId, tier, customAmount, successUrl, cancelUrl } = params;

      // Validate tier and amount
      let amount: number;
      let tierName: string;

      if (tier === 'custom') {
        if (!customAmount) {
          return { error: 'Custom amount is required for custom tier' };
        }
        
        const validation = validateCustomAmount(customAmount);
        if (!validation.valid) {
          return { error: validation.error };
        }
        
        amount = customAmount;
        tierName = `Custom ($${amount}/mo)`;
      } else {
        const tierData = getTierById(tier);
        if (!tierData) {
          return { error: 'Invalid tier selected' };
        }
        
        amount = tierData.amount;
        tierName = tierData.name;
      }

      // Calculate tokens
      const tokens = calculateTokensForAmount(amount);

      // Get authentication token
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        return { error: 'User not authenticated' };
      }

      const token = await user.getIdToken();

      // Create checkout session via API
      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          tier,
          amount,
          tierName,
          tokens,
          successUrl: successUrl || `${window.location.origin}/settings/subscription?success=true`,
          cancelUrl: cancelUrl || `${window.location.origin}/settings/subscription?cancelled=true`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { error: errorData.error || 'Failed to create checkout session' };
      }

      const sessionData = await response.json();
      
      // Track analytics
      // if (typeof window !== 'undefined') {
      //   const analytics = getAnalyticsService();
      //   analytics.trackSubscriptionInitiated(tier, amount, tokens);
      // }

      return {
        sessionId: sessionData.sessionId,
        url: sessionData.url
      };

    } catch (error) {
      console.error('Error creating checkout session:', error);
      return { error: 'Failed to create checkout session' };
    }
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

      // Update user's token allocation
      await TokenService.updateMonthlyTokenAllocation(userId, amount);

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
      const auth = getAuth();
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
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          subscriptionId: subscription.stripeSubscriptionId
        }),
      });

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
   * Update subscription tier/amount
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
        
        const validation = validateCustomAmount(customAmount);
        if (!validation.valid) {
          return { success: false, error: validation.error };
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
      const auth = getAuth();
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
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          subscriptionId: currentSubscription.stripeSubscriptionId,
          newTier,
          newAmount: amount
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to update subscription' };
      }

      // Update token allocation
      await TokenService.updateMonthlyTokenAllocation(userId, amount);

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
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const token = await user.getIdToken();

      const response = await fetch('/api/subscription/sync-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

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
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        return { error: 'User not authenticated' };
      }

      const token = await user.getIdToken();

      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

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
