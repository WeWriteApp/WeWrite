/**
 * API Client Utility
 *
 * This utility provides functions to replace direct Firebase calls with API route calls.
 * It ensures all operations go through environment-aware API endpoints.
 *
 * ARCHITECTURE NOTE: Environment-aware collection switching (DEV_ prefix) happens
 * SERVER-SIDE in API routes via getCollectionName(). This client doesn't need to
 * know about collections - it just calls endpoints.
 *
 * CONSOLIDATION (January 2026): Refactored from 15+ separate API objects to use
 * a factory pattern, reducing ~500 lines of repetitive code.
 */

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
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
        message: data.message,
        statusCode: response.status,
        data: data // Preserve response data even for errors (needed for deleted page detection)
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
 * Invalidate page deleted status cache
 * This ensures deleted page status appears immediately
 */
export const invalidatePageDeletedStatus = (pageId: string) => {
  consolidatedClient.invalidateCache(new RegExp(`page.*${pageId}`));

  // Also clear the page cache if available
  import('./serverCache').then(({ pageCache }) => {
    pageCache.invalidate(pageId);
  }).catch(() => {});

  // Clear InternalLinkWithTitle caches
  import('../components/editor/InternalLinkWithTitle').then(({ clearPageCaches }) => {
    clearPageCaches(pageId);
  }).catch(() => {});
};

/**
 * Comprehensive page cache invalidation after saves/edits
 * Clears all caching layers to ensure fresh data on next load
 */
export const invalidatePageCacheAfterSave = (pageId: string, userId?: string) => {
  // 1. Clear ConsolidatedApiClient cache for this page
  consolidatedClient.invalidateCache(new RegExp(`.*${pageId}.*`));

  // 2. Clear server-side page cache
  import('./serverCache').then(({ pageCache, invalidateCache }) => {
    pageCache.invalidate(pageId);
    invalidateCache.page(pageId);
    if (userId) {
      invalidateCache.user(userId);
    }
  }).catch(() => {});

  // 3. Clear InternalLinkWithTitle caches
  import('../components/editor/InternalLinkWithTitle').then(({ clearPageCaches }) => {
    clearPageCaches(pageId);
  }).catch(() => {});

  // 4. Clear sessionStorage optimistic page data
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(`wewrite:optimisticPage:${pageId}`);
    } catch (e) {
      // sessionStorage might not be available
    }
  }

};

/**
 * Base API client function - now uses consolidated client
 */
async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  return consolidatedClient.call<T>(endpoint, options);
}

// ============================================================================
// API OBJECTS - Consolidated January 2026
// Only methods with active usage are preserved. Unused methods removed.
// ============================================================================

/**
 * User Profile Operations
 * USED: getProfile (userUtils.ts, apiClient wrappers), getBatchUsers (apiClient wrappers)
 */
export const userProfileApi = {
  /** Get user profile by ID or username */
  async getProfile(idOrUsername: string): Promise<ApiResponse> {
    return apiCall(`/api/users/profile?id=${encodeURIComponent(idOrUsername)}`);
  },

  /** Get batch user data */
  async getBatchUsers(userIds: string[]): Promise<ApiResponse> {
    return apiCall('/api/users/batch', {
      method: 'POST',
      body: JSON.stringify({ userIds })
    });
  },
};

/**
 * Username Operations
 * USED: checkAvailability (apiClient wrapper), setUsername (profile settings)
 */
