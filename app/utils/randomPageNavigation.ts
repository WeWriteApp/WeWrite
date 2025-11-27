/**
 * Utility functions for random page navigation
 */

export interface RandomPageFilters {
  includePrivate?: boolean;
  excludeOwnPages?: boolean;
  excludeUsername?: string;
  includeUsername?: string;
}

/**
 * Get filter preferences from localStorage
 * @returns RandomPageFilters - Current filter preferences
 */
export function getRandomPageFilters(): RandomPageFilters {
  if (typeof window === 'undefined') {
    return { includePrivate: false, excludeOwnPages: false };
  }

  const includePrivate = localStorage.getItem('randomPages_includePrivate') === 'true';
  const excludeOwnPages = localStorage.getItem('randomPages_excludeOwnPages') === 'true';
  const excludeUsername = localStorage.getItem('randomPages_excludeUsername') || '';
  const includeUsername = localStorage.getItem('randomPages_includeUsername') || '';

  return { includePrivate, excludeOwnPages, excludeUsername, includeUsername };
}

/**
 * Get a single random page ID for navigation
 * @param userId - Optional user ID for access control
 * @param filters - Optional filter preferences (defaults to localStorage values)
 * @returns Promise<string | null> - Random page ID or null if none available
 */
export async function getRandomPageId(userId?: string, filters?: RandomPageFilters): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      limit: '1', // We only need one page
    });

    // Add user ID for access control if provided
    if (userId) {
      params.append('userId', userId);
    }

    // Use provided filters or get from localStorage
    const effectiveFilters = filters || getRandomPageFilters();

    // Add privacy preference
    if (effectiveFilters.includePrivate) {
      params.append('includePrivate', 'true');
    }

    // Add "Not mine" filter preference
    if (effectiveFilters.excludeOwnPages) {
      params.append('excludeOwnPages', 'true');
    }

    if (effectiveFilters.excludeUsername) {
      params.append('excludeUsername', effectiveFilters.excludeUsername);
    }

    if (effectiveFilters.includeUsername) {
      params.append('includeUsername', effectiveFilters.includeUsername);
    }

    const response = await fetch(`/api/random-pages?${params}`);

    if (!response.ok) {
      console.error('Failed to fetch random page:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      console.error('Random page API error:', data.error);
      return null;
    }

    if (data.randomPages && data.randomPages.length > 0) {
      return data.randomPages[0].id;
    }

    return null;
  } catch (error) {
    console.error('Error fetching random page:', error);
    return null;
  }
}

/**
 * Navigate to a random page
 * @param router - Next.js router instance
 * @param userId - Optional user ID for access control
 * @param filters - Optional filter preferences (defaults to localStorage values)
 */
export async function navigateToRandomPage(router: any, userId?: string, filters?: RandomPageFilters): Promise<void> {
  try {
    const randomPageId = await getRandomPageId(userId, filters);

    if (randomPageId) {
      router.push(`/${randomPageId}`);
    } else {
      console.warn('No random page available for navigation');
      // Optionally show a toast or notification to the user
    }
  } catch (error) {
    console.error('Error navigating to random page:', error);
  }
}
