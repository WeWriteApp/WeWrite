/**
 * Page Refresh Protection Utility
 * 
 * Provides comprehensive protection against infinite page refresh loops
 * with hard reset capabilities and user-friendly notifications.
 */

import { pageRefreshCircuitBreaker } from './circuit-breaker';
import { resetApplicationState } from './error-recovery';
import { toast } from '../components/ui/use-toast';

/**
 * Clear page-specific localStorage data
 */
function clearPageLocalStorage(pageId) {
  if (typeof localStorage === 'undefined') return;

  try {
    const keysToRemove = [];
    
    // Find all localStorage keys related to this page
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes(pageId) ||
        key.includes('page_') ||
        key.includes('editor_') ||
        key.includes('recent_') ||
        key.includes('cache_')
      )) {
        keysToRemove.push(key);
      }
    }

    // Remove page-specific keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`Cleared localStorage key: ${key}`);
      } catch (error) {
        console.error(`Failed to remove localStorage key ${key}:`, error);
      }
    });

    console.log(`Cleared ${keysToRemove.length} page-specific localStorage items`);
  } catch (error) {
    console.error('Failed to clear page localStorage:', error);
  }
}

/**
 * Clear browser cache for current domain using Cache API
 */
async function clearBrowserCache() {
  if (typeof caches === 'undefined') {
    console.warn('Cache API not available');
    return;
  }

  try {
    const cacheNames = await caches.keys();
    console.log(`Found ${cacheNames.length} caches to clear`);

    const clearPromises = cacheNames.map(async (cacheName) => {
      try {
        await caches.delete(cacheName);
        console.log(`Cleared cache: ${cacheName}`);
      } catch (error) {
        console.error(`Failed to clear cache ${cacheName}:`, error);
      }
    });

    await Promise.all(clearPromises);
    console.log('Browser cache clearing completed');
  } catch (error) {
    console.error('Failed to clear browser cache:', error);
  }
}

/**
 * Perform hard reset sequence for a specific page
 */
export async function performHardReset(pageId, reason = 'Circuit breaker triggered') {
  console.log(`🚨 Performing hard reset for page ${pageId}. Reason: ${reason}`);

  try {
    // 1. Clear page-specific localStorage data
    clearPageLocalStorage(pageId);

    // 2. Clear browser cache
    await clearBrowserCache();

    // 3. Reset circuit breaker data for this page
    pageRefreshCircuitBreaker.resetPageData(pageId);

    // 4. Show user-friendly notification
    if (typeof window !== 'undefined') {
      // Use toast notification if available, otherwise fallback to alert
      try {
        toast({
          title: "Page Reset",
          description: "We detected multiple refresh attempts and have reset the page to prevent issues. You'll be redirected to the home page.",
          variant: "destructive",
          duration: 5000,
        });
      } catch (toastError) {
        console.warn('Toast notification failed, using alert:', toastError);
        alert('We detected multiple refresh attempts and have reset the page to prevent issues. You\'ll be redirected to the home page.');
      }
    }

    // 5. Log the incident
    const incident = {
      timestamp: new Date().toISOString(),
      pageId,
      reason,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      resetActions: [
        'cleared_page_localStorage',
        'cleared_browser_cache',
        'reset_circuit_breaker',
        'showed_user_notification'
      ]
    };

    console.error('Hard reset incident:', incident);

    // Store incident for debugging
    try {
      const incidents = JSON.parse(localStorage.getItem('wewrite_hard_reset_incidents') || '[]');
      incidents.push(incident);
      
      // Keep only last 5 incidents
      if (incidents.length > 5) {
        incidents.splice(0, incidents.length - 5);
      }
      
      localStorage.setItem('wewrite_hard_reset_incidents', JSON.stringify(incidents));
    } catch (storageError) {
      console.error('Failed to store hard reset incident:', storageError);
    }

    // 6. Wait a moment for notifications to show
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 7. Redirect to home page with cache busting
    if (typeof window !== 'undefined') {
      const homeUrl = `${window.location.origin}/?_reset=${Date.now()}`;
      console.log(`Redirecting to home page: ${homeUrl}`);
      window.location.href = homeUrl;
    }

  } catch (error) {
    console.error('Hard reset failed:', error);
    
    // Fallback: use the existing error recovery system
    try {
      await resetApplicationState({
        forceReload: true,
        redirectUrl: '/',
        clearCache: true,
        preserveTheme: true
      });
    } catch (fallbackError) {
      console.error('Fallback reset also failed:', fallbackError);
      
      // Last resort: simple page reload
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }
}

/**
 * Check if a page refresh should be allowed
 */
export function shouldAllowRefresh(pageId, isAutomatic = true) {
  // Record the refresh attempt
  const isBlocked = pageRefreshCircuitBreaker.recordRefresh(pageId, isAutomatic);
  
  if (isBlocked) {
    console.warn(`Page refresh blocked for ${pageId} due to circuit breaker`);
    return false;
  }
  
  return true;
}

/**
 * Record successful page load
 */
export function recordSuccessfulLoad(pageId) {
  pageRefreshCircuitBreaker.recordSuccess(pageId);
}

/**
 * Record user activity to reset inactivity timer
 */
export function recordUserActivity(pageId) {
  pageRefreshCircuitBreaker.recordActivity(pageId);
}

/**
 * Check if page is currently blocked
 */
export function isPageBlocked(pageId) {
  return pageRefreshCircuitBreaker.isPageBlocked(pageId);
}

/**
 * Get refresh protection status for debugging
 */
export function getRefreshStatus(pageId) {
  return pageRefreshCircuitBreaker.getStatus(pageId);
}

/**
 * Get all hard reset incidents for debugging
 */
export function getHardResetIncidents() {
  try {
    return JSON.parse(localStorage.getItem('wewrite_hard_reset_incidents') || '[]');
  } catch (error) {
    console.error('Failed to retrieve hard reset incidents:', error);
    return [];
  }
}

/**
 * Clear all hard reset incidents
 */
export function clearHardResetIncidents() {
  try {
    localStorage.removeItem('wewrite_hard_reset_incidents');
    console.log('Cleared all hard reset incidents');
  } catch (error) {
    console.error('Failed to clear hard reset incidents:', error);
  }
}

/**
 * Initialize page refresh protection for a specific page
 */
export function initPageRefreshProtection(pageId) {
  if (typeof window === 'undefined') return;

  // Record initial activity
  recordUserActivity(pageId);

  // Set up activity listeners
  const activityEvents = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'];
  
  const activityHandler = () => {
    recordUserActivity(pageId);
  };

  // Throttle activity recording to avoid excessive calls
  let lastActivityRecord = 0;
  const throttledActivityHandler = () => {
    const now = Date.now();
    if (now - lastActivityRecord > 5000) { // Record activity at most once per 5 seconds
      lastActivityRecord = now;
      activityHandler();
    }
  };

  activityEvents.forEach(event => {
    window.addEventListener(event, throttledActivityHandler, { passive: true });
  });

  console.log(`Page refresh protection initialized for page ${pageId}`);

  // Return cleanup function
  return () => {
    activityEvents.forEach(event => {
      window.removeEventListener(event, throttledActivityHandler);
    });
  };
}
