/**
 * Integrated service that combines real pledge functionality with existing systems
 * This service provides a unified interface for all pledge operations
 */

import { realPledgeService } from './realPledgeService';
import { createPledge, updatePledge, deletePledge, getUserSubscription } from '../firebase/subscription';
import { Pledge, PaymentTransaction, UserEarnings } from '../types/database';

export class IntegratedPledgeService {
  
  /**
   * Create a new pledge with real payment processing
   */
  async createRealPledge(
    userId: string,
    resourceType: 'page' | 'group',
    resourceId: string,
    amount: number,
    paymentMethodId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch('/api/pledges/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [resourceType === 'page' ? 'pageId' : 'groupId']: resourceId,
          amount,
          paymentMethodId
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data };
    } catch (error) {
      console.error('Error creating real pledge:', error);
      return { success: false, error: 'Failed to create pledge' };
    }
  }

  /**
   * Activate a pledge after successful payment setup
   */
  async activatePledge(
    pledgeId: string,
    subscriptionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/pledges/create', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pledgeId, subscriptionId })
      });

      const result = await response.json();
      
      if (!response.ok) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error) {
      console.error('Error activating pledge:', error);
      return { success: false, error: 'Failed to activate pledge' };
    }
  }

  /**
   * Get comprehensive pledge data for a user
   */
  async getUserPledgeData(userId: string): Promise<{
    realPledges: Pledge[];
    legacyPledges: any[];
    totalPledged: number;
    activePledgeCount: number;
    earnings?: UserEarnings;
  }> {
    try {
      // Get real pledges
      const realPledges = await realPledgeService.getUserPledges(userId);
      
      // Get legacy pledges for backward compatibility
      const legacyPledges = []; // Could fetch from old system if needed
      
      // Get user earnings if they're a creator
      const earnings = await realPledgeService.getUserEarnings(userId);
      
      // Calculate totals
      const totalPledged = realPledges.reduce((sum, pledge) => sum + pledge.amount, 0);
      const activePledgeCount = realPledges.filter(p => p.status === 'active').length;

      return {
        realPledges,
        legacyPledges,
        totalPledged,
        activePledgeCount,
        earnings
      };
    } catch (error) {
      console.error('Error getting user pledge data:', error);
      return {
        realPledges: [],
        legacyPledges: [],
        totalPledged: 0,
        activePledgeCount: 0
      };
    }
  }

  /**
   * Get comprehensive resource statistics
   */
  async getResourceStats(
    resourceType: 'page' | 'group',
    resourceId: string
  ): Promise<{
    supporterCount: number;
    totalAmount: number;
    averageAmount: number;
    activePledges: Pledge[];
    recentTransactions: PaymentTransaction[];
  }> {
    try {
      // Get real supporter stats
      const stats = await realPledgeService.getSupporterStats(resourceType, resourceId);
      
      // Get active pledges
      const activePledges = await realPledgeService.getResourcePledges(resourceType, resourceId);
      
      // Get recent transactions (this would need to be implemented in realPledgeService)
      const recentTransactions: PaymentTransaction[] = [];

      return {
        supporterCount: stats.count,
        totalAmount: stats.totalAmount,
        averageAmount: stats.averageAmount,
        activePledges,
        recentTransactions
      };
    } catch (error) {
      console.error('Error getting resource stats:', error);
      return {
        supporterCount: 0,
        totalAmount: 0,
        averageAmount: 0,
        activePledges: [],
        recentTransactions: []
      };
    }
  }

  /**
   * Cancel a pledge (works with both real and legacy pledges)
   */
  async cancelPledge(
    pledgeId: string,
    userId: string,
    isRealPledge: boolean = true
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (isRealPledge) {
        const success = await realPledgeService.cancelPledge(pledgeId, userId);
        return { success };
      } else {
        // Handle legacy pledge cancellation
        // This would involve the old system
        return { success: false, error: 'Legacy pledge cancellation not implemented' };
      }
    } catch (error) {
      console.error('Error cancelling pledge:', error);
      return { success: false, error: 'Failed to cancel pledge' };
    }
  }

  /**
   * Get user's available funds for pledging
   */
  async getAvailableFunds(userId: string): Promise<number> {
    try {
      // Get user subscription
      const subscription = await getUserSubscription(userId);
      
      if (!subscription || subscription.status !== 'active') {
        return 0;
      }

      // Get user's current pledges
      const pledgeData = await this.getUserPledgeData(userId);
      
      // Calculate available funds
      const totalSubscription = subscription.amount || 0;
      const totalPledged = pledgeData.totalPledged;
      
      return Math.max(0, totalSubscription - totalPledged);
    } catch (error) {
      console.error('Error getting available funds:', error);
      return 0;
    }
  }

  /**
   * Subscribe to real-time supporter statistics
   */
  subscribeSupporterStats(
    resourceType: 'page' | 'group',
    resourceId: string,
    callback: (stats: { count: number; totalAmount: number }) => void
  ) {
    return realPledgeService.subscribeSupporterStats(resourceType, resourceId, callback);
  }

  /**
   * Get monthly earnings breakdown for a creator
   */
  async getMonthlyEarnings(userId: string, period?: string) {
    return realPledgeService.getMonthlyEarnings(userId, period);
  }

  /**
   * Get user's transaction history
   */
  async getUserTransactions(userId: string, asRecipient: boolean = false) {
    return realPledgeService.getUserTransactions(userId, asRecipient);
  }

  /**
   * Check if user can pledge to a resource
   */
  async canUserPledge(
    userId: string,
    resourceType: 'page' | 'group',
    resourceId: string,
    amount: number
  ): Promise<{ canPledge: boolean; reason?: string }> {
    try {
      // Check if user has sufficient funds
      const availableFunds = await this.getAvailableFunds(userId);
      
      if (amount > availableFunds) {
        return { 
          canPledge: false, 
          reason: `Insufficient funds. Available: $${availableFunds.toFixed(2)}` 
        };
      }

      // Check if user already has a pledge for this resource
      const existingPledge = await realPledgeService.getUserPledgeToResource(
        userId, 
        resourceType, 
        resourceId
      );

      if (existingPledge && existingPledge.status === 'active') {
        return { 
          canPledge: false, 
          reason: 'You already have an active pledge for this content' 
        };
      }

      return { canPledge: true };
    } catch (error) {
      console.error('Error checking if user can pledge:', error);
      return { canPledge: false, reason: 'Unable to verify pledge eligibility' };
    }
  }

  /**
   * Get pledge statistics for API endpoints
   */
  async getPledgeStats(
    pageId?: string,
    groupId?: string,
    userId?: string
  ): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (pageId) params.append('pageId', pageId);
      if (groupId) params.append('groupId', groupId);
      if (userId) params.append('userId', userId);

      const response = await fetch(`/api/pledges/stats?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch pledge stats');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error getting pledge stats:', error);
      return null;
    }
  }

  /**
   * Process a real payment for a pledge
   */
  async processPayment(
    pageId: string | null,
    groupId: string | null,
    amount: number,
    paymentMethodId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch('/api/pledges/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          groupId,
          amount,
          paymentMethodId
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data };
    } catch (error) {
      console.error('Error processing payment:', error);
      return { success: false, error: 'Failed to process payment' };
    }
  }
}

// Export singleton instance
export const integratedPledgeService = new IntegratedPledgeService();
