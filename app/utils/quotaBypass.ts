/**
 * 🚨 EMERGENCY QUOTA BYPASS SYSTEM
 * 
 * Temporary system to immediately stop database read spike
 * by returning cached/mock data when quota is exceeded
 */

interface QuotaStatus {
  dailyReads: number;
  quotaLimit: number;
  isOverQuota: boolean;
  bypassActive: boolean;
}

class QuotaBypassManager {
  private quotaStatus: QuotaStatus = {
    dailyReads: 0,
    quotaLimit: 50000, // Firebase free tier daily quota
    isOverQuota: false,
    bypassActive: false
  };

  private mockData = {
    recentEdits: {
      edits: [],
      hasMore: false,
      nextCursor: null,
      message: 'Firebase quota exceeded - using fallback data'
    },
    homeData: {
      recentlyVisitedPages: [],
      trendingPages: [],
      userStats: null,
      message: 'Firebase quota exceeded - using fallback data'
    },
    userProfile: {
      uid: 'quota-bypass',
      email: 'quota@bypass.com',
      username: 'quota-bypass',
      message: 'Firebase quota exceeded - using fallback data'
    },
    subscription: {
      hasSubscription: false,
      status: 'inactive',
      message: 'Firebase quota exceeded - using fallback data'
    },
    earnings: {
      totalEarnings: 0,
      availableBalance: 0,
      pendingBalance: 0,
      hasEarnings: false,
      message: 'Firebase quota exceeded - using fallback data'
    }
  };

  /**
   * Check if quota bypass should be active
   */
  shouldBypassQuota(): boolean {
    // 🚨 NEVER RETURN MOCK DATA - ALWAYS USE REAL DATA
    return false;
  }

  /**
   * Get mock data for a specific endpoint
   */
  getMockData(endpoint: string): any {
    console.warn(`🚧 QUOTA BYPASS: Returning mock data for ${endpoint}`);

    if (endpoint.includes('recent-edits')) {
      return this.mockData.recentEdits;
    }
    
    if (endpoint.includes('home')) {
      return this.mockData.homeData;
    }
    
    if (endpoint.includes('subscription')) {
      return this.mockData.subscription;
    }
    
    if (endpoint.includes('earnings')) {
      return this.mockData.earnings;
    }
    
    if (endpoint.includes('user') || endpoint.includes('profile')) {
      return this.mockData.userProfile;
    }

    // Generic fallback
    return {
      data: null,
      message: 'Firebase quota exceeded - service temporarily unavailable',
      quotaBypass: true
    };
  }

  /**
   * Update quota usage
   */
  recordRead(count: number = 1) {
    this.quotaStatus.dailyReads += count;
    
    // Log warnings at key thresholds
    const percentUsed = (this.quotaStatus.dailyReads / this.quotaStatus.quotaLimit) * 100;
    
    if (percentUsed > 90 && percentUsed <= 100) {
      console.warn(`🚨 QUOTA WARNING: ${percentUsed.toFixed(1)}% of daily quota used (${this.quotaStatus.dailyReads}/${this.quotaStatus.quotaLimit})`);
    } else if (percentUsed > 100) {
      console.error(`🚨 QUOTA EXCEEDED: ${percentUsed.toFixed(1)}% of daily quota used (${this.quotaStatus.dailyReads}/${this.quotaStatus.quotaLimit})`);
      this.quotaStatus.isOverQuota = true;
    }
  }

  /**
   * Get current quota status
   */
  getQuotaStatus(): QuotaStatus {
    return { ...this.quotaStatus };
  }

  /**
   * Reset quota (for testing or daily reset)
   */
  resetQuota() {
    this.quotaStatus.dailyReads = 0;
    this.quotaStatus.isOverQuota = false;
    this.quotaStatus.bypassActive = false;
    console.log('🔄 Quota reset');
  }

  /**
   * Force enable bypass (emergency use)
   */
  forceEnableBypass() {
    this.quotaStatus.bypassActive = true;
    console.log('🚨 EMERGENCY: Quota bypass force enabled');
  }

  /**
   * Disable bypass
   */
  disableBypass() {
    this.quotaStatus.bypassActive = false;
    console.log('✅ Quota bypass disabled');
  }
}

// Singleton instance
export const quotaBypassManager = new QuotaBypassManager();

/**
 * Wrapper for API calls that respects quota limits
 */
export async function quotaAwareFetch(url: string, options?: RequestInit): Promise<Response> {
  const endpoint = new URL(url, window.location.origin).pathname;
  
  // Check if we should bypass
  if (quotaBypassManager.shouldBypassQuota()) {
    const mockData = quotaBypassManager.getMockData(endpoint);
    
    // Return a mock Response object
    return new Response(JSON.stringify(mockData), {
      status: 200,
      statusText: 'OK (Quota Bypass)',
      headers: {
        'Content-Type': 'application/json',
        'X-Quota-Bypass': 'true'
      }
    });
  }

  // Normal fetch
  try {
    const response = await fetch(url, options);
    
    // Record successful read
    quotaBypassManager.recordRead(1);
    
    return response;
  } catch (error) {
    // On error, still record the attempted read
    quotaBypassManager.recordRead(1);
    throw error;
  }
}

/**
 * Check if quota bypass is active
 */
export const isQuotaBypassActive = () => quotaBypassManager.shouldBypassQuota();

/**
 * Get quota status for monitoring
 */
export const getQuotaStatus = () => quotaBypassManager.getQuotaStatus();

/**
 * Emergency functions
 */
export const forceEnableQuotaBypass = () => quotaBypassManager.forceEnableBypass();
export const disableQuotaBypass = () => quotaBypassManager.disableBypass();
export const resetQuota = () => quotaBypassManager.resetQuota();

/**
 * Middleware for Next.js API routes
 */
export function withQuotaBypass(handler: any) {
  return async (req: any, res: any) => {
    if (quotaBypassManager.shouldBypassQuota()) {
      const mockData = quotaBypassManager.getMockData(req.url);
      return res.status(200).json(mockData);
    }
    
    return handler(req, res);
  };
}
