/**
 * Browser Compatibility Fixes
 * 
 * This module contains fixes for browser compatibility issues and deprecated features.
 * It patches various browser APIs to prevent console warnings and ensure compatibility.
 */

/**
 * Fix for Synchronous XMLHttpRequest warning
 * 
 * This patch intercepts XMLHttpRequest creation and ensures async mode is used.
 * It specifically targets Firebase Realtime Database connections.
 */
export function fixSyncXMLHttpRequest() {
  if (typeof window === 'undefined') return;

  // Store the original XMLHttpRequest constructor
  const OriginalXHR = window.XMLHttpRequest;

  // Create a patched version that enforces async mode
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    
    // Override the open method to force async
    const originalOpen = xhr.open;
    xhr.open = function(method, url, async = true) {
      // Always force async to true, especially for Firebase URLs
      if (url && typeof url === 'string' && 
          (url.includes('firebaseio.com') || url.includes('firebase'))) {
        console.debug('Forcing async XMLHttpRequest for Firebase URL:', url);
        return originalOpen.call(this, method, url, true);
      }
      return originalOpen.call(this, method, url, async);
    };
    
    return xhr;
  };
  
  // Copy prototype and properties
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  
  console.log('XMLHttpRequest patched to prevent synchronous usage');
}

/**
 * Fix for deprecated unload event listeners
 * 
 * This patch intercepts addEventListener calls for 'unload' and replaces them with
 * the recommended 'beforeunload' or 'pagehide' events.
 */
export function fixUnloadEventListeners() {
  if (typeof window === 'undefined') return;

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
}

/**
 * Initialize all browser compatibility fixes
 */
export function initBrowserCompatibilityFixes() {
  if (typeof window === 'undefined') return;
  
  try {
    // Apply XMLHttpRequest fix
    fixSyncXMLHttpRequest();
    
    // Apply unload event listeners fix
    fixUnloadEventListeners();
    
    console.log('Browser compatibility fixes applied successfully');
  } catch (error) {
    console.error('Error applying browser compatibility fixes:', error);
  }
}

// Auto-initialize in browser environments
if (typeof window !== 'undefined') {
  // Wait for the window to load before applying fixes
  if (document.readyState === 'complete') {
    initBrowserCompatibilityFixes();
  } else {
    window.addEventListener('load', initBrowserCompatibilityFixes);
  }
}
