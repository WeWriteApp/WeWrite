import { auth } from '../firebase/config';
import { calculateTokensForAmount } from '../utils/subscriptionTiers';

/**
 * EmbeddedCheckoutService - Integration layer for embedded checkout flows
 * 
 * This service handles the integration between the new embedded checkout
 * system and the existing token allocation and subscription management.
 */
export class EmbeddedCheckoutService {
  
  /**
   * Initialize subscription checkout with token allocation preview
   */
  static async initializeCheckout(params: {
    tier: string;
    amount?: number;
    returnUrl?: string;
  }) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { tier, amount, returnUrl } = params;
    
    // Calculate token allocation for preview
    const finalAmount = amount || this.getAmountForTier(tier);
    const tokens = calculateTokensForAmount(finalAmount);
    
    // Get current token allocations to show impact
    const currentAllocations = await this.getCurrentTokenAllocations(user.uid);
    
    return {
      subscription: {
        tier,
        amount: finalAmount,
        tokens,
        tierName: this.getTierName(tier, finalAmount)
      },
      currentAllocations,
      tokenImpact: {
        newMonthlyTokens: tokens,
        currentAllocatedTokens: currentAllocations.totalAllocated,
        availableAfterSubscription: tokens
      },
      checkoutUrl: this.buildCheckoutUrl(tier, amount, returnUrl)
    };
  }

  /**
   * Handle successful subscription completion
   */
  static async handleSubscriptionSuccess(subscriptionId: string, userId: string) {
    try {
      // 1. Refresh user subscription data
      await this.refreshUserSubscription(userId);
      
      // 2. Initialize token balance for new subscription
      await this.initializeTokenBalance(userId, subscriptionId);
      
      // 3. Migrate any unfunded token allocations to funded
      await this.migrateUnfundedAllocations(userId);
      
      // 4. Send welcome notification
      await this.sendSubscriptionWelcome(userId, subscriptionId);
      
      return { success: true };
    } catch (error) {
      console.error('Error handling subscription success:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get current token allocations for user
   */
  private static async getCurrentTokenAllocations(userId: string) {
    try {
      const response = await fetch('/api/tokens/user-allocations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch token allocations');
      }

      const data = await response.json();
      return {
        allocations: data.allocations || [],
        totalAllocated: data.summary?.totalTokensAllocated || 0,
        availableTokens: data.summary?.balance?.availableTokens || 0
      };
    } catch (error) {
      console.error('Error fetching token allocations:', error);
      return { allocations: [], totalAllocated: 0, availableTokens: 0 };
    }
  }

  /**
   * Refresh user subscription data using simple API
   */
  private static async refreshUserSubscription(userId: string) {
    try {
      const response = await fetch('/api/subscription/simple', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[EMBEDDED CHECKOUT] Sync failed with status ${response.status}:`, errorText);
        throw new Error(`Failed to get subscription data: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`[EMBEDDED CHECKOUT] Error during subscription refresh:`, error);
      throw error;
    }
  }

  /**
   * Initialize token balance for new subscription
   */
  private static async initializeTokenBalance(userId: string, subscriptionId: string) {
    const response = await fetch('/api/tokens/initialize-balance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      body: JSON.stringify({ userId, subscriptionId })
    });

    if (!response.ok) {
      throw new Error('Failed to initialize token balance');
    }

    return response.json();
  }

  /**
   * Migrate unfunded token allocations to funded status
   */
  private static async migrateUnfundedAllocations(userId: string) {
    const response = await fetch('/api/tokens/migrate-unfunded', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      console.warn('Failed to migrate unfunded allocations - this is not critical');
      return { success: false };
    }

    return response.json();
  }

  /**
   * Send subscription welcome notification
   */
  private static async sendSubscriptionWelcome(userId: string, subscriptionId: string) {
    try {
      const response = await fetch('/api/notifications/subscription-welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({ userId, subscriptionId })
      });

      // This is not critical, so don't throw on failure
      if (!response.ok) {
        console.warn('Failed to send welcome notification');
      }
    } catch (error) {
      console.warn('Error sending welcome notification:', error);
    }
  }

  /**
   * Build checkout URL with parameters
   */
  private static buildCheckoutUrl(tier: string, amount?: number, returnUrl?: string): string {
    const url = new URL('/settings/subscription/checkout', window.location.origin);
    url.searchParams.set('tier', tier);
    
    if (amount) {
      url.searchParams.set('amount', amount.toString());
    }
    
    if (returnUrl) {
      url.searchParams.set('return_to', returnUrl);
    }
    
    return url.toString();
  }

  /**
   * Get amount for standard tier
   */
  private static getAmountForTier(tier: string): number {
    const tierAmounts: Record<string, number> = {
      'tier1': 10,
      'tier2': 20,
      'tier3': 30 // Champion tier minimum
    };

    return tierAmounts[tier] || 30; // Default for custom
  }

  /**
   * Get tier name for display
   */
  private static getTierName(tier: string, amount: number): string {
    const tierNames: Record<string, string> = {
      'tier1': '$10/month',
      'tier2': '$20/month',
      'tier3': `$${amount}/month`
    };

    return tierNames[tier] || `$${amount}/month`;
  }

  /**
   * Check if user has pending unfunded allocations
   */
  static async hasPendingUnfundedAllocations(userId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/tokens/unfunded-check?userId=${userId}`, {
        headers: {
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.hasUnfundedAllocations || false;
    } catch (error) {
      console.error('Error checking unfunded allocations:', error);
      return false;
    }
  }

  /**
   * Get subscription upgrade/downgrade preview
   */
  static async getSubscriptionChangePreview(currentTier: string, newTier: string, newAmount?: number) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const currentAmount = this.getAmountForTier(currentTier);
    const finalNewAmount = newAmount || this.getAmountForTier(newTier);
    
    const currentTokens = calculateTokensForAmount(currentAmount);
    const newTokens = calculateTokensForAmount(finalNewAmount);
    
    return {
      current: {
        tier: currentTier,
        amount: currentAmount,
        tokens: currentTokens,
        tierName: this.getTierName(currentTier, currentAmount)
      },
      new: {
        tier: newTier,
        amount: finalNewAmount,
        tokens: newTokens,
        tierName: this.getTierName(newTier, finalNewAmount)
      },
      changes: {
        amountDifference: finalNewAmount - currentAmount,
        tokenDifference: newTokens - currentTokens,
        isUpgrade: finalNewAmount > currentAmount,
        isDowngrade: finalNewAmount < currentAmount
      }
    };
  }
}
