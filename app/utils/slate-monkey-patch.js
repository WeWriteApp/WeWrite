"use client";

/**
 * Direct monkey patch for Slate's ReactEditor.toSlatePoint function
 * 
 * This file applies a direct patch to the Slate library's ReactEditor.toSlatePoint function
 * to fix the "Cannot resolve a Slate point from DOM point: [object HTMLDivElement],4" error.
 * 
 * It works by intercepting the global ReactEditor object and replacing the problematic function
 * with a patched version that handles the error case.
 */

// Flag to track if the patch has been applied
let isPatchApplied = false;

/**
 * Apply the monkey patch to ReactEditor.toSlatePoint
 */
export function applyMonkeyPatch() {
  // Only run on the client
  if (typeof window === 'undefined') {
    return;
  }
  
  // Only apply once
  if (isPatchApplied) {
    return;
  }
  
  // Function to apply the patch
  const patchSlate = () => {
    try {
      // Check if the slate-react module has been loaded
      if (!window.ReactEditor) {
        // Create a getter to intercept when ReactEditor is defined
        let originalReactEditor = null;
        Object.defineProperty(window, 'ReactEditor', {
          get: function() {
            return originalReactEditor;
          },
          set: function(newValue) {
            // Store the original value
            originalReactEditor = newValue;
            
            // If toSlatePoint exists, patch it
            if (originalReactEditor && originalReactEditor.toSlatePoint) {
              patchToSlatePoint(originalReactEditor);
            }
            
            return true;
          },
          configurable: true
        });
        
        return false;
      }
      
      // If ReactEditor is already defined, patch it directly
      if (window.ReactEditor && window.ReactEditor.toSlatePoint) {
        patchToSlatePoint(window.ReactEditor);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error applying Slate monkey patch:', error);
      return false;
    }
  };
  
  // Function to patch the toSlatePoint method
  const patchToSlatePoint = (ReactEditor) => {
    // Store the original function
    const originalToSlatePoint = ReactEditor.toSlatePoint;
    
    // Replace with our patched version
    ReactEditor.toSlatePoint = function(editor, domPoint) {
      try {
        // Check if domPoint is valid
        if (!domPoint || !Array.isArray(domPoint) || domPoint.length !== 2) {
          console.warn('Invalid domPoint:', domPoint);
          return { path: [0, 0], offset: 0 };
        }
        
        const [node, offset] = domPoint;
        
        // Handle the specific error case
        if (node && node.nodeName === 'DIV') {
          // Try to find a text node
          const textNodes = Array.from(node.querySelectorAll('[data-slate-leaf]'));
          if (textNodes.length > 0) {
            // Use the first text node
            return originalToSlatePoint.call(this, editor, [textNodes[0], 0]);
          }
          
          // If no text nodes, return a safe default
          return { path: [0, 0], offset: 0 };
        }
        
        // Call the original function for normal cases
        return originalToSlatePoint.call(this, editor, domPoint);
      } catch (error) {
        console.warn('Error in patched toSlatePoint:', error);
        // Return a safe default
        return { path: [0, 0], offset: 0 };
      }
    };
    
    console.log('ReactEditor.toSlatePoint successfully monkey patched');
    isPatchApplied = true;
  };
  
  // Try to apply the patch immediately
  if (!patchSlate()) {
    // If not successful, try again when the DOM is loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', patchSlate);
    } else {
      // If DOM is already loaded, try again after a short delay
      setTimeout(patchSlate, 100);
    }
    
    // Also try when the window is fully loaded
    window.addEventListener('load', patchSlate);
    
    // Set up a MutationObserver to detect when scripts are added
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeName === 'SCRIPT') {
              // When a script is added, check if we can apply the patch
              if (patchSlate()) {
                observer.disconnect();
                break;
              }
            }
          }
        }
      }
    });
    
    // Start observing
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    
    // Set a timeout to disconnect the observer after a reasonable time
    setTimeout(() => {
      observer.disconnect();
    }, 10000);
  }
}

// Apply the patch when this module is imported
applyMonkeyPatch();

export default applyMonkeyPatch;
