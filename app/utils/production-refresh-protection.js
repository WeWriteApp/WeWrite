"use client";

/**
 * Production-Ready Infinite Refresh Protection System
 * 
 * This is a comprehensive system to prevent infinite page refresh loops
 * in production environments. It includes multiple layers of protection
 * and user-friendly error handling.
 */

const REFRESH_PROTECTION_KEY = 'wewrite_refresh_protection_v2';
const MAX_REFRESHES_PER_MINUTE = 2;
const MAX_REFRESHES_PER_SESSION = 3;
const DETECTION_WINDOW_MS = 60000; // 1 minute
const SESSION_RESET_TIME_MS = 300000; // 5 minutes

let isProtectionActive = false;
let protectionStartTime = 0;

/**
 * Get refresh history from localStorage
 */
function getRefreshHistory() {
  try {
    const historyJson = localStorage.getItem(REFRESH_PROTECTION_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.warn('Could not parse refresh history:', error);
    return [];
  }
}

/**
 * Save refresh history to localStorage
 */
function saveRefreshHistory(history) {
  try {
    // Keep only recent events (last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(event => event.timestamp > oneDayAgo);
    localStorage.setItem(REFRESH_PROTECTION_KEY, JSON.stringify(filteredHistory));
  } catch (error) {
    console.warn('Could not save refresh history:', error);
  }
}

/**
 * Record a page load/refresh event
 */
function recordPageEvent(type = 'page_load') {
  const now = Date.now();
  const history = getRefreshHistory();
  
  const event = {
    timestamp: now,
    url: window.location.href,
    type: type,
    userAgent: navigator.userAgent,
    referrer: document.referrer
  };
  
  history.push(event);
  saveRefreshHistory(history);
  
  return event;
}

/**
 * Get recent refresh events within the detection window
 */
function getRecentRefreshes() {
  const history = getRefreshHistory();
  const now = Date.now();
  const windowStart = now - DETECTION_WINDOW_MS;
  
  return history.filter(event => 
    event.timestamp > windowStart && 
    event.url === window.location.href &&
    (event.type === 'page_reload' || event.type === 'blank_page_reload')
  );
}

/**
 * Check if we're in an infinite refresh loop
 */
function detectInfiniteRefresh() {
  const recentRefreshes = getRecentRefreshes();
  
  // Check for too many refreshes in a short time
  if (recentRefreshes.length >= MAX_REFRESHES_PER_MINUTE) {
    return {
      detected: true,
      reason: 'too_many_refreshes',
      count: recentRefreshes.length,
      timeWindow: DETECTION_WINDOW_MS / 1000
    };
  }
  
  // Check for session-based refresh limit
  const history = getRefreshHistory();
  const sessionStart = Date.now() - SESSION_RESET_TIME_MS;
  const sessionRefreshes = history.filter(event => 
    event.timestamp > sessionStart &&
    event.url === window.location.href &&
    (event.type === 'page_reload' || event.type === 'blank_page_reload')
  );
  
  if (sessionRefreshes.length >= MAX_REFRESHES_PER_SESSION) {
    return {
      detected: true,
      reason: 'session_limit_exceeded',
      count: sessionRefreshes.length,
      sessionDuration: SESSION_RESET_TIME_MS / 1000
    };
  }
  
  return { detected: false };
}

/**
 * Activate infinite refresh protection
 */
function activateProtection(reason) {
  if (isProtectionActive) return;
  
  isProtectionActive = true;
  protectionStartTime = Date.now();
  
  console.error('🚨 INFINITE REFRESH PROTECTION ACTIVATED:', reason);
  
  // Set session flag
  sessionStorage.setItem('refresh_protection_active', 'true');
  sessionStorage.setItem('refresh_protection_reason', JSON.stringify(reason));
  
  // Override window.location.reload
  const originalReload = window.location.reload;
  window.location.reload = function() {
    console.error('🚫 Blocked window.location.reload() - infinite refresh protection active');
    showProtectionNotification();
    return false;
  };
  
  // Block keyboard shortcuts
  const blockKeyboardRefresh = (event) => {
    if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
      console.error('🚫 Blocked keyboard refresh - infinite refresh protection active');
      event.preventDefault();
      event.stopPropagation();
      showProtectionNotification();
      return false;
    }
  };
  
  document.addEventListener('keydown', blockKeyboardRefresh, true);
  
  // Block beforeunload refreshes
  const blockBeforeUnload = (event) => {
    console.error('🚫 Blocked beforeunload refresh - infinite refresh protection active');
    event.preventDefault();
    event.returnValue = 'Refresh protection is active to prevent infinite loops.';
    return 'Refresh protection is active to prevent infinite loops.';
  };
  
  window.addEventListener('beforeunload', blockBeforeUnload);
  
  // Show user notification
  showProtectionNotification();
  
  // Store cleanup functions
  window._refreshProtectionCleanup = () => {
    document.removeEventListener('keydown', blockKeyboardRefresh, true);
    window.removeEventListener('beforeunload', blockBeforeUnload);
    window.location.reload = originalReload;
  };
}

/**
 * Show user-friendly protection notification
 */
