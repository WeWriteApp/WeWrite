/**
 * API Client Utility
 * 
 * This utility provides functions to replace direct Firebase calls with API route calls.
 * It ensures all operations go through environment-aware API endpoints.
 */

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Consolidated API client with deduplication and caching
 * Replaces multiple overlapping utilities: apiDeduplication.ts, requestDeduplication.ts, unifiedApiClient.ts
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface PendingRequest<T = any> {
  promise: Promise<T>;
  timestamp: number;
}

class ConsolidatedApiClient {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DEDUP_WINDOW = 5000; // 5 seconds

  private generateKey(url: string, options: RequestInit = {}): string {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCached<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  async call<T = any>(
    endpoint: string,
    options: RequestInit & {
      params?: Record<string, string | number | boolean>;
      cacheTTL?: number;
      skipCache?: boolean;
      skipDedup?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { params, cacheTTL = this.DEFAULT_CACHE_TTL, skipCache = false, skipDedup = false, ...fetchOptions } = options;

    // Build URL with query parameters
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const key = this.generateKey(url, fetchOptions);

    // Check cache first
    if (!skipCache && fetchOptions.method !== 'POST' && fetchOptions.method !== 'PUT' && fetchOptions.method !== 'DELETE') {
      const cached = this.getCached<ApiResponse<T>>(key);
      if (cached) {
        return cached;
      }
    }

    // Check for pending request
    if (!skipDedup) {
      const pending = this.pendingRequests.get(key);
      if (pending && Date.now() - pending.timestamp < this.DEDUP_WINDOW) {
        return pending.promise as Promise<ApiResponse<T>>;
      }
    }

    // Make the request
    const requestPromise = this.makeRequest<T>(url, fetchOptions, cacheTTL, key);

    if (!skipDedup) {
      this.pendingRequests.set(key, {
        promise: requestPromise,
        timestamp: Date.now()
      });
    }

    return requestPromise;
  }

  private async makeRequest<T>(url: string, options: RequestInit, cacheTTL: number, cacheKey: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
        ...options,
      });

      const data = await response.json();

      const result: ApiResponse<T> = response.ok ? {
        success: true,
        data: data.data || data,
        message: data.message
      } : {
        success: false,
        error: data.error || `HTTP ${response.status}`,
        message: data.message
      };

      // Cache successful GET requests
      if (response.ok && (!options.method || options.method === 'GET')) {
        this.setCached(cacheKey, result, cacheTTL);
      }

      return result;
    } catch (error) {
      console.error('API call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  // Convenience methods
  async get<T>(endpoint: string, options?: Omit<Parameters<typeof this.call>[1], 'method'>): Promise<ApiResponse<T>> {
    return this.call<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: Omit<Parameters<typeof this.call>[1], 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.call<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T>(endpoint: string, data?: any, options?: Omit<Parameters<typeof this.call>[1], 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.call<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T>(endpoint: string, options?: Omit<Parameters<typeof this.call>[1], 'method'>): Promise<ApiResponse<T>> {
    return this.call<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
  }

  invalidateCache(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

// Global instance
const consolidatedClient = new ConsolidatedApiClient();

/**
 * Base API client function - now uses consolidated client
 */
async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  return consolidatedClient.call<T>(endpoint, options);
}

/**
 * User Profile Operations
 */
export const userProfileApi = {
  /**
   * Get user profile by ID or username
   */
  async getProfile(idOrUsername: string): Promise<ApiResponse> {
    return apiCall(`/api/users/profile?id=${encodeURIComponent(idOrUsername)}`);
  },

  /**
   * Update current user's profile
   */
  async updateProfile(updates: { displayName?: string; bio?: string; photoURL?: string }): Promise<ApiResponse> {
    return apiCall('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  /**
   * Get batch user data
   */
  async getBatchUsers(userIds: string[]): Promise<ApiResponse> {
    return apiCall('/api/users/batch', {
      method: 'POST',
      body: JSON.stringify({ userIds })
    });
  },

  /**
   * Logout user
   */
  async logout(): Promise<ApiResponse> {
    return apiCall('/api/auth/logout', {
      method: 'POST'
    });
  }
};

/**
 * Username Operations
 */
export const usernameApi = {
  /**
   * Check username availability
   */
  async checkAvailability(username: string): Promise<ApiResponse> {
    return apiCall(`/api/auth/username?username=${encodeURIComponent(username)}`);
  },

  /**
   * Set/update username
   */
  async setUsername(username: string): Promise<ApiResponse> {
    return apiCall('/api/auth/username', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  }
};

/**
 * Page Operations
 */
export const pageApi = {
  /**
   * Get page by ID
   */
  async getPage(pageId: string, userId?: string): Promise<ApiResponse> {
    const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return apiCall(`/api/pages/${pageId}${params}`);
  },

  /**
   * Find similar pages based on title keywords
   */
  async getSimilarPages(pageId: string, title: string, maxPages: number = 3): Promise<ApiResponse> {
    const params = new URLSearchParams({
      pageId,
      title,
      maxPages: String(maxPages)
    });
    return apiCall(`/api/pages/similar?${params}`);
  },

  /**
   * Get user's pages
   */
  async getUserPages(userId: string, options: {
    includeDeleted?: boolean;
    limit?: number;
    startAfter?: string;
    orderBy?: string;
    orderDirection?: string;
  } = {}): Promise<ApiResponse> {
    const params = new URLSearchParams({
      userId,
      ...Object.fromEntries(
        Object.entries(options).map(([key, value]) => [key, String(value)])
      )
    });
    return apiCall(`/api/pages?${params}`);
  },

  /**
   * Create new page
   */
  async createPage(pageData: {
    title: string;
    content?: any;
    groupId?: string;
    customDate?: string;
  }): Promise<ApiResponse> {
    return apiCall('/api/pages', {
      method: 'POST',
      body: JSON.stringify(pageData)
    });
  },

  /**
   * Update page
   */
  async updatePage(pageId: string, updates: {
    title?: string;
    content?: any;
    location?: any;
    groupId?: string;
    customDate?: string;
  }): Promise<ApiResponse> {
    return apiCall('/api/pages', {
      method: 'PUT',
      body: JSON.stringify({ id: pageId, ...updates })
    });
  },

  /**
   * Delete page (soft delete)
   */
  async deletePage(pageId: string, permanent: boolean = false): Promise<ApiResponse> {
    return apiCall(`/api/pages?id=${pageId}&permanent=${permanent}`, {
      method: 'DELETE'
    });
  },

  /**
   * Append reference from source page to target page
   */
  async appendReference(targetPageId: string, sourcePageData: any): Promise<ApiResponse> {
    return apiCall(`/api/pages/${targetPageId}/append-reference`, {
      method: 'POST',
      body: JSON.stringify({ sourcePageData })
    });
  }
};

/**
 * Activity Operations - REMOVED
 * Activity system has been completely removed in favor of unified version system
 */

/**
 * Search Operations
 */
export const searchApi = {
  /**
   * Search pages
   */
  async searchPages(query: string, limit: number = 20): Promise<ApiResponse> {
    return apiCall(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  /**
   * Search users
   */
  async searchUsers(query: string, limit: number = 20): Promise<ApiResponse> {
    return apiCall(`/api/search-users?q=${encodeURIComponent(query)}&limit=${limit}`);
  }
};

/**
 * Home/Dashboard Operations
 */
export const homeApi = {
  /**
   * Get home page data
   */
  async getHomeData(): Promise<ApiResponse> {
    return apiCall('/api/home');
  },

  /**
   * Get trending pages
   */
  async getTrendingPages(): Promise<ApiResponse> {
    return apiCall('/api/trending');
  },

  /**
   * Get recent pages
   */
  async getRecentPages(): Promise<ApiResponse> {
    return apiCall('/api/recent-pages');
  }
};

/**
 * Analytics Operations
 */
export const analyticsApi = {
  /**
   * Record page view
   */
  async recordPageView(pageId: string, userId?: string): Promise<ApiResponse> {
    return apiCall('/api/analytics/page-view', {
      method: 'POST',
      body: JSON.stringify({ pageId, userId })
    });
  },

  /**
   * Get user streaks
   */
  async getUserStreaks(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/analytics/streaks?userId=${encodeURIComponent(userId)}`);
  },

  /**
   * Get global analytics counters
   */
  async getCounters(): Promise<ApiResponse> {
    return apiCall('/api/analytics/counters');
  },

  /**
   * Get page analytics
   */
  async getPageAnalytics(pageId: string): Promise<ApiResponse> {
    return apiCall(`/api/analytics/page/${encodeURIComponent(pageId)}`);
  },

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/analytics/user/${encodeURIComponent(userId)}`);
  },

  /**
   * Update analytics counters
   */
  async updateCounters(counters: any, operation: 'set' | 'increment' = 'set'): Promise<ApiResponse> {
    return apiCall('/api/analytics/counters', {
      method: 'POST',
      body: JSON.stringify({ counters, operation })
    });
  },

  /**
   * Get analytics aggregations
   */
  async getAggregations(options: {
    type: 'hourly' | 'daily';
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse> {
    const params = new URLSearchParams({
      type: options.type,
      ...(options.limit && { limit: String(options.limit) }),
      ...(options.startDate && { startDate: options.startDate }),
      ...(options.endDate && { endDate: options.endDate })
    });
    return apiCall(`/api/analytics/aggregations?${params}`);
  },

  /**
   * Create/update analytics aggregation
   */
  async updateAggregation(type: 'hourly' | 'daily', date: string, data: any): Promise<ApiResponse> {
    return apiCall('/api/analytics/aggregations', {
      method: 'POST',
      body: JSON.stringify({ type, date, data })
    });
  }
};

/**
 * Legacy Firebase function replacements
 * These functions provide drop-in replacements for common Firebase operations
 */

/**
 * Replace getUserProfile from firebase/database/users.ts
 */
export async function getUserProfile(userId: string) {
  const response = await userProfileApi.getProfile(userId);
  return response.success ? response.data : null;
}

/**
 * Replace getBatchUserData from firebase/batchUserData.ts
 * Now uses consolidated client for better performance
 */
export async function getBatchUserData(userIds: string[]) {
  const response = await consolidatedClient.post('/api/users/batch', { userIds }, {
    cacheTTL: 5 * 60 * 1000 // 5 minutes cache for user data
  });
  return response.success ? response.data : {};
}

/**
 * Export consolidated client for advanced usage
 */
export { consolidatedClient as apiClient };

/**
 * Replace getUserStreaks from firebase/streaks.ts
 */
export async function getUserStreaks(userId: string) {
  const response = await analyticsApi.getUserStreaks(userId);
  return response.success ? response.data : null;
}

/**
 * Replace recordPageView from firebase/pageViews.ts
 */
export async function recordPageView(pageId: string, userId?: string) {
  const response = await analyticsApi.recordPageView(pageId, userId);
  return response.success;
}

/**
 * Replace getUserProfiles from firebase/database/users.ts
 */
export async function getUserProfiles(userIds: string[]) {
  const response = await userProfileApi.getBatchUsers(userIds);
  return response.success ? response.data.users : {};
}

/**
 * Replace checkUsernameAvailability from firebase/auth.ts
 */
export async function checkUsernameAvailability(username: string) {
  const response = await usernameApi.checkAvailability(username);
  return response.success ? response.data : {
    isAvailable: false,
    message: 'Error checking availability',
    error: response.error,
    suggestions: []
  };
}

/**
 * Replace appendPageReference from firebase/database.ts
 */
export async function appendPageReference(targetPageId: string, sourcePageData: any, userId?: string) {
  const response = await pageApi.appendReference(targetPageId, sourcePageData);
  return response.success;
}

/**
 * Replace getPageById from firebase/database.ts
 */
export async function getPageById(pageId: string, userId?: string) {
  const response = await pageApi.getPage(pageId, userId);
  if (response.success) {
    return { pageData: response.data };
  }
  return { pageData: null, error: response.error || 'Failed to load page' };
}

/**
 * Replace setCurrentVersion from firebase/database.ts
 */
export async function setCurrentVersion(pageId: string, versionId: string): Promise<boolean> {
  const response = await versionsApi.setCurrentVersion(pageId, versionId);
  return response.success;
}

/**
 * Visitor Tracking Operations
 */
export const visitorTrackingApi = {
  /**
   * Create or update visitor session
   */
  async createOrUpdateSession(sessionData: {
    fingerprintId: string;
    userId?: string;
    isAuthenticated?: boolean;
    fingerprint?: any;
    pageId?: string;
    sessionData?: any;
  }): Promise<ApiResponse> {
    return apiCall('/api/visitor-tracking/session', {
      method: 'POST',
      body: JSON.stringify(sessionData)
    });
  },

  /**
   * Get existing visitor session
   */
  async getSession(fingerprintId: string, userId?: string): Promise<ApiResponse> {
    const params = new URLSearchParams({ fingerprintId });
    if (userId) params.append('userId', userId);
    return apiCall(`/api/visitor-tracking/session?${params}`);
  },

  /**
   * Get visitor statistics
   */
  async getStats(): Promise<ApiResponse> {
    return apiCall('/api/visitor-tracking/stats');
  },

  /**
   * Update visitor session
   */
  async updateSession(sessionId: string, updates: any): Promise<ApiResponse> {
    return apiCall('/api/visitor-tracking/stats', {
      method: 'POST',
      body: JSON.stringify({ sessionId, updates })
    });
  }
};

/**
 * Real-time Database Operations
 */
export const rtdbApi = {
  /**
   * Read data from RTDB
   */
  async read(path: string): Promise<ApiResponse> {
    return apiCall(`/api/rtdb?path=${encodeURIComponent(path)}`);
  },

  /**
   * Write data to RTDB
   */
  async write(path: string, data: any, method: 'set' | 'update' | 'push' | 'remove' = 'set'): Promise<ApiResponse> {
    return apiCall('/api/rtdb', {
      method: 'POST',
      body: JSON.stringify({ path, data, method })
    });
  },

  /**
   * Update data in RTDB
   */
  async update(path: string, data: any): Promise<ApiResponse> {
    return apiCall('/api/rtdb', {
      method: 'PUT',
      body: JSON.stringify({ path, data })
    });
  },

  /**
   * Remove data from RTDB
   */
  async remove(path: string): Promise<ApiResponse> {
    return apiCall(`/api/rtdb?path=${encodeURIComponent(path)}`, {
      method: 'DELETE'
    });
  }
};

/**
 * Batch Operations
 */
export const batchApi = {
  /**
   * Execute batch operations
   */
  async executeOperations(operations: any[], options: any = {}): Promise<ApiResponse> {
    return apiCall('/api/batch/operations', {
      method: 'POST',
      body: JSON.stringify({ operations, options })
    });
  }
};

/**
 * Contributors Operations
 */
export const contributorsApi = {
  /**
   * Get contributor statistics for a page
   */
  async getContributors(pageId: string): Promise<ApiResponse> {
    return apiCall(`/api/contributors/${pageId}`);
  }
};

/**
 * Visitor Validation Operations
 */
export const visitorValidationApi = {
  /**
   * Validate visitor data
   */
  async validateVisitor(visitorData: any, validationType?: string): Promise<ApiResponse> {
    return apiCall('/api/visitor-validation', {
      method: 'POST',
      body: JSON.stringify({ visitorData, validationType })
    });
  },

  /**
   * Get traffic patterns
   */
  async getTrafficPatterns(hours: number = 24, includeDetails: boolean = false): Promise<ApiResponse> {
    const params = new URLSearchParams({
      hours: String(hours),
      includeDetails: String(includeDetails)
    });
    return apiCall(`/api/visitor-validation/patterns?${params}`);
  }
};

/**
 * Daily Notes Operations
 */
export const dailyNotesApi = {
  /**
   * Get latest daily note for a user
   */
  async getLatestDailyNote(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/daily-notes?action=latest&userId=${userId}`);
  },

  /**
   * Get earliest daily note for a user
   */
  async getEarliestDailyNote(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/daily-notes?action=earliest&userId=${userId}`);
  },

  /**
   * Check if daily note exists for a date
   */
  async checkDailyNoteExists(userId: string, date: string): Promise<ApiResponse> {
    return apiCall(`/api/daily-notes?action=exists&userId=${userId}&date=${date}`);
  },

  /**
   * Find daily note ID for a date
   */
  async findDailyNoteId(userId: string, date: string): Promise<ApiResponse> {
    return apiCall(`/api/daily-notes?action=find&userId=${userId}&date=${date}`);
  }
};

/**
 * Replace addUsername from firebase/auth.ts
 */
export async function addUsername(username: string) {
  const response = await usernameApi.setUsername(username);
  return response.success;
}

// REMOVED: Duplicate getPageById function - using the one above

/**
 * REMOVED: Activity system has been completely removed
 * Use unified version system instead
 */

/**
 * Follows Operations
 */
export const followsApi = {
  /**
   * Follow a page
   */
  async followPage(pageId: string): Promise<ApiResponse> {
    return apiCall('/api/follows/pages', {
      method: 'POST',
      body: JSON.stringify({ pageId })
    });
  },

  /**
   * Unfollow a page
   */
  async unfollowPage(pageId: string): Promise<ApiResponse> {
    return apiCall(`/api/follows/pages?pageId=${encodeURIComponent(pageId)}`, {
      method: 'DELETE'
    });
  },

  /**
   * Get pages followed by user
   */
  async getFollowedPages(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/follows/pages?userId=${encodeURIComponent(userId)}&type=following`);
  },

  /**
   * Get followers of a page
   */
  async getPageFollowers(pageId: string): Promise<ApiResponse> {
    return apiCall(`/api/follows/pages?pageId=${encodeURIComponent(pageId)}&type=followers`);
  },

  /**
   * Follow a user
   */
  async followUser(userId: string): Promise<ApiResponse> {
    return apiCall('/api/follows/users', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  /**
   * Unfollow a user
   */
  async unfollowUser(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/follows/users?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  },

  /**
   * Get users followed by user
   */
  async getFollowedUsers(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/follows/users?userId=${encodeURIComponent(userId)}&type=following`);
  },

  /**
   * Get followers of a user
   */
  async getUserFollowers(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/follows/users?userId=${encodeURIComponent(userId)}&type=followers`);
  }
};

/**
 * Links and Backlinks Operations
 */
export const linksApi = {
  /**
   * Get backlinks for a page
   */
  async getBacklinks(pageId: string, limit: number = 20): Promise<ApiResponse> {
    return apiCall(`/api/links/backlinks?pageId=${encodeURIComponent(pageId)}&limit=${limit}`);
  },

  /**
   * Update backlinks index for a page
   */
  async updateBacklinksIndex(pageData: {
    pageId: string;
    title: string;
    username: string;
    contentNodes: any[];
    isPublic: boolean;
    lastModified: string;
  }): Promise<ApiResponse> {
    return apiCall('/api/links/backlinks', {
      method: 'POST',
      body: JSON.stringify(pageData)
    });
  },

  /**
   * Extract links from content
   */
  async extractLinks(content: any, validatePages: boolean = true): Promise<ApiResponse> {
    return apiCall('/api/links/extract', {
      method: 'POST',
      body: JSON.stringify({ content, validatePages })
    });
  }
};

// REMOVED: Duplicate analyticsApi declaration - consolidated into the main one above

// REMOVED: Duplicate rtdbApi declaration - using the one above

/**
 * Versions Operations
 */
export const versionsApi = {
  /**
   * Get version history for a page
   */
  async getVersions(pageId: string, options: {
    limit?: number;
    includeNoOp?: boolean;
  } = {}): Promise<ApiResponse> {
    const params = new URLSearchParams({
      ...(options.limit && { limit: String(options.limit) }),
      ...(options.includeNoOp && { includeNoOp: String(options.includeNoOp) })
    });
    return apiCall(`/api/pages/${pageId}/versions?${params}`);
  },

  /**
   * Create a new version for a page
   */
  async createVersion(pageId: string, versionData: {
    content: any;
    username: string;
    groupId?: string;
    previousVersionId?: string;
    isNoOp?: boolean;
  }): Promise<ApiResponse> {
    return apiCall(`/api/pages/${pageId}/versions`, {
      method: 'POST',
      body: JSON.stringify(versionData)
    });
  },

  /**
   * Set a specific version as the current version (restore)
   */
  async setCurrentVersion(pageId: string, versionId: string): Promise<ApiResponse> {
    return apiCall(`/api/pages/${pageId}/set-current-version`, {
      method: 'POST',
      body: JSON.stringify({ versionId })
    });
  }
};
