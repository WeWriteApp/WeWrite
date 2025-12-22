"use client";

const MAX_RECENT_SEARCHES = 10;

let saveSearchTimeout: ReturnType<typeof setTimeout> | null = null;

interface RecentSearch {
  term: string;
  timestamp: number;
  synced?: boolean;
}

async function syncRecentSearchesToDatabase(userId: string, recentSearches: RecentSearch[]): Promise<void> {
  try {
    const unsyncedSearches = recentSearches.filter(item => !item.synced);

    if (unsyncedSearches.length === 0) {
      return;
    }

    const mostRecent = unsyncedSearches[0];
    const response = await fetch('/api/user-preferences/recent-searches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ searchTerm: mostRecent.term }),
    });

    if (response.ok) {
      const storageKey = `recentSearches_${userId}`;
      const updatedSearches = recentSearches.map(item => ({ ...item, synced: true }));
      localStorage.setItem(storageKey, JSON.stringify(updatedSearches));
      localStorage.setItem(`lastSearchSync_${userId}`, Date.now().toString());
    }
  } catch (error) {
    // Silently fail - sync is not critical
  }
}

export const addRecentSearch = async (searchTerm: string, userId: string | null = null): Promise<void> => {
  if (!searchTerm || typeof window === 'undefined') return;

  const trimmedTerm = searchTerm.trim();
  if (!trimmedTerm) return;

  if (trimmedTerm.length < 2) return;

  const commonWords = ['a', 'an', 'the', 'is', 'at', 'it', 'on', 'be', 'to', 'of', 'and', 'or'];
  if (commonWords.includes(trimmedTerm.toLowerCase())) return;

  const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';

  try {
    const existingSearchesStr = localStorage.getItem(storageKey);
    let recentSearches: RecentSearch[] = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];

    if (!Array.isArray(recentSearches)) {
      recentSearches = [];
    }

    const isIncrementalSearch = recentSearches.some(item => {
      const existingTerm = item.term.toLowerCase();
      const newTerm = trimmedTerm.toLowerCase();

      if (existingTerm.startsWith(newTerm) && existingTerm.length > newTerm.length) {
        return true;
      }

      if (existingTerm === newTerm) {
        return true;
      }

      return false;
    });

    if (isIncrementalSearch) {
      return;
    }

    recentSearches = recentSearches.filter(item => {
      const existingTerm = item.term.toLowerCase();
      const newTerm = trimmedTerm.toLowerCase();

      if (existingTerm === newTerm) return false;

      if (newTerm.startsWith(existingTerm) && newTerm.length > existingTerm.length) {
        return false;
      }

      return true;
    });

    recentSearches.unshift({
      term: trimmedTerm,
      timestamp: Date.now(),
      synced: false
    });

    recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);

    localStorage.setItem(storageKey, JSON.stringify(recentSearches));

    if (userId) {
      const lastSync = localStorage.getItem(`lastSearchSync_${userId}`);
      const now = Date.now();
      const unsyncedCount = recentSearches.filter(item => !item.synced).length;

      const shouldSync = !lastSync ||
        (now - parseInt(lastSync) > 5 * 60 * 1000) ||
        unsyncedCount >= 5;

      if (shouldSync) {
        syncRecentSearchesToDatabase(userId, recentSearches).catch(() => {
          // Silently fail - background sync is not critical
        });
      }
    }
  } catch (error) {
    // Silently fail - localStorage errors are not critical
  }
};

export const addRecentSearchDebounced = (
  searchTerm: string,
  userId: string | null = null,
  delay = 1000
): void => {
  if (saveSearchTimeout) {
    clearTimeout(saveSearchTimeout);
  }

  saveSearchTimeout = setTimeout(() => {
    addRecentSearch(searchTerm, userId);
  }, delay);
};

export const getRecentSearches = async (userId: string | null = null): Promise<RecentSearch[]> => {
  if (typeof window === 'undefined') return [];

  const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';

  try {
    const existingSearchesStr = localStorage.getItem(storageKey);
    let recentSearches: RecentSearch[] = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];

    if (!Array.isArray(recentSearches)) {
      recentSearches = [];
    }

    if (userId && recentSearches.length === 0) {
      try {
        const response = await fetch('/api/user-preferences/recent-searches');

        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data.recentSearches)) {
            localStorage.setItem(storageKey, JSON.stringify(data.data.recentSearches));
            return data.data.recentSearches;
          }
        }
      } catch (error) {
        // Silently fail - will fallback to localStorage
      }
    }

    return recentSearches;
  } catch (error) {
    return [];
  }
};

export const clearRecentSearches = async (userId: string | null = null): Promise<void> => {
  if (typeof window === 'undefined') return;

  if (userId) {
    try {
      const response = await fetch('/api/user-preferences/recent-searches', {
        method: 'DELETE',
      });

      if (response.ok) {
        const storageKey = `recentSearches_${userId}`;
        localStorage.removeItem(storageKey);
        return;
      }
    } catch (error) {
      // Silently fail - will fallback to localStorage
    }
  }

  try {
    const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';
    localStorage.removeItem(storageKey);
  } catch (error) {
    // Silently fail - localStorage errors are not critical
  }
};

export const removeRecentSearch = async (
  searchTerm: string,
  userId: string | null = null
): Promise<RecentSearch[]> => {
  if (!searchTerm || typeof window === 'undefined') return [];

  const trimmedTerm = searchTerm.trim();
  if (!trimmedTerm) return [];

  if (userId) {
    try {
      const response = await fetch(`/api/user-preferences/recent-searches?term=${encodeURIComponent(trimmedTerm)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        return data.data.recentSearches || [];
      }
    } catch (error) {
      // Silently fail - will fallback to localStorage
    }
  }

  try {
    const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';

    const existingSearchesStr = localStorage.getItem(storageKey);
    let recentSearches: RecentSearch[] = existingSearchesStr ? JSON.parse(existingSearchesStr) : [];

    if (!Array.isArray(recentSearches)) {
      recentSearches = [];
    }

    recentSearches = recentSearches.filter(search =>
      search.term.toLowerCase() !== trimmedTerm.toLowerCase()
    );

    localStorage.setItem(storageKey, JSON.stringify(recentSearches));

    return recentSearches;
  } catch (error) {
    return [];
  }
};

const MAX_RECENT_PAGES = 20;

export const addRecentlyViewedPageId = (pageId: string): void => {
  if (!pageId || typeof window === 'undefined') return;

  try {
    const existingPagesStr = localStorage.getItem('recentlyVisitedPages');
    let recentPages: string[] = existingPagesStr ? JSON.parse(existingPagesStr) : [];

    if (!Array.isArray(recentPages)) {
      recentPages = [];
    }

    recentPages = recentPages.filter(id => id !== pageId);
    recentPages.unshift(pageId);
    recentPages = recentPages.slice(0, MAX_RECENT_PAGES);

    localStorage.setItem('recentlyVisitedPages', JSON.stringify(recentPages));
  } catch (error) {
    // Silently fail - localStorage errors are not critical
  }
};

export const getRecentlyViewedPageIds = (): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const recentlyVisitedStr = localStorage.getItem('recentlyVisitedPages');
    return recentlyVisitedStr ? JSON.parse(recentlyVisitedStr) : [];
  } catch (error) {
    return [];
  }
};
