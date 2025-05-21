"use client";

import Script from 'next/script';

/**
 * SlateEarlyPatch Component
 * 
 * This component injects a script into the document head that applies
 * a patch to the Slate editor's ReactEditor.toSlatePoint function as early as possible.
 * 
 * The script is executed before any other JavaScript, ensuring that the patch
 * is applied before Slate is initialized.
 */
export default function SlateEarlyPatch() {
  // The inline script to patch Slate's ReactEditor.toSlatePoint function
  const patchScript = `
    (function() {
      // Flag to track if the patch has been applied
      window.__slatePatchApplied = false;
      
      // Function to apply the patch
      function patchSlateReactEditor() {
        if (window.__slatePatchApplied) return;
        
        try {
          // Check if ReactEditor is available
          if (window.ReactEditor && window.ReactEditor.toSlatePoint) {
            // Store the original function
            var originalToSlatePoint = window.ReactEditor.toSlatePoint;
            
            // Replace with our patched version
            window.ReactEditor.toSlatePoint = function(editor, domPoint) {
              try {
                // Check if domPoint is valid
                if (!domPoint || !Array.isArray(domPoint) || domPoint.length !== 2) {
                  console.warn('Early patch: Invalid domPoint:', domPoint);
                  return { path: [0, 0], offset: 0 };
                }
                
                var node = domPoint[0];
                var offset = domPoint[1];
                
                // Handle the specific error case
                if (node && node.nodeName === 'DIV') {
                  // Try to find a text node
                  var textNodes = Array.from(node.querySelectorAll('[data-slate-leaf]'));
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
                console.warn('Early patch: Error in patched toSlatePoint:', error);
                // Return a safe default
                return { path: [0, 0], offset: 0 };
              }
            };
            
            console.log('Early patch: ReactEditor.toSlatePoint successfully patched');
            window.__slatePatchApplied = true;
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('Early patch: Error applying patch:', error);
          return false;
        }
      }
      
      // Try to patch immediately
      if (!patchSlateReactEditor()) {
        // Set up a getter to intercept when ReactEditor is defined
        var originalReactEditor = window.ReactEditor;
        Object.defineProperty(window, 'ReactEditor', {
          get: function() {
            return originalReactEditor;
          },
          set: function(newValue) {
            originalReactEditor = newValue;
            patchSlateReactEditor();
            return true;
          },
          configurable: true
        });
        
        // Also try again when the DOM is loaded
        document.addEventListener('DOMContentLoaded', patchSlateReactEditor);
        
        // And when the window is fully loaded
        window.addEventListener('load', patchSlateReactEditor);
      }
    })();
  `;
  
  return (
    <Script id="slate-early-patch" strategy="beforeInteractive">
      {patchScript}
    </Script>
  );
}
