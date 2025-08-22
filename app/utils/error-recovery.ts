"use client";

/**
 * Simple Error Recovery Utilities
 * 
 * Provides basic error recovery functionality.
 * Simplified version focused on essential functionality.
 */

interface ResetOptions {
  resetFunction?: (() => void) | null;
  forceReload?: boolean;
  redirectUrl?: string | null;
  preserveTheme?: boolean;
  clearCache?: boolean;
}

/**
 * Reset application state
 */
export const resetApplicationState = async ({
  resetFunction = null,
  forceReload = true,
  redirectUrl = null,
  preserveTheme = true,
  clearCache = true
}: ResetOptions = {}): Promise<void> => {
  console.log("🧹 Starting application state reset...");
  
  try {
    // Preserve theme if requested
    const theme = preserveTheme ? localStorage.getItem('theme') : null;
    
    // Clear localStorage
    if (clearCache) {
      localStorage.clear();
      if (theme) {
        localStorage.setItem('theme', theme);
      }
    }
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Execute custom reset function
    if (resetFunction) {
      resetFunction();
    }
    
    // Redirect or reload
    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else if (forceReload) {
      window.location.reload();
    }
  } catch (error) {
    console.error('Error during application reset:', error);
    // Fallback: force reload
    window.location.reload();
  }
};

/**
 * Simple error boundary recovery
 */
export const recoverFromError = (error: Error): void => {
  console.error('Recovering from error:', error);
  
  // Simple recovery: clear cache and reload
  resetApplicationState({
    forceReload: true,
    clearCache: true,
    preserveTheme: true
  });
};
