/**
 * Error Recovery Utilities
 *
 * Provides functions to help recover from application errors
 * by resetting application state and optionally reloading.
 */

interface ResetOptions {
  /** Whether to force a page reload after resetting state */
  forceReload?: boolean;
  /** Whether to preserve theme settings during reset */
  preserveTheme?: boolean;
}

/**
 * Reset application state to help recover from errors
 *
 * @param options - Configuration options for the reset
 * @returns Promise that resolves when reset is complete
 */
export async function resetApplicationState(options: ResetOptions = {}): Promise<void> {
  const { forceReload = false, preserveTheme = true } = options;

  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Preserve theme if requested
    let savedTheme: string | null = null;
    if (preserveTheme) {
      savedTheme = localStorage.getItem('theme');
    }

    // Clear React Query cache if available
    if (typeof window !== 'undefined' && (window as any).__REACT_QUERY_CLIENT__) {
      try {
        (window as any).__REACT_QUERY_CLIENT__.clear();
      } catch (e) {
        console.warn('Failed to clear React Query cache:', e);
      }
    }

    // Clear any stale error states from localStorage
    const keysToRemove = [
      'wewrite_error_state',
      'wewrite_last_error',
    ];

    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore storage errors
      }
    });

    // Restore theme if it was preserved
    if (preserveTheme && savedTheme) {
      localStorage.setItem('theme', savedTheme);
    }

    // Force reload if requested
    if (forceReload) {
      window.location.reload();
    }
  } catch (error) {
    console.error('Error during application state reset:', error);
    // If reset fails, try a simple reload as fallback
    if (forceReload) {
      window.location.reload();
    }
  }
}

/**
 * Check if the application is in an error state
 */
export function isInErrorState(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return localStorage.getItem('wewrite_error_state') === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark the application as being in an error state
 */
export function setErrorState(inError: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (inError) {
      localStorage.setItem('wewrite_error_state', 'true');
    } else {
      localStorage.removeItem('wewrite_error_state');
    }
  } catch {
    // Ignore storage errors
  }
}
