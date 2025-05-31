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

            // Replace with our enhanced patched version
            window.ReactEditor.toSlatePoint = function(editor, domPoint) {
              try {
                // Enhanced validation for hydration safety
                if (typeof window === 'undefined' || !document || document.readyState === 'loading') {
                  console.warn('Early patch: DOM not ready, returning safe default');
                  return { path: [0, 0], offset: 0 };
                }

                // Check if domPoint is valid
                if (!domPoint || !Array.isArray(domPoint) || domPoint.length !== 2) {
                  console.warn('Early patch: Invalid domPoint:', domPoint);
                  return { path: [0, 0], offset: 0 };
                }

                var node = domPoint[0];
                var offset = domPoint[1];

                // Check if we have any Slate elements in DOM
                var slateElements = document.querySelectorAll('[data-slate-editor], [data-slate-node], [data-slate-leaf]');
                if (slateElements.length === 0) {
                  console.warn('Early patch: No Slate elements found, returning safe default');
                  return { path: [0, 0], offset: 0 };
                }

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

            // Also patch toDOMNode for enhanced safety
            if (window.ReactEditor.toDOMNode) {
              var originalToDOMNode = window.ReactEditor.toDOMNode;

              window.ReactEditor.toDOMNode = function(editor, node) {
                try {
                  // Enhanced validation for hydration safety
                  if (typeof window === 'undefined' || !document || document.readyState === 'loading') {
                    console.warn('Early patch: DOM not ready for toDOMNode, returning null');
                    return null;
                  }

                  // For new pages, be more lenient - allow if DOM is ready even without existing Slate elements
                  var isNewPage = window.location.pathname.includes('/new') ||
                                  window.location.search.includes('type=daily-note');

                  if (!isNewPage) {
                    // For existing pages, check if we have Slate elements in DOM
                    var slateElements = document.querySelectorAll('[data-slate-editor], [data-slate-node], [data-slate-leaf]');
                    if (slateElements.length === 0) {
                      console.warn('Early patch: No Slate elements found for toDOMNode, returning null');
                      return null;
                    }
                  }

                  return originalToDOMNode.call(this, editor, node);
                } catch (error) {
                  console.warn('Early patch: Error in toDOMNode, returning null:', error);
                  return null;
                }
              };
            }

            // Also patch toDOMPoint for enhanced safety
            if (window.ReactEditor.toDOMPoint) {
              var originalToDOMPoint = window.ReactEditor.toDOMPoint;

              window.ReactEditor.toDOMPoint = function(editor, point) {
                try {
                  // Enhanced validation for hydration safety
                  if (typeof window === 'undefined' || !document || document.readyState === 'loading') {
                    console.warn('Early patch: DOM not ready for toDOMPoint, returning null');
                    return null;
                  }

                  // For new pages, be more lenient - allow if DOM is ready even without existing Slate elements
                  var isNewPage = window.location.pathname.includes('/new') ||
                                  window.location.search.includes('type=daily-note');

                  if (!isNewPage) {
                    // For existing pages, check if we have Slate elements in DOM
                    var slateElements = document.querySelectorAll('[data-slate-editor], [data-slate-node], [data-slate-leaf]');
                    if (slateElements.length === 0) {
                      console.warn('Early patch: No Slate elements found for toDOMPoint, returning null');
                      return null;
                    }
                  }

                  return originalToDOMPoint.call(this, editor, point);
                } catch (error) {
                  console.warn('Early patch: Error in toDOMPoint, returning null:', error);
                  return null;
                }
              };
            }

            console.log('Early patch: ReactEditor functions successfully patched');
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
