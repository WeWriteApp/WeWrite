/**
 * Subscription Analytics Service
 * Tracks subscription conversion funnel events for admin dashboard analytics
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getCollectionName } from '../utils/environmentConfig';

export interface SubscriptionAnalyticsEvent {
  category: 'subscription';
  action: 'subscription_flow_started' | 'subscription_abandoned_before_payment' | 'subscription_abandoned_during_payment' | 'subscription_completed' | 'first_token_allocation' | 'ongoing_token_allocation';
  userId?: string;
  sessionId?: string;
  tier?: string;
  amount?: number;
  tokens?: number;
  pageId?: string;
  metadata?: Record<string, any>;
}

export class SubscriptionAnalyticsService {
  
  /**
   * Track subscription flow started
   */
  static async trackSubscriptionFlowStarted(
    userId: string,
    tier: string,
    amount: number,
    tokens: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.trackEvent({
        category: 'subscription',
        action: 'subscription_flow_started',
        userId,
        tier,
        amount,
        tokens,
        metadata: {
          source: 'subscription_page',
          ...metadata
        }
      });
      
      console.log('📊 Tracked subscription flow started:', { userId, tier, amount, tokens });
    } catch (error) {
      console.error('❌ Failed to track subscription flow started:', error);
    }
  }

  /**
   * Track subscription abandoned before payment
   */
  static async trackSubscriptionAbandonedBeforePayment(
    userId: string,
    tier: string,
    amount: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.trackEvent({
        category: 'subscription',
        action: 'subscription_abandoned_before_payment',
        userId,
        tier,
        amount,
        metadata: {
          abandonment_stage: 'before_stripe',
          ...metadata
        }
      });
      
      console.log('📊 Tracked subscription abandoned before payment:', { userId, tier, amount });
    } catch (error) {
      console.error('❌ Failed to track subscription abandoned before payment:', error);
    }
  }

  /**
   * Track subscription abandoned during payment
   */
  static async trackSubscriptionAbandonedDuringPayment(
    userId: string,
    tier: string,
    amount: number,
    errorCode?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.trackEvent({
        category: 'subscription',
        action: 'subscription_abandoned_during_payment',
        userId,
        tier,
        amount,
        metadata: {
          abandonment_stage: 'during_stripe',
          error_code: errorCode,
          ...metadata
        }
      });
      
      console.log('📊 Tracked subscription abandoned during payment:', { userId, tier, amount, errorCode });
    } catch (error) {
      console.error('❌ Failed to track subscription abandoned during payment:', error);
    }
  }

  /**
   * Track subscription completed
   */
  static async trackSubscriptionCompleted(
    userId: string,
    subscriptionId: string,
    tier: string,
    amount: number,
    tokens: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.trackEvent({
        category: 'subscription',
        action: 'subscription_completed',
        userId,
        tier,
        amount,
        tokens,
        metadata: {
          subscription_id: subscriptionId,
          payment_method: 'stripe',
          ...metadata
        }
      });
      
      console.log('📊 Tracked subscription completed:', { userId, subscriptionId, tier, amount, tokens });
    } catch (error) {
      console.error('❌ Failed to track subscription completed:', error);
    }
  }

  /**
   * Track first token allocation
   */
  static async trackFirstTokenAllocation(
    userId: string,
    pageId: string,
    tokens: number,
    recipientUserId: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.trackEvent({
        category: 'subscription',
        action: 'first_token_allocation',
        userId,
        pageId,
        tokens,
        metadata: {
          recipient_user_id: recipientUserId,
          allocation_type: 'first',
          ...metadata
        }
      });
      
      console.log('📊 Tracked first token allocation:', { userId, pageId, tokens, recipientUserId });
    } catch (error) {
      console.error('❌ Failed to track first token allocation:', error);
    }
  }

  /**
   * Track ongoing token allocation
   */
  static async trackOngoingTokenAllocation(
    userId: string,
    pageId: string,
    tokens: number,
    recipientUserId: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.trackEvent({
        category: 'subscription',
        action: 'ongoing_token_allocation',
        userId,
        pageId,
        tokens,
        metadata: {
          recipient_user_id: recipientUserId,
          allocation_type: 'ongoing',
          ...metadata
        }
      });
      
      console.log('📊 Tracked ongoing token allocation:', { userId, pageId, tokens, recipientUserId });
    } catch (error) {
      console.error('❌ Failed to track ongoing token allocation:', error);
    }
  }

  /**
   * Private method to track analytics events
   */
  private static async trackEvent(event: SubscriptionAnalyticsEvent): Promise<void> {
    try {
      const analyticsRef = collection(db, getCollectionName('analytics_events'));
      
      await addDoc(analyticsRef, {
        ...event,
        timestamp: serverTimestamp(),
        eventType: 'subscription_funnel',
        source: 'web_app',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        url: typeof window !== 'undefined' ? window.location.href : null,
        createdAt: serverTimestamp()
      });
      
    } catch (error) {
      console.error('❌ Failed to track subscription analytics event:', error);
      throw error;
    }
  }

  /**
   * Utility method to determine if this is a user's first token allocation
   */
  static async isFirstTokenAllocation(userId: string): Promise<boolean> {
    try {
      // This would need to check if the user has any previous token allocations
      // For now, we'll implement a simple check based on the existence of token balance
      const response = await fetch(`/api/tokens/balance?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        return data.data?.allocatedTokens === 0;
      }
      return true; // Default to first allocation if we can't determine
    } catch (error) {
      console.warn('Could not determine if first token allocation:', error);
      return true; // Default to first allocation on error
    }
  }
}

// Export for use in other modules
export default SubscriptionAnalyticsService;
