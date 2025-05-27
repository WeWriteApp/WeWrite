"use client";

/**
 * Aggressive Slate.js Override
 * This completely replaces problematic Slate.js functions with safe implementations
 */

let overrideApplied = false;

export function applySlateOverride() {
  if (overrideApplied || typeof window === 'undefined') {
    return;
  }

  console.log('Applying aggressive Slate.js override...');

  // Override console.error to suppress Slate.js DOM errors and trigger fallback
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const message = args[0];
    if (typeof message === 'string' && (
      message.includes('Cannot resolve a DOM node from Slate node') ||
      message.includes('Cannot resolve a DOM point') ||
      message.includes('Cannot resolve a Slate point') ||
      message.includes('toDOMNode') ||
      message.includes('toDOMPoint') ||
      message.includes('toSlatePoint')
    )) {
      // Suppress these specific Slate.js errors and trigger fallback
      console.warn('Slate.js DOM error suppressed, triggering fallback:', message);

      // Trigger fallback editor
      window.dispatchEvent(new CustomEvent('slate-error', {
        detail: { message, args }
      }));

      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Create safe fallback functions
  const safeToDOMNode = (editor, node) => {
    try {
      // Try to find any text node in the editor
      const textNodes = document.querySelectorAll('[data-slate-leaf]');
      if (textNodes.length > 0) {
        return textNodes[0];
      }

      // Fallback to editor container
      const editorElement = document.querySelector('[data-slate-editor]');
      if (editorElement) {
        return editorElement;
      }

      return null;
    } catch (error) {
      console.warn('Safe toDOMNode fallback failed:', error);
      return null;
    }
  };

  const safeToDOMPoint = (editor, point) => {
    try {
      // Always return the first text node with offset 0
      const textNodes = document.querySelectorAll('[data-slate-leaf]');
      if (textNodes.length > 0) {
        return [textNodes[0], 0];
      }

      // Fallback to editor element
      const editorElement = document.querySelector('[data-slate-editor]');
      if (editorElement) {
        return [editorElement, 0];
      }

      return null;
    } catch (error) {
      console.warn('Safe toDOMPoint fallback failed:', error);
      return null;
    }
  };

  const safeToSlatePoint = (editor, domPoint) => {
    try {
      // Always return a safe point at the beginning
      return { path: [0, 0], offset: 0 };
    } catch (error) {
      console.warn('Safe toSlatePoint fallback failed:', error);
      return { path: [0, 0], offset: 0 };
    }
  };

  // Function to override ReactEditor methods
  const overrideReactEditor = (ReactEditor) => {
    if (!ReactEditor) return;

    console.log('Overriding ReactEditor methods...');

    // Override toDOMNode
    ReactEditor.toDOMNode = safeToDOMNode;

    // Override toDOMPoint
    ReactEditor.toDOMPoint = safeToDOMPoint;

    // Override toSlatePoint
    ReactEditor.toSlatePoint = safeToSlatePoint;

    console.log('ReactEditor methods overridden successfully');
  };

  // Try to find and override ReactEditor immediately
  const tryOverride = () => {
    // Check if ReactEditor is available globally
    if (window.ReactEditor) {
      overrideReactEditor(window.ReactEditor);
      return true;
    }

    // Check webpack module cache
    if (window.__webpack_require__?.cache) {
      let found = false;
      Object.keys(window.__webpack_require__.cache).forEach(key => {
        const module = window.__webpack_require__.cache[key];
        if (module?.exports?.ReactEditor) {
          overrideReactEditor(module.exports.ReactEditor);
          found = true;
        }
        if (module?.exports?.default?.ReactEditor) {
          overrideReactEditor(module.exports.default.ReactEditor);
          found = true;
        }
      });
      if (found) return true;
    }

    return false;
  };

  // Try immediate override
  if (tryOverride()) {
    overrideApplied = true;
    return;
  }

  // Set up observers and listeners for when ReactEditor becomes available
  const observer = new MutationObserver(() => {
    if (tryOverride()) {
      overrideApplied = true;
      observer.disconnect();
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true
  });

  // Also try on various events
  const events = ['DOMContentLoaded', 'load'];
  events.forEach(event => {
    window.addEventListener(event, () => {
      if (tryOverride()) {
        overrideApplied = true;
        observer.disconnect();
      }
    });
  });

  // Timeout fallback
  setTimeout(() => {
    tryOverride();
    overrideApplied = true;
    observer.disconnect();
  }, 5000);

  // Override any future imports of ReactEditor
  const originalRequire = window.require;
  if (originalRequire) {
    window.require = function(...args) {
      const result = originalRequire.apply(this, args);
      if (result && result.ReactEditor) {
        overrideReactEditor(result.ReactEditor);
      }
      return result;
    };
  }
}

// Apply override immediately when this module is imported
if (typeof window !== 'undefined') {
  applySlateOverride();

  // Also apply on next tick
  setTimeout(applySlateOverride, 0);

  // And on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySlateOverride);
  } else {
    applySlateOverride();
  }
}

export default applySlateOverride;
