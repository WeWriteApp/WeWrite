/**
 * Utility functions for error recovery and application state reset
 */

interface ResetOptions {
  resetFunction?: (() => void) | null;
  forceReload?: boolean;
  redirectUrl?: string | null;
  preserveTheme?: boolean;
  clearCache?: boolean;
}

interface ErrorDetails {
  message: string;
  stack: string;
  timestamp: string;
  userAgent: string;
  url: string;
  referrer: string;
}

/**
 * Performs a complete hard reset of the application state
 * - Clears localStorage (preserving theme preference)
 * - Clears sessionStorage
 * - Clears non-essential cookies
 * - Clears browser cache for the current page
 * - Clears service worker caches
 * - Optionally redirects to a specific URL
 * - Optionally forces a full page reload
 */
export const resetApplicationState = async ({
  resetFunction = null,
  forceReload = true,
  redirectUrl = null,
  preserveTheme = true,
  clearCache = true
}: ResetOptions = {}): Promise<void> => {
  console.log("🧹 Starting application state reset...");

  // Clear localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      // Preserve theme preference if requested
      const theme = preserveTheme ? localStorage.getItem('theme') : null;
      const preservedItems: Record<string, string> = {};

      // Optionally preserve other critical items
      if (preserveTheme) {
        ['theme', 'theme-mode'].forEach(key => {
          const value = localStorage.getItem(key);
          if (value) preservedItems[key] = value;
        });
      }

      console.log("🧹 Clearing localStorage...");
      localStorage.clear();

      // Restore preserved items
      Object.entries(preservedItems).forEach(([key, value]) => {
        if (value) localStorage.setItem(key, value);
      });
      console.log("✅ localStorage cleared (preserved theme settings)");
    } catch (e) {
      console.error("❌ Failed to clear localStorage:", e);
    }
  }

  // Clear sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    try {
      console.log("🧹 Clearing sessionStorage...");
      sessionStorage.clear();
      console.log("✅ sessionStorage cleared");
    } catch (e) {
      console.error("❌ Failed to clear sessionStorage:", e);
    }
  }

  // Clear all cookies except essential ones
  if (typeof document !== 'undefined') {
    try {
      console.log("🧹 Clearing non-essential cookies...");
      const cookies = document.cookie.split(";");
      let clearedCount = 0;

      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

        // Skip essential cookies like authentication and security
        const essentialPrefixes = ['__Secure', '__Host', 'next-auth'];
        const isEssential = essentialPrefixes.some(prefix => name.startsWith(prefix));

        if (!isEssential && name) {
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;";
          clearedCount++;
        }
      }
      console.log(`✅ Cleared ${clearedCount} cookies`);
    } catch (e) {
      console.error("❌ Failed to clear cookies:", e);
    }
  }

  // Clear browser cache if supported and requested
  if (clearCache && typeof window !== 'undefined') {
    try {
      console.log("🧹 Attempting to clear browser caches...");

      // Clear service worker caches if available
      if ('caches' in window) {
        console.log("🧹 Clearing service worker caches...");

        // Get all cache names
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            console.log(`🧹 Deleting cache: ${cacheName}`);
            caches.delete(cacheName)
              .then(success => console.log(`${success ? '✅' : '❌'} Cache ${cacheName} ${success ? 'deleted' : 'deletion failed'}`))
              .catch(err => console.error(`❌ Error deleting cache ${cacheName}:`, err));
          });
        }).catch(err => {
          console.error("❌ Error listing caches:", err);
        });
      }

      // Clear application cache if available (deprecated but might still work in some browsers)
      if (typeof window.applicationCache !== 'undefined') {
        try {
          window.applicationCache.swapCache();
          console.log("✅ Application cache swapped");
        } catch (e) {
          console.log("ℹ️ Application cache swap not needed or not supported");
        }
      }

      // Clear fetch cache if supported
      if ('fetch' in window) {
        const clearFetchCache = async () => {
          const url = window.location.href;
          try {
            // Try to use cache: 'reload' option to bypass cache
            await fetch(url, { cache: 'reload', mode: 'no-cors' });
            console.log("✅ Fetch cache bypassed for current page");
          } catch (e) {
            console.log("ℹ️ Fetch cache bypass attempt completed");
          }
        };

        clearFetchCache().catch(e => {
          console.error("❌ Error clearing fetch cache:", e);
        });
      }
    } catch (e) {
      console.error("❌ Error during cache clearing:", e);
    }
  }

  // Reset network requests by aborting any in-progress fetch requests
  if (typeof window !== 'undefined' && window.AbortController) {
    try {
      console.log("🧹 Aborting in-progress network requests...");
      // This is a best-effort attempt to abort any ongoing fetch requests
      // It won't catch all requests, but it's better than nothing
      window.__abortControllers = window.__abortControllers || [];
      window.__abortControllers.forEach(controller => {
        try {
          controller.abort();
        } catch (e) {
          // Ignore errors from already aborted controllers
        }
      });
      window.__abortControllers = [];
      console.log("✅ Network requests aborted");
    } catch (e) {
      console.error("❌ Failed to abort network requests:", e);
    }
  }

  // Call the Next.js reset function if provided
  if (resetFunction && typeof resetFunction === 'function') {
    try {
      console.log("🔄 Calling Next.js reset function...");
      resetFunction();
      console.log("✅ Next.js reset function called");
    } catch (e) {
      console.error("❌ Failed to call reset function:", e);
    }
  }

  // Force a full page reload or redirect after a short delay
  if (forceReload && typeof window !== 'undefined') {
    console.log(`🔄 Preparing for ${redirectUrl ? 'redirect' : 'reload'}...`);
    await new Promise(resolve => setTimeout(resolve, 100));

    if (redirectUrl) {
      console.log(`🔄 Redirecting to ${redirectUrl}...`);
      // Add cache-busting parameter to the URL
      const separator = redirectUrl.includes('?') ? '&' : '?';
      const cacheBuster = `_cb=${Date.now()}`;
      window.location.href = `${redirectUrl}${separator}${cacheBuster}`;
    } else {
      console.log("🔄 Forcing full page reload...");
      // Force reload from server, bypassing cache
      window.location.reload(true);
    }
  } else {
    console.log("✅ Application state reset completed without page reload");
  }
};

/**
 * Formats error details for display or logging
 */
export const formatErrorDetails = (error: Error | any): ErrorDetails => {
  return {
    message: error?.message || "Unknown error",
    stack: error?.stack || "",
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : "Unknown",
    url: typeof window !== 'undefined' ? window.location.href : "Unknown",
    referrer: typeof document !== 'undefined' ? document.referrer : "Unknown"};
};

/**
 * Creates a formatted error text for display or copying
 */
export const createFormattedErrorText = (errorDetails: ErrorDetails): string => {
  return `
Error Details:
-------------
Timestamp: ${errorDetails.timestamp}
URL: ${errorDetails.url}
Referrer: ${errorDetails.referrer}
User Agent: ${errorDetails.userAgent}
Message: ${errorDetails.message}

Stack Trace:
${errorDetails.stack}
  `.trim();
};

/**
 * Copies text to clipboard with comprehensive fallback support
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  try {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback to document.execCommand for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Make the textarea invisible and out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';

    document.body.appendChild(textArea);

    // Select and copy
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    return successful;
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    return false;
  }
};

/**
 * Copies error details to clipboard (legacy function for backward compatibility)
 */
export const copyErrorToClipboard = async (text: string): Promise<boolean> => {
  return copyToClipboard(text);
};