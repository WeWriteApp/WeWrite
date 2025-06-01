"use client";

/**
 * Infinite Refresh Loop Debugger and Prevention System
 * 
 * This utility helps detect, debug, and prevent infinite page refresh loops
 * by monitoring page load patterns, navigation events, and potential triggers.
 */

const DEBUG_KEY = 'wewrite_refresh_debug';
const REFRESH_HISTORY_KEY = 'wewrite_refresh_history';
const MAX_REFRESHES_PER_MINUTE = 3;
const MAX_REFRESHES_PER_SESSION = 5;
const DETECTION_WINDOW_MS = 60000; // 1 minute

/**
 * Initialize the infinite refresh debugger
 */
export function initializeRefreshDebugger() {
  if (typeof window === 'undefined') return;

  console.log('🔍 Infinite Refresh Debugger: Initializing...');

  // Record this page load
  recordPageLoad();

  // Check for potential infinite refresh patterns
  const refreshHistory = getRefreshHistory();
  const recentRefreshes = getRecentRefreshes(refreshHistory);

  if (recentRefreshes.length >= MAX_REFRESHES_PER_MINUTE) {
    console.error('🚨 INFINITE REFRESH DETECTED!');
    console.error('Recent refreshes:', recentRefreshes);
    
    // Prevent further refreshes
    preventAllRefreshes();
    
    // Show user notification
    showInfiniteRefreshWarning();
    
    return false; // Indicate that refresh loop was detected
  }

  // Set up monitoring
  setupRefreshMonitoring();
  setupNavigationMonitoring();
  setupAuthStateMonitoring();
  setupErrorMonitoring();

  return true; // Normal initialization
}

/**
 * Record a page load event
 */
function recordPageLoad() {
  const now = Date.now();
  const loadEvent = {
    timestamp: now,
    url: window.location.href,
    userAgent: navigator.userAgent,
    referrer: document.referrer,
    loadType: getLoadType()
  };

  // Get existing history
  const history = getRefreshHistory();
  history.push(loadEvent);

  // Keep only recent events (last 24 hours)
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const filteredHistory = history.filter(event => event.timestamp > oneDayAgo);

  // Save updated history
  try {
    localStorage.setItem(REFRESH_HISTORY_KEY, JSON.stringify(filteredHistory));
  } catch (error) {
    console.warn('Could not save refresh history:', error);
  }

  console.log('📊 Page load recorded:', loadEvent);
}

/**
 * Get refresh history from localStorage
 */
function getRefreshHistory() {
  try {
    const historyJson = localStorage.getItem(REFRESH_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.warn('Could not parse refresh history:', error);
    return [];
  }
}

/**
 * Get recent refreshes within the detection window
 */
function getRecentRefreshes(history) {
  const now = Date.now();
  const windowStart = now - DETECTION_WINDOW_MS;
  
  return history.filter(event => 
    event.timestamp > windowStart && 
    event.url === window.location.href
  );
}

/**
 * Determine the type of page load
 */
function getLoadType() {
  if (performance.navigation) {
    switch (performance.navigation.type) {
      case 0: return 'navigate';
      case 1: return 'reload';
      case 2: return 'back_forward';
      default: return 'unknown';
    }
  }
  
  // Fallback for newer browsers
  if (performance.getEntriesByType) {
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      return navEntries[0].type || 'unknown';
    }
  }
  
  return 'unknown';
}

/**
 * Prevent all types of page refreshes
 */
