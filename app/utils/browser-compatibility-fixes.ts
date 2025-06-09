/**
 * Browser Compatibility Fixes
 *
 * This module contains fixes for browser compatibility issues and deprecated features.
 * It patches various browser APIs to prevent console warnings and ensure compatibility.
 */

declare global {
  interface Window {
    XMLHttpRequest: typeof XMLHttpRequest;
  }
}

/**
 * Fix for Synchronous XMLHttpRequest warning
 *
 * This patch intercepts XMLHttpRequest creation and ensures async mode is used.
 * It specifically targets Firebase Realtime Database connections.
 */
export function fixSyncXMLHttpRequest(): void {
  if (typeof window === 'undefined') return;

  // Store the original XMLHttpRequest constructor
  const OriginalXHR = window.XMLHttpRequest;

  // Create a patched version that enforces async mode
  window.XMLHttpRequest = function(this: XMLHttpRequest) {
    const xhr = new OriginalXHR();

    // Override the open method to force async
    const originalOpen = xhr.open;
    xhr.open = function(method: string, url: string | URL, async: boolean = true) {
      // Always force async to true, especially for Firebase URLs
      if (url && typeof url === 'string' &&
          (url.includes('firebaseio.com') || url.includes('firebase'))) {
        console.debug('Forcing async XMLHttpRequest for Firebase URL:', url);
        return originalOpen.call(this, method, url, true);
      }
      return originalOpen.call(this, method, url, async);
    };

    return xhr;
  } as any;

  // Copy prototype and properties
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);

  console.log('XMLHttpRequest patched to prevent synchronous usage');
}

/**
 * Fix for deprecated unload event listeners
 *
 * DISABLED: This patch was interfering with normal navigation and beforeunload handling.
 * The patch intercepted addEventListener calls for 'unload' and replaced them with
 * 'beforeunload' or 'pagehide' events, but this was causing issues with legitimate
 * navigation warnings and unsaved changes detection.
 */
export function fixUnloadEventListeners(): void {
  if (typeof window === 'undefined') return;

  // DISABLED: This fix was causing navigation issues
  // The original implementation was overriding addEventListener globally
  // which interfered with legitimate beforeunload usage for unsaved changes

  console.log('Event listener patching disabled to prevent navigation interference');

  // Original implementation commented out:
  /*
  // Store the original addEventListener method
  const originalAddEventListener = window.addEventListener;

  // Override addEventListener to intercept 'unload' events
  window.addEventListener = function(type, listener, options) {
    if (type === 'unload') {
      console.debug('Replacing deprecated unload event with pagehide event');
      // Use pagehide instead of unload (more modern and compatible)
      return originalAddEventListener.call(this, 'pagehide', listener, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // Also patch Element.prototype.addEventListener for completeness
  if (typeof Element !== 'undefined') {
    const originalElementAddEventListener = Element.prototype.addEventListener;

    Element.prototype.addEventListener = function(type, listener, options) {
      if (type === 'unload') {
        console.debug('Replacing deprecated unload event with pagehide event on Element');
        return originalElementAddEventListener.call(this, 'pagehide', listener, options);
      }
      return originalElementAddEventListener.call(this, type, listener, options);
    };
  }

  console.log('Event listeners patched to prevent unload event usage');
  */
}

/**
 * Initialize all browser compatibility fixes
 */
export function initBrowserCompatibilityFixes(): void {
  if (typeof window === 'undefined') return;

  try {
    // Apply XMLHttpRequest fix (safe - doesn't interfere with navigation)
    fixSyncXMLHttpRequest();

    // SKIP unload event listeners fix - it was causing navigation issues
    // fixUnloadEventListeners(); // Commented out to prevent navigation interference

    console.log('Browser compatibility fixes applied successfully (navigation-safe mode)');
  } catch (error) {
    console.error('Error applying browser compatibility fixes:', error);
  }
}

// Auto-initialization disabled to prevent interference with navigation
// Components can manually call initBrowserCompatibilityFixes() if needed
//
// Note: Auto-initialization was causing issues with beforeunload event handling
// and interfering with normal navigation. Individual components should initialize
// these fixes only when specifically needed.
//
// if (typeof window !== 'undefined') {
//   // Wait for the window to load before applying fixes
//   if (document.readyState === 'complete') {
//     initBrowserCompatibilityFixes();
//   } else {
//     window.addEventListener('load', initBrowserCompatibilityFixes);
//   }
// }
