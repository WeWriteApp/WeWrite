"use client";

/**
 * Development Error Override System
 * 
 * This module forces detailed React error messages even in production builds
 * by intercepting and enhancing minified React errors.
 */

// Enhanced React error messages for common hydration issues
const ENHANCED_ERROR_MESSAGES: Record<string, string> = {
  '185': `
🚨 HYDRATION ERROR (React #185)

PROBLEM: The server-rendered HTML doesn't match what React rendered on the client.

COMMON CAUSES:
1. Date/time differences between server and client
2. Random values (Math.random(), Date.now()) used during render
3. Browser-only APIs called during SSR
4. Conditional rendering based on client-only state (localStorage, window, etc.)
5. Third-party libraries that behave differently on server vs client

DEBUGGING STEPS:
1. Check for any Date objects, random numbers, or browser APIs in your components
2. Look for useEffect hooks that change state immediately after mount
3. Verify that server and client render the exact same content initially
4. Use suppressHydrationWarning={true} only as a last resort for specific elements

TECHNICAL DETAILS:
- This error occurs during the hydration phase when React tries to attach to server-rendered HTML
- React expects the initial client render to match the server render exactly
- Any differences will cause React to throw this error and re-render the entire tree

LOCATION: Check the component stack trace below for the specific component causing the issue.
`,

  '418': `
🚨 HYDRATION ERROR (React #418)

PROBLEM: React encountered an error during the hydration process.

This is typically caused by:
- Server/client rendering mismatches
- Errors in useEffect hooks that run during hydration
- Invalid HTML structure differences between server and client

SOLUTION: Check for conditional rendering or state changes that happen immediately after component mount.
`,

  '419': `
🚨 TEXT CONTENT MISMATCH (React #419)

PROBLEM: The text content of an element doesn't match between server and client.

COMMON CAUSES:
1. Dynamic text based on Date.now() or Math.random()
2. Localization that differs between server and client
3. User-specific content that's not available during SSR
4. Text that depends on browser APIs

SOLUTION: Ensure text content is identical on both server and client during initial render.
`,

  '420': `
🚨 HTML CONTENT MISMATCH (React #420)

PROBLEM: The HTML structure rendered on the server is different from the client.

COMMON CAUSES:
1. Conditional rendering based on client-only state
2. Different component trees on server vs client
3. Browser-specific HTML elements or attributes
4. Third-party components that render differently

SOLUTION: Ensure the component tree structure is identical on server and client.
`,

  '421': `
🚨 HYDRATION PROCESS ERROR (React #421)

PROBLEM: An error occurred during the hydration process.

This usually indicates:
- A JavaScript error in a component during hydration
- Invalid props or state during the hydration phase
- Memory or performance issues during hydration

SOLUTION: Check the component stack trace for the specific error location.
`
};

/**
 * Override console.error to provide enhanced React error messages
 */
function enhanceReactErrors(): void {
  if (typeof window === 'undefined') return;

  const originalConsoleError = console.error;

  console.error = (...args: any[]) => {
    // Check if this is a minified React error
    const firstArg = args[0];
    if (firstArg instanceof Error && firstArg.message.includes('Minified React error')) {
      const match = firstArg.message.match(/Minified React error #(\d+)/);
      if (match) {
        const errorCode = match[1];
        const enhancedMessage = ENHANCED_ERROR_MESSAGES[errorCode];
        
        if (enhancedMessage) {
          console.group('🔍 ENHANCED REACT ERROR DETAILS');
          console.error('Original Error:', firstArg);
          console.error('Enhanced Message:', enhancedMessage);
          console.error('Error Code:', errorCode);
          console.error('React Documentation:', `https://react.dev/errors/${errorCode}`);
          
          // Log additional context if available
          if (args.length > 1) {
            console.error('Additional Context:', args.slice(1));
          }
          
          // Try to extract component stack if available
          if (firstArg.stack) {
            console.error('Stack Trace:', firstArg.stack);
          }
          
          console.groupEnd();
          
          // Also log to LogRocket if available
          if ((window as any).LogRocket) {
            (window as any).LogRocket.captureException(firstArg, {
              tags: {
                errorType: 'enhanced-react-error',
                errorCode: errorCode
              },
              extra: {
                enhancedMessage,
                originalArgs: args
              }
            });
          }
          
          return; // Don't call original console.error for enhanced errors
        }
      }
    }
    
    // For non-React errors or unrecognized React errors, use original behavior
    originalConsoleError.apply(console, args);
  };
}

/**
 * Force React development mode error messages
 */
function forceReactDevMode(): void {
  if (typeof window === 'undefined') return;

  // Try to force React into development mode for better error messages
  try {
    // Set React development flags
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ || {};
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.isDisabled = false;
    
    // Force development mode
    if (typeof process !== 'undefined') {
      (process as any).env = (process as any).env || {};
      (process as any).env.NODE_ENV = 'development';
    }
    
    // Set React development flags on window
    (window as any).__DEV__ = true;
    (window as any).__REACT_DEV__ = true;
    
    console.log('🔧 Forced React development mode for enhanced error messages');
  } catch (error) {
    console.warn('Could not force React development mode:', error);
  }
}

/**
 * Add hydration error detection
 */
function addHydrationErrorDetection(): void {
  if (typeof window === 'undefined') return;

  // Listen for hydration errors specifically
  window.addEventListener('error', (event) => {
    const error = event.error;
    if (error && error.message) {
      const message = error.message.toLowerCase();
      
      // Check for hydration-related errors
      if (message.includes('hydration') || 
          message.includes('server') || 
          message.includes('client') ||
          message.includes('minified react error #185') ||
          message.includes('minified react error #418') ||
          message.includes('minified react error #419')) {
        
        console.group('🚨 HYDRATION ERROR DETECTED');
        console.error('Error:', error);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        console.error('Event:', event);
        
        // Log current page state
        console.error('Current URL:', window.location.href);
        console.error('User Agent:', navigator.userAgent);
        console.error('Timestamp:', new Date().toISOString());
        
        // Log React version if available
        if ((window as any).React) {
          console.error('React Version:', (window as any).React.version);
        }
        
        console.groupEnd();
      }
    }
  });
}

/**
 * Initialize development error overrides
 */
export function initializeDevelopmentErrorOverrides(): void {
  if (typeof window === 'undefined') return;

  console.log('🔍 Initializing development error overrides...');
  
  enhanceReactErrors();
  forceReactDevMode();
  addHydrationErrorDetection();
  
  console.log('✅ Development error overrides initialized');
  console.log('🔍 Enhanced React error logging is now active');
  console.log('📚 React errors will now show detailed explanations and debugging tips');
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDevelopmentErrorOverrides);
  } else {
    initializeDevelopmentErrorOverrides();
  }
}