function preventAllRefreshes() {
  console.log('🛡️ Preventing all refresh mechanisms...');

  // Override window.location.reload using a safer approach
  try {
    Object.defineProperty(window.location, 'reload', {
      value: function() {
        console.error('🚫 Blocked window.location.reload() - infinite refresh protection');
        return false;
      },
      writable: false,
      configurable: true
    });
  } catch (error) {
    console.warn('⚠️ Cannot override window.location.reload (read-only), using alternative prevention methods');
  }

  // Override window.location.href setter for same-page refreshes
  let currentHref = window.location.href;
  Object.defineProperty(window.location, 'href', {
    get: () => currentHref,
    set: (value) => {
      if (value === currentHref) {
        console.error('🚫 Blocked same-page navigation - infinite refresh protection');
        return;
      }
      currentHref = value;
      window.location.assign(value);
    }
  });

  // Block keyboard shortcuts
  window.addEventListener('keydown', function(event) {
    if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
      console.error('🚫 Blocked keyboard refresh - infinite refresh protection');
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);

  // Block beforeunload refreshes
  window.addEventListener('beforeunload', function(event) {
    console.error('🚫 Blocked beforeunload refresh - infinite refresh protection');
    event.preventDefault();
    event.returnValue = '';
    return '';
  });

  // Set a flag to indicate refresh prevention is active
  sessionStorage.setItem('refresh_prevention_active', 'true');
}

/**
 * Show warning to user about infinite refresh
 */
function showInfiniteRefreshWarning() {
  // Create a modal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 10px;
    max-width: 500px;
    margin: 20px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  `;

  modal.innerHTML = `
    <h2 style="color: #dc3545; margin-bottom: 20px;">⚠️ Infinite Refresh Detected</h2>
    <p style="margin-bottom: 20px; line-height: 1.5;">
      We've detected multiple page refreshes in a short time period. 
      To prevent an infinite refresh loop, automatic page refreshes have been disabled.
    </p>
    <p style="margin-bottom: 30px; font-size: 14px; color: #666;">
      This is likely due to a temporary issue. Please try:
    </p>
    <div style="text-align: left; margin-bottom: 30px;">
      <ul style="padding-left: 20px;">
        <li>Waiting a few minutes</li>
        <li>Clearing your browser cache</li>
        <li>Trying a different browser</li>
        <li>Contacting support if the issue persists</li>
      </ul>
    </div>
    <button id="dismissWarning" style="
      background: #007bff;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      margin-right: 10px;
    ">Continue Anyway</button>
    <button id="clearData" style="
      background: #dc3545;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
    ">Clear Data & Retry</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Handle dismiss button
  document.getElementById('dismissWarning').onclick = () => {
    overlay.remove();
  };

  // Handle clear data button
  document.getElementById('clearData').onclick = () => {
    // Clear all relevant localStorage and sessionStorage
    localStorage.removeItem(REFRESH_HISTORY_KEY);
    localStorage.removeItem('blankPageReloadCount');
    localStorage.removeItem('authState');
    sessionStorage.clear();
    
    // Navigate to home page
    window.location.href = '/';
  };
}

/**
 * Set up refresh monitoring
 */
function setupRefreshMonitoring() {
  // Monitor for programmatic reloads using a safer approach
  // Since window.location.reload is read-only in modern browsers, we'll use event monitoring instead

  // Store original reload function reference
  const originalReload = window.location.reload.bind(window.location);

  // Override reload using Object.defineProperty (safer approach)
  try {
    Object.defineProperty(window.location, 'reload', {
      value: function(...args) {
        console.warn('🔄 Programmatic reload detected:', new Error().stack);

        // Check if we should allow this reload
        const recentRefreshes = getRecentRefreshes(getRefreshHistory());
        if (recentRefreshes.length >= MAX_REFRESHES_PER_MINUTE) {
          console.error('🚫 Blocking programmatic reload - too many recent refreshes');
          return false;
        }

        return originalReload.apply(this, args);
      },
      writable: false,
      configurable: true
    });
  } catch (error) {
    // If we can't override reload, just log the attempt
    console.warn('⚠️ Cannot override window.location.reload (read-only), using fallback monitoring');

    // Fallback: Monitor beforeunload events instead
    window.addEventListener('beforeunload', function(event) {
      const recentRefreshes = getRecentRefreshes(getRefreshHistory());
      if (recentRefreshes.length >= MAX_REFRESHES_PER_MINUTE) {
        console.warn('🔄 Potential refresh detected via beforeunload');
        // Note: We can't actually prevent the reload here, but we can log it
      }
    });
  }
}

/**
 * Set up navigation monitoring
 */
function setupNavigationMonitoring() {
  // Monitor for navigation events that might cause refreshes
  window.addEventListener('popstate', (event) => {
    console.log('📍 Navigation event (popstate):', event);
  });

  // Monitor for hash changes
  window.addEventListener('hashchange', (event) => {
    console.log('📍 Hash change event:', event);
  });
}

/**
 * Set up authentication state monitoring
 */
function setupAuthStateMonitoring() {
  // Monitor localStorage changes that might trigger auth redirects
  window.addEventListener('storage', (event) => {
    if (event.key && event.key.includes('auth')) {
      console.log('🔐 Auth-related storage change:', {
        key: event.key,
        oldValue: event.oldValue,
        newValue: event.newValue
      });
    }
  });
}

/**
 * Set up error monitoring
 */
function setupErrorMonitoring() {
  // Monitor for JavaScript errors that might trigger reloads
  window.addEventListener('error', (event) => {
    console.log('❌ JavaScript error detected:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  });

  // Monitor for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.log('❌ Unhandled promise rejection:', event.reason);
  });
}

/**
 * Get debug information for support
 */
export function getDebugInfo() {
  const refreshHistory = getRefreshHistory();
  const recentRefreshes = getRecentRefreshes(refreshHistory);
  
  return {
    refreshHistory,
    recentRefreshes,
    currentUrl: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    localStorage: Object.keys(localStorage),
    sessionStorage: Object.keys(sessionStorage),
    refreshPreventionActive: sessionStorage.getItem('refresh_prevention_active') === 'true'
  };
}

/**
 * Export debug info as downloadable file
 */
export function exportDebugInfo() {
  const debugInfo = getDebugInfo();
  const blob = new Blob([JSON.stringify(debugInfo, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `wewrite-refresh-debug-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}