function showProtectionNotification() {
  // Remove any existing notification
  const existingNotification = document.getElementById('refresh-protection-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification overlay
  const overlay = document.createElement('div');
  overlay.id = 'refresh-protection-notification';
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
  
  const reason = JSON.parse(sessionStorage.getItem('refresh_protection_reason') || '{}');
  
  modal.innerHTML = `
    <div style="color: #dc3545; font-size: 48px; margin-bottom: 20px;">🛡️</div>
    <h2 style="color: #dc3545; margin-bottom: 20px;">Refresh Protection Active</h2>
    <p style="margin-bottom: 20px; line-height: 1.5; color: #333;">
      We've detected ${reason.count || 'multiple'} page refreshes in a short time period. 
      To prevent an infinite refresh loop, automatic page refreshes have been disabled.
    </p>
    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 14px; color: #666;">
        <strong>What happened?</strong><br>
        This protection activates when we detect unusual refresh patterns that could indicate a technical issue.
      </p>
    </div>
    <p style="margin-bottom: 30px; font-size: 14px; color: #666;">
      You can try these solutions:
    </p>
    <div style="text-align: left; margin-bottom: 30px;">
      <ul style="padding-left: 20px; color: #333;">
        <li style="margin-bottom: 8px;">Wait a few minutes for the protection to reset automatically</li>
        <li style="margin-bottom: 8px;">Clear your browser cache and cookies</li>
        <li style="margin-bottom: 8px;">Try using a different browser or incognito mode</li>
        <li style="margin-bottom: 8px;">Check your internet connection</li>
        <li style="margin-bottom: 8px;">Contact support if the issue persists</li>
      </ul>
    </div>
    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
      <button id="dismissProtection" style="
        background: #007bff;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
      ">Continue Anyway</button>
      <button id="clearDataAndRetry" style="
        background: #28a745;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
      ">Clear Data & Retry</button>
      <button id="contactSupport" style="
        background: #6c757d;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
      ">Contact Support</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Handle button clicks
  document.getElementById('dismissProtection').onclick = () => {
    overlay.remove();
  };
  
  document.getElementById('clearDataAndRetry').onclick = () => {
    // Clear all relevant data
    localStorage.removeItem(REFRESH_PROTECTION_KEY);
    localStorage.removeItem('blankPageReloadCount');
    localStorage.removeItem('wewrite_refresh_history');
    sessionStorage.clear();
    
    // Navigate to home page
    window.location.href = '/';
  };
  
  document.getElementById('contactSupport').onclick = () => {
    // Open support email with debug info
    const debugInfo = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      reason: reason,
      refreshHistory: getRefreshHistory().slice(-10) // Last 10 events
    };
    
    const subject = encodeURIComponent('WeWrite: Infinite Refresh Protection Activated');
    const body = encodeURIComponent(`Hi WeWrite Support,

I encountered an infinite refresh protection issue. Here are the details:

${JSON.stringify(debugInfo, null, 2)}

Please help me resolve this issue.

Thank you!`);
    
    window.open(`mailto:support@wewrite.app?subject=${subject}&body=${body}`);
  };
}

/**
 * Initialize production refresh protection
 */
export function initializeProductionRefreshProtection() {
  if (typeof window === 'undefined') return;
  
  console.log('🛡️ Initializing production refresh protection...');
  
  // Record this page load
  recordPageEvent('page_load');
  
  // Check for infinite refresh pattern
  const detection = detectInfiniteRefresh();
  
  if (detection.detected) {
    activateProtection(detection);
    return false; // Indicate that protection was activated
  }
  
  // Set up monitoring for future refresh attempts
  setupRefreshMonitoring();
  
  return true; // Normal initialization
}

/**
 * Set up monitoring for refresh attempts
 */
function setupRefreshMonitoring() {
  // Monitor for programmatic reloads
  const originalReload = window.location.reload;
  window.location.reload = function(...args) {
    console.log('🔄 Programmatic reload detected');
    
    recordPageEvent('page_reload');
    
    // Check if this would trigger protection
    const detection = detectInfiniteRefresh();
    if (detection.detected) {
      activateProtection(detection);
      return false;
    }
    
    return originalReload.apply(this, args);
  };
}

/**
 * Check if protection is currently active
 */
export function isRefreshProtectionActive() {
  return isProtectionActive || sessionStorage.getItem('refresh_protection_active') === 'true';
}

/**
 * Manually reset protection (for emergency use)
 */
export function resetRefreshProtection() {
  console.log('🔄 Manually resetting refresh protection...');
  
  isProtectionActive = false;
  protectionStartTime = 0;
  
  // Clear session flags
  sessionStorage.removeItem('refresh_protection_active');
  sessionStorage.removeItem('refresh_protection_reason');
  
  // Clear history
  localStorage.removeItem(REFRESH_PROTECTION_KEY);
  
  // Clean up event listeners if they exist
  if (window._refreshProtectionCleanup) {
    window._refreshProtectionCleanup();
    delete window._refreshProtectionCleanup;
  }
  
  // Remove notification if present
  const notification = document.getElementById('refresh-protection-notification');
  if (notification) {
    notification.remove();
  }
}

/**
 * Get protection status for debugging
 */
export function getProtectionStatus() {
  const history = getRefreshHistory();
  const recentRefreshes = getRecentRefreshes();
  
  return {
    isActive: isProtectionActive,
    protectionStartTime,
    recentRefreshes: recentRefreshes.length,
    totalHistory: history.length,
    lastEvent: history[history.length - 1],
    sessionActive: sessionStorage.getItem('refresh_protection_active') === 'true'
  };
}
