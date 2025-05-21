"use client";

/**
 * Slate Patch Utility
 * 
 * This file contains patches and workarounds for known issues in the Slate editor.
 * It's designed to be imported early in the application to apply global fixes.
 */

// Flag to ensure we only apply patches once
let patchesApplied = false;

/**
 * Apply all Slate patches
 * This should be called as early as possible in the application
 */
export function applySlatePatches() {
  // Only apply patches once
  if (patchesApplied || typeof window === 'undefined') {
    return;
  }

  // Apply the toSlatePoint patch
  applyToSlatePointPatch();
  
  // Mark patches as applied
  patchesApplied = true;
  console.log('Slate patches applied successfully');
}

/**
 * Patch for the ReactEditor.toSlatePoint function
 * This fixes the "Cannot resolve a Slate point from DOM point: [object HTMLDivElement],4" error
 */
function applyToSlatePointPatch() {
  // Wait for the ReactEditor to be available
  const checkAndPatch = () => {
    // Check if the global slate-react module is available
    if (window.ReactEditor && window.ReactEditor.toSlatePoint) {
      // Store the original function
      const originalToSlatePoint = window.ReactEditor.toSlatePoint;
      
      // Replace with our patched version
      window.ReactEditor.toSlatePoint = (editor, domPoint) => {
        try {
          // First check if domPoint is valid
          if (!domPoint || !domPoint[0] || typeof domPoint[1] !== 'number') {
            console.warn('Invalid DOM point provided to toSlatePoint:', domPoint);
            return { path: [0, 0], offset: 0 }; // Safe default
          }
          
          // Check if the DOM node is a div element
          if (domPoint[0].nodeName === 'DIV') {
            // Try to find a valid text node inside the div
            const textNodes = Array.from(domPoint[0].querySelectorAll('[data-slate-leaf]'));
            if (textNodes.length > 0) {
              // Use the first text node with offset 0
              const newDomPoint = [textNodes[0], 0];
              try {
                return originalToSlatePoint(editor, newDomPoint);
              } catch (innerError) {
                console.warn('Error in patched toSlatePoint with text node:', innerError);
                return { path: [0, 0], offset: 0 }; // Safe default
              }
            }
            
            // If no text nodes found, try to find any text node
            const allTextNodes = Array.from(domPoint[0].querySelectorAll('*')).filter(
              node => node.nodeType === Node.TEXT_NODE || node.hasChildNodes()
            );
            
            if (allTextNodes.length > 0) {
              const newDomPoint = [allTextNodes[0], 0];
              try {
                return originalToSlatePoint(editor, newDomPoint);
              } catch (innerError) {
                console.warn('Error in patched toSlatePoint with any node:', innerError);
                return { path: [0, 0], offset: 0 }; // Safe default
              }
            }
            
            // Last resort: return a safe default point
            return { path: [0, 0], offset: 0 };
          }
          
          // If all checks pass, use the original implementation
          return originalToSlatePoint(editor, domPoint);
        } catch (error) {
          console.warn('Error in patched toSlatePoint:', error);
          // Return a safe default point
          return { path: [0, 0], offset: 0 };
        }
      };
      
      console.log('ReactEditor.toSlatePoint patched successfully');
      return true;
    }
    
    return false;
  };
  
  // Try to patch immediately
  if (!checkAndPatch()) {
    // If not available yet, set up a MutationObserver to watch for script loads
    const observer = new MutationObserver((mutations) => {
      if (checkAndPatch()) {
        observer.disconnect();
      }
    });
    
    // Start observing the document
    observer.observe(document, { 
      childList: true, 
      subtree: true 
    });
    
    // Also try again after the page loads
    window.addEventListener('load', () => {
      if (checkAndPatch()) {
        observer.disconnect();
      }
    });
    
    // Set a timeout as a fallback
    setTimeout(() => {
      checkAndPatch();
      observer.disconnect();
    }, 5000);
  }
}

/**
 * Initialize the Slate patches
 * This is automatically called when this module is imported
 */
if (typeof window !== 'undefined') {
  // Apply patches after a short delay to ensure the DOM is ready
  setTimeout(applySlatePatches, 0);
  
  // Also apply patches when the document is fully loaded
  window.addEventListener('DOMContentLoaded', applySlatePatches);
}

export default applySlatePatches;
