"use client";

/**
 * Navigation tracking utility to supplement "What Links Here" functionality
 * This tracks when users navigate from one page to another, creating implicit backlinks
 */

// Store recent navigation history in sessionStorage
const NAVIGATION_HISTORY_KEY = 'wewrite_navigation_history';
const MAX_HISTORY_ENTRIES = 50;

interface NavigationEntry {
  from: string;
  to: string;
  timestamp: string;
  sessionId: string;
}

/**
 * Track navigation from one page to another
 */
export function trackNavigation(fromPageId: string, toPageId: string): void {
  if (typeof window === 'undefined' || !fromPageId || !toPageId || fromPageId === toPageId) {
    return;
  }

  try {
    // Get existing navigation history
    const historyJson = sessionStorage.getItem(NAVIGATION_HISTORY_KEY);
    let history: NavigationEntry[] = historyJson ? JSON.parse(historyJson) : [];

    // Add new navigation entry
    const navigationEntry: NavigationEntry = {
      from: fromPageId,
      to: toPageId,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId()
    };

    // Add to beginning of array (most recent first)
    history.unshift(navigationEntry);

    // Limit history size
    if (history.length > MAX_HISTORY_ENTRIES) {
      history = history.slice(0, MAX_HISTORY_ENTRIES);
    }

    // Save back to sessionStorage
    sessionStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(history));

    console.log(`Navigation tracked: ${fromPageId} -> ${toPageId}`);
  } catch (error) {
    console.error('Error tracking navigation:', error);
  }
}

/**
 * Get pages that have navigated to the specified page
 */
export function getNavigationBacklinks(targetPageId: string): string[] {
  if (typeof window === 'undefined' || !targetPageId) {
    return [];
  }

  try {
    const historyJson = sessionStorage.getItem(NAVIGATION_HISTORY_KEY);
    if (!historyJson) {
      return [];
    }

    const history: NavigationEntry[] = JSON.parse(historyJson);

    // Find all unique pages that have navigated to the target page
    const backlinks = new Set<string>();

    history.forEach(entry => {
      if (entry.to === targetPageId && entry.from !== targetPageId) {
        backlinks.add(entry.from);
      }
    });

    return Array.from(backlinks);
  } catch (error) {
    console.error('Error getting navigation backlinks:', error);
    return [];
  }
}

/**
 * Get or create a session ID for tracking navigation within a session
 */
function getSessionId(): string {
  const SESSION_ID_KEY = 'wewrite_session_id';
  
  try {
    let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
    
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    
    return sessionId;
  } catch (error) {
    console.error('Error managing session ID:', error);
    return 'session_fallback_' + Date.now();
  }
}

/**
 * Clear navigation history (useful for testing or privacy)
 */
export function clearNavigationHistory(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(NAVIGATION_HISTORY_KEY);
    console.log('Navigation history cleared');
  } catch (error) {
    console.error('Error clearing navigation history:', error);
  }
}

/**
 * Get the current page ID from the URL
 */
export function getCurrentPageId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const pathname = window.location.pathname;
    
    // Extract page ID from various URL formats
    // /page-id, /pages/page-id, etc.
    const pageIdMatch = pathname.match(/^\/(?:pages\/)?([^\/]+)$/);
    
    if (pageIdMatch && pageIdMatch[1]) {
      const pageId = pageIdMatch[1];
      
      // Filter out non-page routes
      const nonPageRoutes = [
        'search', 'account', 'user', 'group', 'auth', 'api', 
        'admin', 'subscription', 'settings', 'help', 'about',
        'privacy', 'terms', 'contact', 'roadmap', 'trending'
      ];
      
      if (!nonPageRoutes.includes(pageId)) {
        return pageId;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current page ID:', error);
    return null;
  }
}

/**
 * Initialize navigation tracking for the current page
 * Call this when a page loads to track navigation from the previous page
 */
export function initializeNavigationTracking(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const currentPageId = getCurrentPageId();
    
    if (!currentPageId) {
      return;
    }

    // Get the previous page from document.referrer
    const referrer = document.referrer;
    
    if (referrer && referrer.includes(window.location.origin)) {
      // Extract page ID from referrer URL
      const referrerUrl = new URL(referrer);
      const referrerPathname = referrerUrl.pathname;
      const referrerPageIdMatch = referrerPathname.match(/^\/(?:pages\/)?([^\/]+)$/);
      
      if (referrerPageIdMatch && referrerPageIdMatch[1]) {
        const fromPageId = referrerPageIdMatch[1];
        
        // Filter out non-page routes
        const nonPageRoutes = [
          'search', 'account', 'user', 'group', 'auth', 'api', 
          'admin', 'subscription', 'settings', 'help', 'about',
          'privacy', 'terms', 'contact', 'roadmap', 'trending'
        ];
        
        if (!nonPageRoutes.includes(fromPageId)) {
          trackNavigation(fromPageId, currentPageId);
        }
      }
    }
  } catch (error) {
    console.error('Error initializing navigation tracking:', error);
  }
}