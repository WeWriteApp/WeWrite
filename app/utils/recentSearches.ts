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

    console.log(`Syncing ${unsyncedSearches.length} recent searches to database`);

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
      console.log('Recent searches synced to database successfully');
    } else {
      console.warn('Failed to sync recent searches to database');
    }
  } catch (error) {
    console.error('Error syncing recent searches to database:', error);
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
      console.log(`Skipping incremental search: "${trimmedTerm}"`);
      return;
    }

    recentSearches = recentSearches.filter(item => {
      const existingTerm = item.term.toLowerCase();
      const newTerm = trimmedTerm.toLowerCase();

      if (existingTerm === newTerm) return false;

      if (newTerm.startsWith(existingTerm) && newTerm.length > existingTerm.length) {
        console.log(`Removing prefix search: "${item.term}" (replaced by "${trimmedTerm}")`);
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
        syncRecentSearchesToDatabase(userId, recentSearches).catch(error => {
          console.warn('Background sync of recent searches failed:', error);
        });
      }
    }
  } catch (error) {
    console.error("Error adding recent search to localStorage:", error);
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
            console.log('Recent searches loaded from database (first time)');
            localStorage.setItem(storageKey, JSON.stringify(data.data.recentSearches));
            return data.data.recentSearches;
          }
        }
      } catch (error) {
        console.warn('Error fetching recent searches from database:', error);
      }
    }

    return recentSearches;
  } catch (error) {
    console.error("Error getting recent searches from localStorage:", error);
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
        console.log('Recent searches cleared from database');
        const storageKey = `recentSearches_${userId}`;
        localStorage.removeItem(storageKey);
        return;
      } else {
        console.warn('Failed to clear recent searches from database, falling back to localStorage');
      }
    } catch (error) {
      console.warn('Error clearing recent searches from database, falling back to localStorage:', error);
    }
  }

  try {
    const storageKey = userId ? `recentSearches_${userId}` : 'recentSearches';
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error("Error clearing recent searches from localStorage:", error);
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
        console.log('Recent search removed from database');
        return data.data.recentSearches || [];
      } else {
        console.warn('Failed to remove recent search from database, falling back to localStorage');
      }
    } catch (error) {
      console.warn('Error removing recent search from database, falling back to localStorage:', error);
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
    console.error("Error removing recent search from localStorage:", error);
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

    console.log('Added page to recently viewed:', pageId);
  } catch (error) {
    console.error("Error adding recently viewed page:", error);
  }
};

export const getRecentlyViewedPageIds = (): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    const recentlyVisitedStr = localStorage.getItem('recentlyVisitedPages');
    return recentlyVisitedStr ? JSON.parse(recentlyVisitedStr) : [];
  } catch (error) {
    console.error("Error getting recently viewed pages:", error);
    return [];
  }
};
