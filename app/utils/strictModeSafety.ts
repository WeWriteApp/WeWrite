/**
 * React Strict Mode Safety Utilities
 * 
 * Provides utilities to prevent duplicate initialization and execution
 * in React Strict Mode, which intentionally double-executes effects
 * and component initialization in development.
 */

// Global registry to track initialization states
const initializationRegistry = new Map<string, boolean>();

/**
 * Singleton pattern for initialization functions
 * Prevents duplicate execution in React Strict Mode
 */
export function runOnce(key: string, fn: () => void): void {
  if (initializationRegistry.get(key)) {
    return; // Already executed
  }
  
  initializationRegistry.set(key, true);
  fn();
}

/**
 * Hook to run an effect only once, even in React Strict Mode
 */
export function useRunOnce(key: string, fn: () => void | (() => void), deps?: React.DependencyList): void {
  const React = require('react');
  const { useEffect, useRef } = React;
  
  const hasRun = useRef(false);
  
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    
    const cleanup = fn();
    return cleanup;
  }, deps);
}

/**
 * Reset initialization state (for testing)
 */
export function resetInitialization(key?: string): void {
  if (key) {
    initializationRegistry.delete(key);
  } else {
    initializationRegistry.clear();
  }
}

/**
 * Check if something has been initialized
 */
export function isInitialized(key: string): boolean {
  return initializationRegistry.get(key) === true;
}

/**
 * Get initialization stats (for debugging)
 */
export function getInitializationStats(): Record<string, boolean> {
  return Object.fromEntries(initializationRegistry.entries());
}

/**
 * Strict Mode safe console logging
 * Prevents duplicate log messages in development
 */
const logCache = new Map<string, number>();
const LOG_DEDUP_WINDOW = 1000; // 1 second

export function safeLog(message: string, ...args: any[]): void {
  const key = message + JSON.stringify(args);
  const now = Date.now();
  const lastLog = logCache.get(key);
  
  if (!lastLog || (now - lastLog) > LOG_DEDUP_WINDOW) {
    console.log(message, ...args);
    logCache.set(key, now);
  }
}

export function safeWarn(message: string, ...args: any[]): void {
  const key = message + JSON.stringify(args);
  const now = Date.now();
  const lastLog = logCache.get(key);
  
  if (!lastLog || (now - lastLog) > LOG_DEDUP_WINDOW) {
    console.warn(message, ...args);
    logCache.set(key, now);
  }
}

export function safeError(message: string, ...args: any[]): void {
  const key = message + JSON.stringify(args);
  const now = Date.now();
  const lastLog = logCache.get(key);
  
  if (!lastLog || (now - lastLog) > LOG_DEDUP_WINDOW) {
    console.error(message, ...args);
    logCache.set(key, now);
  }
}

/**
 * Clear log cache (for testing)
 */
export function clearLogCache(): void {
  logCache.clear();
}

/**
 * Detect if we're in React Strict Mode
 */
export function isStrictMode(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for React Strict Mode indicators
  return (
    process.env.NODE_ENV === 'development' &&
    (window as any).__REACT_STRICT_MODE__ === true
  );
}

/**
 * Log Strict Mode detection info
 */
export function logStrictModeInfo(): void {
  // Logging disabled to reduce console noise
}

/**
 * Add debugging utilities to window object in development
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).strictModeSafety = {
    getStats: getInitializationStats,
    isInitialized,
    resetInitialization,
    clearLogCache,
    logStrictModeInfo,
    isStrictMode
  };

  // Log initialization info after a short delay
  setTimeout(() => {
    logStrictModeInfo();
  }, 2000);
}