export const usernameApi = {
  /** Check username availability (via consolidated /api/users/username) */
  async checkAvailability(username: string): Promise<ApiResponse> {
    return apiCall(`/api/users/username?username=${encodeURIComponent(username)}`);
  },

  /** Set/update username (via consolidated /api/users/username) */
  async setUsername(username: string): Promise<ApiResponse> {
    return apiCall('/api/users/username', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  },

  /** Get cooldown status for the current user */
  async getCooldownStatus(): Promise<ApiResponse> {
    return apiCall('/api/users/username?action=cooldown-status');
  }
};

/**
 * Page Operations
 * USED: getPage (analytics, check-link-existence), getSimilarPages (SimilarPages.tsx), appendReference (apiClient wrapper)
 * UNUSED (removed): getUserPages, createPage, updatePage, deletePage - these are called via other mechanisms
 */
export const pageApi = {
  /** Get page by ID. skipCache bypasses client cache for edit mode */
  async getPage(pageId: string, userId?: string, options?: { skipCache?: boolean }): Promise<ApiResponse> {
    const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return consolidatedClient.call(`/api/pages/${pageId}${params}`, {
      skipCache: options?.skipCache
    });
  },

  /** Find similar pages based on title keywords */
  async getSimilarPages(pageId: string, title: string, maxPages: number = 3): Promise<ApiResponse> {
    const params = new URLSearchParams({ pageId, title, maxPages: String(maxPages) });
    return apiCall(`/api/pages/similar?${params}`);
  },

  /** Append reference from source page to target page */
  async appendReference(targetPageId: string, sourcePageData: any): Promise<ApiResponse> {
    return apiCall(`/api/pages/${targetPageId}/append-reference`, {
      method: 'POST',
      body: JSON.stringify({ sourcePageData })
    });
  }
};

// searchApi - REMOVED (not used anywhere in codebase)
// homeApi - REMOVED (not used anywhere in codebase)

/**
 * Analytics Operations
 * USED: recordPageView (ContentPageView.tsx), getUserStreaks (UserStreak.tsx)
 * UNUSED (removed): getCounters, getPageAnalytics, getUserAnalytics, updateCounters, getAggregations, updateAggregation
 */
export const analyticsApi = {
  /** Record page view */
  async recordPageView(pageId: string, userId?: string): Promise<ApiResponse> {
    return apiCall('/api/analytics/page-view', {
      method: 'POST',
      body: JSON.stringify({ pageId, userId })
    });
  },

  /** Get user streaks */
  async getUserStreaks(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/analytics/streaks?userId=${encodeURIComponent(userId)}`);
  },
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
  if (!response.success) {
    return {
      isAvailable: false,
      message: 'Error checking availability',
      error: response.error,
      suggestions: []
    };
  }
  const data = response.data;
  // Normalize: /api/users/username returns `available`, client code expects `isAvailable`
  return {
    isAvailable: data.available ?? data.isAvailable ?? false,
    message: data.message || data.error || (data.available ? 'Username is available' : 'Username is already taken'),
    error: data.error || null,
    suggestions: data.suggestions || [],
    cooldown: data.cooldown || null,
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
 * @param skipCache - If true, bypasses client-side cache to get fresh data (useful for edit mode)
 */
export async function getPageById(pageId: string, userId?: string, options?: { skipCache?: boolean }) {
  const response = await pageApi.getPage(pageId, userId, { skipCache: options?.skipCache });
  if (response.success) {
    return { pageData: response.data };
  }

  // For 404 responses, check if there's deleted page data in the error response
  if (response.statusCode === 404 && response.data?.pageData?.deleted === true) {
    return {
      pageData: response.data.pageData,
      error: response.error || 'Page not found'
    };
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

// visitorTrackingApi - REMOVED (imported but methods never called)

/**
 * Real-time Database Operations
 * PRESERVED: Imported in 3 files (realtimeConnectionManager, ContentPageHeader, ContentPageActions)
 * though methods not currently called - keeping for future use
 */
export const rtdbApi = {
  async read(path: string): Promise<ApiResponse> {
    return apiCall(`/api/rtdb?path=${encodeURIComponent(path)}`);
  },
  async write(path: string, data: any, method: 'set' | 'update' | 'push' | 'remove' = 'set'): Promise<ApiResponse> {
    return apiCall('/api/rtdb', { method: 'POST', body: JSON.stringify({ path, data, method }) });
  },
  async update(path: string, data: any): Promise<ApiResponse> {
    return apiCall('/api/rtdb', { method: 'PUT', body: JSON.stringify({ path, data }) });
  },
  async remove(path: string): Promise<ApiResponse> {
    return apiCall(`/api/rtdb?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
  }
};

// batchApi - REMOVED (not used anywhere in codebase)

/**
 * Contributors Operations
 * USED: getContributors (ContributorsService.ts)
 */
export const contributorsApi = {
  /** Get contributor statistics for a page */
  async getContributors(pageId: string): Promise<ApiResponse> {
    return apiCall(`/api/contributors/${pageId}`);
  }
};

/**
 * Visitor Validation Operations
 * USED: getTrafficPatterns (VisitorValidationService.ts)
 */
export const visitorValidationApi = {
  /** Get traffic patterns */
  async getTrafficPatterns(hours: number = 24, includeDetails: boolean = false): Promise<ApiResponse> {
    const params = new URLSearchParams({ hours: String(hours), includeDetails: String(includeDetails) });
    return apiCall(`/api/visitor-validation/patterns?${params}`);
  }
};

/**
 * Daily Notes Operations
 * USED: getLatestDailyNote (dailyNoteNavigation.ts)
 */
export const dailyNotesApi = {
  /** Get latest daily note for a user */
  async getLatestDailyNote(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/daily-notes?action=latest&userId=${userId}`);
  },
};

/**
 * Replace addUsername from firebase/auth.ts
 * Accepts (username) or (userId, username) for call-site compatibility
 */
export async function addUsername(usernameOrUserId: string, username?: string) {
  const actualUsername = username ?? usernameOrUserId;
  const response = await usernameApi.setUsername(actualUsername);
  return { success: response.success };
}

/**
 * Follows Operations
 * USED: followPage, unfollowPage (follows.ts, FollowedPages.tsx)
 *       followUser, unfollowUser, getFollowedUsers (useUserFollowing.ts, UserFollowingList.tsx)
 *       getFollowSuggestions (FollowingSuggestions.tsx)
 * UNUSED (removed): getFollowedPages, getPageFollowers, getUserFollowers
 */
export const followsApi = {
  async followPage(pageId: string): Promise<ApiResponse> {
    return apiCall('/api/follows/pages', { method: 'POST', body: JSON.stringify({ pageId }) });
  },
  async unfollowPage(pageId: string): Promise<ApiResponse> {
    return apiCall(`/api/follows/pages?pageId=${encodeURIComponent(pageId)}`, { method: 'DELETE' });
  },
  async followUser(userId: string): Promise<ApiResponse> {
    return apiCall('/api/follows/users', { method: 'POST', body: JSON.stringify({ userId }) });
  },
  async unfollowUser(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/follows/users?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
  },
  async getFollowedUsers(userId: string): Promise<ApiResponse> {
    return apiCall(`/api/follows/users?userId=${encodeURIComponent(userId)}&type=following`);
  },
  async getFollowSuggestions(limit: number = 10): Promise<ApiResponse> {
    return apiCall(`/api/follows/suggestions?limit=${limit}`);
  }
};

// linksApi - REMOVED (no methods currently used in codebase)

/**
 * Versions Operations
 * USED: setCurrentVersion (apiClient wrapper)
 * UNUSED (removed): getVersions, createVersion
 */
export const versionsApi = {
  /** Set a specific version as the current version (restore) */
  async setCurrentVersion(pageId: string, versionId: string): Promise<ApiResponse> {
    return apiCall(`/api/pages/${pageId}/set-current-version`, {
      method: 'POST',
      body: JSON.stringify({ versionId })
    });
  }
};
