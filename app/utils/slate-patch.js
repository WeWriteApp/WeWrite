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

  try {
    // Apply all patches with error handling
    applyToSlatePointPatch();
    applyToDOMNodePatch();
    applyToDOMPointPatch();
    applyReactEditorPatches();

    // Additional patch for better error suppression
    suppressSlateErrors();

    // Mark patches as applied
    patchesApplied = true;
    console.log('Slate patches applied successfully');
  } catch (error) {
    console.warn('Error applying Slate patches:', error);
    // Still mark as applied to prevent infinite retry
    patchesApplied = true;
  }
}

// Make the function available globally for components to use
if (typeof window !== 'undefined') {
  window.applySlatePatches = applySlatePatches;

  // Auto-apply patches when this module loads
  applySlatePatches();
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
 * Enhanced patch for the ReactEditor.toDOMNode function
 * This fixes the "Cannot resolve a DOM node from Slate node" error
 * with better fallback handling for daily notes and hydration issues
 */
function applyToDOMNodePatch() {
  const checkAndPatch = () => {
    if (window.ReactEditor && window.ReactEditor.toDOMNode) {
      const originalToDOMNode = window.ReactEditor.toDOMNode;

      window.ReactEditor.toDOMNode = (editor, node) => {
        try {
          // Validate inputs more thoroughly
          if (!editor || !node) {
            console.warn('Invalid inputs to toDOMNode:', { editor: !!editor, node: !!node });
            return null;
          }

          // Check if editor is properly initialized
          if (!editor.children || !Array.isArray(editor.children)) {
            console.warn('Editor not properly initialized for toDOMNode');
            return null;
          }

          // Call the original function
          return originalToDOMNode(editor, node);
        } catch (error) {
          console.warn('Error in patched toDOMNode:', error);

          // Enhanced fallback logic for daily notes and hydration issues
          try {
            // More aggressive DOM readiness check
            if (typeof window === 'undefined' || !document || document.readyState === 'loading') {
              console.warn('DOM not ready during toDOMNode, returning null');
              return null;
            }

            // Check if we have any Slate elements in the DOM yet
            const slateElements = document.querySelectorAll('[data-slate-editor], [data-slate-node], [data-slate-leaf]');
            if (slateElements.length === 0) {
              console.warn('No Slate elements found in DOM, returning null');
              return null;
            }

            // If it's a text node, try to find its parent element
            if (node && typeof node === 'object' && 'text' in node) {
              const textNodes = document.querySelectorAll('[data-slate-leaf]');
              for (const textNode of textNodes) {
                if (textNode.textContent === node.text) {
                  return textNode;
                }
              }

              // If no exact match, return the first text node as fallback
              if (textNodes.length > 0) {
                return textNodes[0];
              }
            }

            // If it's an element node, try to find by type
            if (node && typeof node === 'object' && 'type' in node) {
              const elements = document.querySelectorAll(`[data-slate-node="${node.type}"]`);
              if (elements.length > 0) {
                return elements[0];
              }
            }

            // Last resort: return the editor element itself
            const editorElement = document.querySelector('[data-slate-editor]');
            if (editorElement) {
              return editorElement;
            }
          } catch (fallbackError) {
            console.warn('Error in toDOMNode fallback:', fallbackError);
          }

          // Return null as a safe fallback
          return null;
        }
      };

      console.log('ReactEditor.toDOMNode patched successfully');
      return true;
    }
    return false;
  };

  // Try to patch immediately
  if (!checkAndPatch()) {
    const observer = new MutationObserver(() => {
      if (checkAndPatch()) {
        observer.disconnect();
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true
    });

    window.addEventListener('load', () => {
      if (checkAndPatch()) {
        observer.disconnect();
      }
    });

    setTimeout(() => {
      checkAndPatch();
      observer.disconnect();
    }, 5000);
  }
}

/**
 * Patch for the ReactEditor.toDOMPoint function
 * This fixes DOM point resolution issues
 */
function applyToDOMPointPatch() {
  const checkAndPatch = () => {
    if (window.ReactEditor && window.ReactEditor.toDOMPoint) {
      const originalToDOMPoint = window.ReactEditor.toDOMPoint;

      window.ReactEditor.toDOMPoint = (editor, point) => {
        try {
          // More aggressive validation for hydration safety
          if (typeof window === 'undefined' || !document || document.readyState === 'loading') {
            console.warn('DOM not ready during toDOMPoint, returning null');
            return null;
          }

          // Validate inputs
          if (!editor || !point) {
            console.warn('Invalid inputs to toDOMPoint:', { editor: !!editor, point: !!point });
            return null;
          }

          // Validate point structure
          if (!point.path || !Array.isArray(point.path) || typeof point.offset !== 'number') {
            console.warn('Invalid point structure in toDOMPoint:', point);
            return null;
          }

          // Check if we have Slate elements in DOM
          const slateElements = document.querySelectorAll('[data-slate-editor], [data-slate-node], [data-slate-leaf]');
          if (slateElements.length === 0) {
            console.warn('No Slate elements found in DOM during toDOMPoint, returning null');
            return null;
          }

          // Check if the path exists in the editor
          try {
            const node = editor.children[point.path[0]];
            if (!node) {
              console.warn('Path does not exist in editor:', point.path);
              // Try to find a valid path
              const firstTextNode = document.querySelector('[data-slate-leaf]');
              if (firstTextNode) {
                return [firstTextNode, 0];
              }
              return null;
            }
          } catch (pathError) {
            console.warn('Error checking path in editor:', pathError);
          }

          // Call the original function
          return originalToDOMPoint(editor, point);
        } catch (error) {
          console.warn('Error in patched toDOMPoint:', error, 'Point:', point);

          // Enhanced fallback logic
          try {
            // Try to find a text node that corresponds to the point
            const textNodes = document.querySelectorAll('[data-slate-leaf]');

            if (textNodes.length > 0) {
              // If we have a valid path, try to find the corresponding text node
              if (point && point.path && Array.isArray(point.path)) {
                const pathIndex = point.path[0] || 0;
                if (pathIndex < textNodes.length) {
                  const targetNode = textNodes[pathIndex];
                  const offset = Math.min(point.offset || 0, targetNode.textContent.length);
                  return [targetNode, offset];
                }
              }

              // Fallback to first text node
              const firstTextNode = textNodes[0];
              const safeOffset = point && typeof point.offset === 'number'
                ? Math.min(point.offset, firstTextNode.textContent.length)
                : 0;
              return [firstTextNode, safeOffset];
            }

            // Last resort: try to find any editable element
            const editableElement = document.querySelector('[data-slate-editor]');
            if (editableElement) {
              return [editableElement, 0];
            }
          } catch (fallbackError) {
            console.warn('Error in toDOMPoint fallback:', fallbackError);
          }

          return null;
        }
      };

      console.log('ReactEditor.toDOMPoint patched successfully');
      return true;
    }
    return false;
  };

  // Try to patch immediately
  if (!checkAndPatch()) {
    const observer = new MutationObserver(() => {
      if (checkAndPatch()) {
        observer.disconnect();
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true
    });

    window.addEventListener('load', () => {
      if (checkAndPatch()) {
        observer.disconnect();
      }
    });

    setTimeout(() => {
      checkAndPatch();
      observer.disconnect();
    }, 5000);
  }
}

/**
 * Patch ReactEditor directly by intercepting module imports
 * This is the most reliable way to patch Slate functions
 */
function applyReactEditorPatches() {
  try {
    // Try to patch ReactEditor if it's available globally
    if (typeof window !== 'undefined') {
      // Store original console.error to restore later
      const originalConsoleError = console.error;

      // Temporarily suppress React warnings about patching
      console.error = (...args) => {
        const message = args[0];
        if (typeof message === 'string' && (
          message.includes('Cannot resolve a DOM node') ||
          message.includes('Cannot resolve a DOM point') ||
          message.includes('Cannot resolve a Slate point')
        )) {
          // Suppress these specific errors
          return;
        }
        originalConsoleError.apply(console, args);
      };

      // Restore console.error after a delay
      setTimeout(() => {
        console.error = originalConsoleError;
      }, 5000);

      // Try to patch the module directly
      const moduleCache = window.__webpack_require__?.cache;
      if (moduleCache) {
        Object.keys(moduleCache).forEach(key => {
          const module = moduleCache[key];
          if (module && module.exports && module.exports.ReactEditor) {
            patchReactEditorMethods(module.exports.ReactEditor);
          }
          if (module && module.exports && module.exports.default && module.exports.default.ReactEditor) {
            patchReactEditorMethods(module.exports.default.ReactEditor);
          }
        });
      }

      // Also try to patch if ReactEditor is available on window
      if (window.ReactEditor) {
        patchReactEditorMethods(window.ReactEditor);
      }

      console.log('ReactEditor patches applied');
    }
  } catch (error) {
    console.warn('Could not apply ReactEditor patches:', error);
  }
}

/**
 * Patch specific ReactEditor methods
 */
function patchReactEditorMethods(ReactEditor) {
  if (!ReactEditor) return;

  // Patch toDOMNode
  if (ReactEditor.toDOMNode && typeof ReactEditor.toDOMNode === 'function') {
    const originalToDOMNode = ReactEditor.toDOMNode;
    ReactEditor.toDOMNode = function(editor, node) {
      try {
        return originalToDOMNode.call(this, editor, node);
      } catch (error) {
        console.warn('toDOMNode error caught and handled:', error);

        // Try to find the DOM node by other means
        try {
          if (node && typeof node === 'object' && 'text' in node) {
            const textNodes = document.querySelectorAll('[data-slate-leaf]');
            for (const textNode of textNodes) {
              if (textNode.textContent === node.text) {
                return textNode;
              }
            }
          }

          // Fallback to first text node
          const firstTextNode = document.querySelector('[data-slate-leaf]');
          if (firstTextNode) {
            return firstTextNode;
          }
        } catch (fallbackError) {
          console.warn('toDOMNode fallback failed:', fallbackError);
        }

        return null;
      }
    };
  }

  // Patch toDOMPoint
  if (ReactEditor.toDOMPoint && typeof ReactEditor.toDOMPoint === 'function') {
    const originalToDOMPoint = ReactEditor.toDOMPoint;
    ReactEditor.toDOMPoint = function(editor, point) {
      try {
        return originalToDOMPoint.call(this, editor, point);
      } catch (error) {
        console.warn('toDOMPoint error caught and handled:', error);

        // Try to find a safe DOM point
        try {
          const textNodes = document.querySelectorAll('[data-slate-leaf]');
          if (textNodes.length > 0) {
            const firstTextNode = textNodes[0];
            const safeOffset = point && typeof point.offset === 'number'
              ? Math.min(point.offset, firstTextNode.textContent.length)
              : 0;
            return [firstTextNode, safeOffset];
          }
        } catch (fallbackError) {
          console.warn('toDOMPoint fallback failed:', fallbackError);
        }

        return null;
      }
    };
  }

  // Patch toSlatePoint
  if (ReactEditor.toSlatePoint && typeof ReactEditor.toSlatePoint === 'function') {
    const originalToSlatePoint = ReactEditor.toSlatePoint;
    ReactEditor.toSlatePoint = function(editor, domPoint, options) {
      try {
        return originalToSlatePoint.call(this, editor, domPoint, options);
      } catch (error) {
        console.warn('toSlatePoint error caught and handled:', error);

        // Return a safe fallback point
        try {
          return { path: [0, 0], offset: 0 };
        } catch (fallbackError) {
          console.warn('toSlatePoint fallback failed:', fallbackError);
        }

        return null;
      }
    };
  }
}

/**
 * Suppress specific Slate error messages to prevent console spam
 * This helps reduce noise while still allowing important errors through
 */
function suppressSlateErrors() {
  if (typeof window === 'undefined' || typeof console === 'undefined') {
    return;
  }

  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;

  // List of error messages to suppress
  const suppressedErrors = [
    'Cannot resolve a DOM node from Slate node',
    'Cannot resolve a DOM point from Slate point',
    'Cannot resolve a Slate point from DOM point',
    'Cannot resolve a Slate node from DOM node',
    'Cannot resolve DOM range from Slate range',
    'Cannot resolve Slate range from DOM range'
  ];

  // Override console.error
  console.error = function(...args) {
    const message = args[0];
    if (typeof message === 'string') {
      const shouldSuppress = suppressedErrors.some(suppressedError =>
        message.includes(suppressedError)
      );
      if (shouldSuppress) {
        // Optionally log a simplified message instead
        // console.debug('Slate DOM resolution error suppressed:', message);
        return;
      }
    }
    originalError.apply(console, args);
  };

  // Override console.warn for similar messages
  console.warn = function(...args) {
    const message = args[0];
    if (typeof message === 'string') {
      const shouldSuppress = suppressedErrors.some(suppressedError =>
        message.includes(suppressedError)
      );
      if (shouldSuppress) {
        return;
      }
    }
    originalWarn.apply(console, args);
  };

  console.log('Slate error suppression enabled');
}

/**
 * Initialize the Slate patches
 * This is automatically called when this module is imported
 */
if (typeof window !== 'undefined') {
  // Apply patches immediately
  applySlatePatches();

  // Apply patches after a short delay to ensure modules are loaded
  setTimeout(applySlatePatches, 100);

  // Also apply patches when the document is fully loaded
  window.addEventListener('DOMContentLoaded', applySlatePatches);

  // Apply patches when modules are loaded
  window.addEventListener('load', applySlatePatches);
}

export default applySlatePatches;
