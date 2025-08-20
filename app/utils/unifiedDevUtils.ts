/**
 * Unified Development Utilities - Consolidates debugging and development tools
 * 
 * Consolidates:
 * - developmentErrorOverride.ts (React error enhancement)
 * - error-recovery.ts (application state reset)
 * - Various debug API endpoints functionality
 * 
 * Provides:
 * - Single development utilities interface
 * - Simplified error handling and recovery
 * - Consistent debugging tools
 * - Production-safe development features
 */

"use client";

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production';
};

export const isPreview = (): boolean => {
  return process.env.VERCEL_ENV === 'preview';
};

// =============================================================================
// ERROR ENHANCEMENT (Simplified)
// =============================================================================

interface ErrorDetails {
  message: string;
  stack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  component?: string;
}

/**
 * Enhanced error logging for development
 */
export function logEnhancedError(error: Error, context?: string): void {
  if (typeof window === 'undefined') return;

  const errorDetails: ErrorDetails = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    component: context
  };

  console.group('🚨 ENHANCED ERROR DETAILS');
  console.error('Error:', error);
  console.error('Context:', context || 'Unknown');
  console.error('Details:', errorDetails);
  
  // Check for common React hydration errors
  if (error.message.includes('Hydration') || error.message.includes('Minified React error')) {
    console.error('💡 HYDRATION ERROR DETECTED');
    console.error('Common causes:');
    console.error('- Date/time differences between server and client');
    console.error('- Random values used during render');
    console.error('- Browser-only APIs called during SSR');
    console.error('- Conditional rendering based on client-only state');
  }
  
  console.groupEnd();

  // Log to external services if available
  if ((window as any).LogRocket && isProduction()) {
    (window as any).LogRocket.captureException(error, {
      tags: { errorType: 'enhanced-error' },
      extra: errorDetails
    });
  }
}

/**
 * Simple error boundary hook for functional components
 */
export function useErrorHandler() {
  return (error: Error, context?: string) => {
    logEnhancedError(error, context);
  };
}

// =============================================================================
// APPLICATION STATE RESET (Simplified)
// =============================================================================

interface ResetOptions {
  preserveTheme?: boolean;
  clearCache?: boolean;
  redirectUrl?: string;
  forceReload?: boolean;
}

/**
 * Reset application state (simplified version)
 */
export async function resetApplicationState(options: ResetOptions = {}): Promise<void> {
  const {
    preserveTheme = true,
    clearCache = true,
    redirectUrl,
    forceReload = true
  } = options;

  if (typeof window === 'undefined') return;

  console.log('🧹 Resetting application state...');

  try {
    // Preserve theme if requested
    const theme = preserveTheme ? localStorage.getItem('theme') : null;

    // Clear storage
    if (clearCache) {
      localStorage.clear();
      sessionStorage.clear();
      
      // Restore theme
      if (theme) {
        localStorage.setItem('theme', theme);
      }
    }

    // Clear caches if available
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    console.log('✅ Application state reset completed');

    // Redirect or reload
    if (forceReload) {
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        window.location.reload();
      }
    }
  } catch (error) {
    console.error('❌ Failed to reset application state:', error);
    // Fallback: just reload the page
    if (forceReload) {
      window.location.reload();
    }
  }
}

// =============================================================================
// DEBUGGING UTILITIES
// =============================================================================

/**
 * Log system information for debugging
 */
export function logSystemInfo(): void {
  if (typeof window === 'undefined') return;

  const info = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      isDev: isDevelopment(),
      isProd: isProduction(),
      isPreview: isPreview()
    },
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    },
    page: {
      url: window.location.href,
      referrer: document.referrer,
      title: document.title
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };

  console.group('🔍 SYSTEM INFORMATION');
  console.table(info.environment);
  console.table(info.browser);
  console.table(info.page);
  console.table(info.screen);
  console.table(info.viewport);
  console.groupEnd();

  return info;
}

/**
 * Performance monitoring utility
 */
export function measurePerformance(name: string, fn: () => void | Promise<void>): void {
  if (!isDevelopment()) return;

  const start = performance.now();
  
  const finish = () => {
    const end = performance.now();
    const duration = end - start;
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
  };

  try {
    const result = fn();
    if (result instanceof Promise) {
      result.finally(finish);
    } else {
      finish();
    }
  } catch (error) {
    finish();
    throw error;
  }
}

/**
 * Memory usage monitoring
 */
export function logMemoryUsage(): void {
  if (typeof window === 'undefined' || !isDevelopment()) return;

  if ('memory' in performance) {
    const memory = (performance as any).memory;
    console.group('💾 MEMORY USAGE');
    console.log(`Used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
    console.groupEnd();
  }
}

/**
 * Network status monitoring
 */
export function setupNetworkMonitoring(): void {
  if (typeof window === 'undefined' || !isDevelopment()) return;

  window.addEventListener('online', () => {
    console.log('🌐 Network: Online');
  });

  window.addEventListener('offline', () => {
    console.log('🌐 Network: Offline');
  });

  // Log initial status
  console.log(`🌐 Network: ${navigator.onLine ? 'Online' : 'Offline'}`);
}

// =============================================================================
// DEVELOPMENT HELPERS
// =============================================================================

/**
 * Quick console shortcuts for development
 */
export const dev = {
  log: (...args: any[]) => isDevelopment() && console.log('🔧', ...args),
  warn: (...args: any[]) => isDevelopment() && console.warn('⚠️', ...args),
  error: (...args: any[]) => isDevelopment() && console.error('❌', ...args),
  info: (...args: any[]) => isDevelopment() && console.info('ℹ️', ...args),
  table: (data: any) => isDevelopment() && console.table(data),
  group: (label: string) => isDevelopment() && console.group(`🔍 ${label}`),
  groupEnd: () => isDevelopment() && console.groupEnd(),
  time: (label: string) => isDevelopment() && console.time(`⏱️ ${label}`),
  timeEnd: (label: string) => isDevelopment() && console.timeEnd(`⏱️ ${label}`),
  
  // Utility functions
  systemInfo: logSystemInfo,
  memory: logMemoryUsage,
  reset: resetApplicationState,
  measure: measurePerformance
};

/**
 * Initialize development utilities
 */
export function initializeDevUtils(): void {
  if (typeof window === 'undefined') return;

  if (isDevelopment()) {
    console.log('🔧 Development utilities initialized');
    
    // Setup global dev object
    (window as any).dev = dev;
    
    // Setup network monitoring
    setupNetworkMonitoring();
    
    // Log initial system info
    setTimeout(logSystemInfo, 1000);
    
    console.log('💡 Use window.dev for debugging utilities');
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  isDevelopment,
  isProduction,
  isPreview,
  logEnhancedError,
  useErrorHandler,
  resetApplicationState,
  logSystemInfo,
  measurePerformance,
  logMemoryUsage,
  setupNetworkMonitoring,
  dev,
  initializeDevUtils
};
