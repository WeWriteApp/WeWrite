/**
 * USD Data Service
 * 
 * Centralized service for fetching USD-related data from APIs.
 * Separates data fetching logic from React contexts for better maintainability.
 */

export interface UsdBalance {
  totalUsdCents: number;
  allocatedUsdCents: number;
  availableUsdCents: number;
}

export interface SubscriptionData {
  id?: string;
  status: string;
  amount: number;
  currency?: string;
  interval?: string;
  customerId?: string;
  subscriptionId?: string;
  priceId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  createdAt?: any;
  updatedAt?: any;
  tier?: string | null;
  stripeSubscriptionId?: string | null;
  canceledAt?: string;
}

export interface EarningsData {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  hasEarnings: boolean;
  lastMonthEarnings?: number;
  monthlyChange?: number;
  pendingAllocations?: any[]; // Earnings sources data for the breakdown component
}

export interface UsdDataFetchResult {
  balance: UsdBalance | null;
  subscription: SubscriptionData | null;
  earnings: EarningsData | null;
  hasActiveSubscription: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
  status: number;
}

/**
 * USD Data Service - handles all USD-related API calls
 */
export class UsdDataService {
  /**
   * Fetch USD balance from API
   */
  static async fetchBalance(): Promise<ApiResponse<UsdBalance>> {
    try {
      const response = await fetch('/api/usd/balance', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: `Balance API error: ${response.status}`,
          status: response.status
        };
      }

      const data = await response.json();
      
      if (!data.balance) {
        return {
          success: false,
          data: null,
          error: 'No balance data in response',
          status: response.status
        };
      }

      const balance: UsdBalance = {
        totalUsdCents: data.balance.totalUsdCents || 0,
        allocatedUsdCents: data.balance.allocatedUsdCents || 0,
        availableUsdCents: data.balance.availableUsdCents || 0,
      };

      return {
        success: true,
        data: balance,
        status: response.status
      };
    } catch (error) {
      console.error('[UsdDataService] Balance fetch error:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 0
      };
    }
  }

  /**
   * Fetch subscription data from API
   */
  static async fetchSubscription(): Promise<ApiResponse<SubscriptionData>> {
    try {
      const response = await fetch('/api/account-subscription', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: `Subscription API error: ${response.status}`,
          status: response.status
        };
      }

      const data = await response.json();
      
      if (!data.hasSubscription || !data.fullData) {
        return {
          success: true,
          data: null,
          status: response.status
        };
      }

      return {
        success: true,
        data: data.fullData,
        status: response.status
      };
    } catch (error) {
      console.error('[UsdDataService] Subscription fetch error:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 0
      };
    }
  }

  /**
   * Fetch earnings data from API
   */
  static async fetchEarnings(): Promise<ApiResponse<EarningsData>> {
    try {
      const response = await fetch('/api/earnings/user', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: `Earnings API error: ${response.status}`,
          status: response.status
        };
      }

      const data = await response.json();
      
      if (!data.success || !data.earnings) {
        return {
          success: true,
          data: null,
          status: response.status
        };
      }

      const earnings: EarningsData = {
        totalEarnings: data.earnings.totalEarnings || 0,
        availableBalance: data.earnings.availableBalance || 0,
        pendingBalance: data.earnings.pendingBalance || 0,
        hasEarnings: data.earnings.hasEarnings || false,
        lastMonthEarnings: 0, // TODO: Calculate from history if needed
        monthlyChange: 0, // TODO: Calculate from history if needed
        pendingAllocations: data.earnings.pendingAllocations || [] // Pass through earnings sources data
      };

      return {
        success: true,
        data: earnings,
        status: response.status
      };
    } catch (error) {
      console.error('[UsdDataService] Earnings fetch error:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 0
      };
    }
  }

  /**
   * Fetch all USD data in parallel
   */
  static async fetchAllData(): Promise<UsdDataFetchResult> {
    const [balanceResult, subscriptionResult, earningsResult] = await Promise.all([
      this.fetchBalance(),
      this.fetchSubscription(),
      this.fetchEarnings()
    ]);

    // Determine if user has active subscription
    const hasActiveSubscription = subscriptionResult.success && 
      subscriptionResult.data?.status === 'active' && 
      (subscriptionResult.data?.amount || 0) > 0;

    return {
      balance: balanceResult.success ? balanceResult.data : null,
      subscription: subscriptionResult.success ? subscriptionResult.data : null,
      earnings: earningsResult.success ? earningsResult.data : null,
      hasActiveSubscription
    };
  }

  /**
   * Check if user is authenticated based on API response
   */
  static isAuthenticationError(status: number): boolean {
    return status === 401;
  }
}
