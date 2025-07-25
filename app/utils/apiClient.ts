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
 * Base API client function
 */
async function apiCall<T = any>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
        message: data.message
      };
    }

    return {
      success: true,
      data: data.data || data,
      message: data.message
    };
  } catch (error) {
    console.error('API call failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
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
  async getPage(pageId: string): Promise<ApiResponse> {
    return apiCall(`/api/pages/${pageId}`);
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
  }
};

/**
 * Activity Operations - DEPRECATED
 * Activity system has been replaced with version system
 * Use firebase/activity.ts getRecentActivity() instead
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
 * Replace addUsername from firebase/auth.ts
 */
export async function addUsername(username: string) {
  const response = await usernameApi.setUsername(username);
  return response.success;
}

/**
 * Replace getPageById from firebase/database/pages.ts
 */
export async function getPageById(pageId: string, userId?: string) {
  const response = await pageApi.getPage(pageId);
  return response.success ? { pageData: response.data, error: null } : { pageData: null, error: response.error };
}

/**
 * DEPRECATED: Use firebase/activity.ts getRecentActivity() directly instead
 * This wrapper function is no longer needed
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

/**
 * Analytics Operations
 */
export const analyticsApi = {
  /**
   * Get global analytics counters
   */
  async getCounters(): Promise<ApiResponse> {
    return apiCall('/api/analytics/counters');
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
  async write(path: string, data: any): Promise<ApiResponse> {
    return apiCall('/api/rtdb', {
      method: 'POST',
      body: JSON.stringify({ path, data })
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
   * Delete data from RTDB
   */
  async delete(path: string): Promise<ApiResponse> {
    return apiCall(`/api/rtdb?path=${encodeURIComponent(path)}`, {
      method: 'DELETE'
    });
  }
};

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
  }
};
