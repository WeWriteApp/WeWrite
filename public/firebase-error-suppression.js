/**
 * Firebase Error Suppression Script
 * 
 * This script runs very early in the page lifecycle to suppress Firebase installations errors
 * that occur before React components are mounted.
 */

(function() {
  'use strict';

  // Only run in development
  if (typeof window === 'undefined' || window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
    
    // Store original console methods
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    // Override console.error immediately
    console.error = function(...args) {
      const message = args.join(' ');
      
      // Suppress Firebase installations errors
      if (message.includes('Failed to fetch') ||
          message.includes('installations') ||
          message.includes('createInstallationRequest') ||
          message.includes('registerInstallation') ||
          message.includes('retryIfServerError') ||
          message.includes('webpack-internal') && message.includes('firebase') ||
          message.includes('pageId: \'#\'') ||
          message.includes('pageId: "#"') ||
          message.includes('client is offline') && message.includes('pageId')) {
        return; // Silently ignore
      }
      
      // Call original console.error for other messages
      originalConsoleError.apply(console, args);
    };

    // Override console.warn immediately
    console.warn = function(...args) {
      const message = args.join(' ');
      
      // Suppress Firebase installations warnings
      if (message.includes('installations') ||
          message.includes('Failed to fetch') ||
          message.includes('firebase') ||
          message.includes('pageId: \'#\'') ||
          message.includes('pageId: "#"') ||
          message.includes('client is offline') && message.includes('pageId')) {
        return; // Silently ignore
      }
      
      // Call original console.warn for other messages
      originalConsoleWarn.apply(console, args);
    };

    // Handle unhandled promise rejections immediately
    window.addEventListener('unhandledrejection', function(event) {
      if (event.reason && event.reason.message) {
        const message = event.reason.message;
        
        // Suppress Firebase installations promise rejections
        if (message.includes('Failed to fetch') ||
            message.includes('installations') ||
            message.includes('createInstallationRequest') ||
            message.includes('registerInstallation')) {
          event.preventDefault();
          return false;
        }
      }
    });

    // Handle regular errors immediately
    window.addEventListener('error', function(event) {
      if (event.error && event.error.message) {
        const message = event.error.message;
        
        // Suppress Firebase installations errors
        if (message.includes('Failed to fetch') ||
            message.includes('installations') ||
            message.includes('createInstallationRequest') ||
            message.includes('registerInstallation')) {
          event.preventDefault();
          return false;
        }
      }

      // Also check the stack trace
      if (event.error && event.error.stack) {
        const stack = event.error.stack;
        if (stack.includes('firebase/installations') || 
            stack.includes('index.esm2017.js') ||
            stack.includes('createInstallationRequest') ||
            stack.includes('registerInstallation') ||
            stack.includes('webpack-internal')) {
          event.preventDefault();
          return false;
        }
      }
    });

    console.log('🔇 Early Firebase error suppression initialized');
  }
})();
