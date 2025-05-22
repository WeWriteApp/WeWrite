/**
 * Global Reload Protection Utility
 * 
 * This module provides a centralized way to prevent infinite refresh loops
 * by tracking and limiting page reloads across the entire application.
 */

const RELOAD_PROTECTION_KEY = 'wewrite_reload_protection';
const MAX_RELOADS_PER_SESSION = 3;
const RESET_TIME_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get current reload protection data
 */
function getReloadData() {
  try {
    const data = localStorage.getItem(RELOAD_PROTECTION_KEY);
    if (!data) return { count: 0, firstReload: 0 };
    
    const parsed = JSON.parse(data);
    return {
      count: parsed.count || 0,
      firstReload: parsed.firstReload || 0
    };
  } catch (error) {
    console.error('Error reading reload protection data:', error);
    return { count: 0, firstReload: 0 };
  }
}

/**
 * Update reload protection data
 */
function setReloadData(count, firstReload) {
  try {
    localStorage.setItem(RELOAD_PROTECTION_KEY, JSON.stringify({
      count,
      firstReload
    }));
  } catch (error) {
    console.error('Error saving reload protection data:', error);
  }
}

/**
 * Check if a reload should be allowed
 */
export function canReload() {
  const now = Date.now();
  const data = getReloadData();
  
  // Reset counter if enough time has passed
  if (data.firstReload && (now - data.firstReload) > RESET_TIME_MS) {
    setReloadData(0, 0);
    return true;
  }
  
  // Check if we've exceeded the limit
  if (data.count >= MAX_RELOADS_PER_SESSION) {
    console.warn('Reload protection: Maximum reloads reached for this session');
    return false;
  }
  
  return true;
}

/**
 * Record a reload attempt
 */
export function recordReload() {
  const now = Date.now();
  const data = getReloadData();
  
  const newCount = data.count + 1;
  const firstReload = data.firstReload || now;
  
  setReloadData(newCount, firstReload);
  
  console.log(`Reload protection: Recorded reload ${newCount}/${MAX_RELOADS_PER_SESSION}`);
  
  return newCount;
}

/**
 * Reset reload protection (for emergency situations)
 */
export function resetReloadProtection() {
  try {
    localStorage.removeItem(RELOAD_PROTECTION_KEY);
    console.log('Reload protection: Reset completed');
  } catch (error) {
    console.error('Error resetting reload protection:', error);
  }
}

/**
 * Safe reload function that respects protection limits
 */
export function safeReload(reason = 'unknown') {
  if (!canReload()) {
    console.error(`Reload protection: Blocked reload attempt (reason: ${reason})`);
    
    // Show user-friendly message
    if (typeof window !== 'undefined') {
      alert('Multiple page reloads detected. Please wait a few minutes before trying again, or contact support if the issue persists.');
    }
    
    return false;
  }
  
  recordReload();
  console.log(`Reload protection: Allowing reload (reason: ${reason})`);
  
  // Use a small delay to ensure logging completes
  setTimeout(() => {
    window.location.reload();
  }, 100);
  
  return true;
}

/**
 * Initialize reload protection on page load
 */
export function initReloadProtection() {
  if (typeof window === 'undefined') return;
  
  try {
    // Override window.location.reload to add protection
    const originalReload = window.location.reload;
    
    window.location.reload = function(forcedReload) {
      console.log('Reload protection: Intercepted reload attempt');
      
      if (!canReload()) {
        console.error('Reload protection: Blocked reload attempt');
        return;
      }
      
      recordReload();
      originalReload.call(this, forcedReload);
    };
    
    console.log('Reload protection: Initialized successfully');
  } catch (error) {
    console.error('Error initializing reload protection:', error);
  }
}

/**
 * Check if we're in a potential infinite loop situation
 */
export function detectPotentialLoop() {
  const data = getReloadData();
  const now = Date.now();
  
  // If we've had multiple reloads in a short time, it might be a loop
  if (data.count >= 2 && data.firstReload && (now - data.firstReload) < 2 * 60 * 1000) {
    return true;
  }
  
  return false;
}

/**
 * Get reload protection status for debugging
 */
export function getReloadStatus() {
  const data = getReloadData();
  const now = Date.now();
  
  return {
    count: data.count,
    maxReloads: MAX_RELOADS_PER_SESSION,
    canReload: canReload(),
    timeUntilReset: data.firstReload ? Math.max(0, RESET_TIME_MS - (now - data.firstReload)) : 0,
    potentialLoop: detectPotentialLoop()
  };
}
