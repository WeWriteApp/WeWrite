"use client";

/**
 * Infinite Reload Detection and Circuit Breaker System
 * 
 * This module implements a comprehensive system to detect and prevent infinite page reload loops
 * that can occur due to authentication issues, React state problems, or other bugs.
 */

interface ReloadEvent {
  timestamp: number;
  url: string;
  referrer: string;
  userAgent: string;
  reason?: string;
}

interface DebugInfo {
  reloadEvents: ReloadEvent[];
  authState: any;
  navigationHistory: string[];
  consoleErrors: any[];
  browserInfo: any;
  storageContents: any;
  networkStatus: boolean;
  componentStack?: string;
}

interface CircuitBreakerState {
  isTriggered: boolean;
  reloadCount: number;
  firstReloadTime: number;
  lastReloadTime: number;
  reloadEvents: ReloadEvent[];
  debugInfo: DebugInfo;
}

const STORAGE_KEY = 'wewrite_infinite_reload_detector';
const RELOAD_WINDOW_MS = 30000; // 30 seconds
const MAX_RELOADS = 3; // Trigger after 3 reloads
const STABLE_TIME_MS = 60000; // 60 seconds of stability to reset

// Development mode check
const isDevelopment = () => {
  return typeof window !== 'undefined' &&
         (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          process.env.NODE_ENV === 'development');
};

class InfiniteReloadDetector {
  private consoleErrors: any[] = [];
  private navigationHistory: string[] = [];
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Record page load
    this.recordPageLoad();

    // Set up console error capture
    this.setupConsoleErrorCapture();

    // Set up navigation tracking
    this.setupNavigationTracking();

    // Set up stability timer
    this.setupStabilityTimer();

    // Check if circuit breaker should be triggered
    this.checkCircuitBreaker();
  }

  private recordPageLoad(reason?: string) {
    try {
      const now = Date.now();
      const state = this.getState();
      
      const reloadEvent: ReloadEvent = {
        timestamp: now,
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        reason
      };

      // Add to reload events
      state.reloadEvents.push(reloadEvent);

      // Keep only recent events (within window)
      state.reloadEvents = state.reloadEvents.filter(
        event => now - event.timestamp <= RELOAD_WINDOW_MS
      );

      // Update counters
      state.reloadCount = state.reloadEvents.length;
      state.lastReloadTime = now;
      
      if (state.reloadCount === 1) {
        state.firstReloadTime = now;
      }

      // Update debug info
      state.debugInfo = this.collectDebugInfo();

      this.saveState(state);

      console.log(`[InfiniteReloadDetector] Recorded page load #${state.reloadCount}`, {
        reason,
        reloadCount: state.reloadCount,
        timeWindow: now - state.firstReloadTime
      });

    } catch (error) {
      console.error('[InfiniteReloadDetector] Error recording page load:', error);
    }
  }

  private setupConsoleErrorCapture() {
    // Capture console errors
    const originalError = console.error;
    console.error = (...args) => {
      this.consoleErrors.push({
        timestamp: Date.now(),
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ')
      });

      // Keep only recent errors (last 30 seconds)
      const cutoff = Date.now() - 30000;
      this.consoleErrors = this.consoleErrors.filter(error => error.timestamp > cutoff);

      originalError.apply(console, args);
    };

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.consoleErrors.push({
        timestamp: Date.now(),
        message: `Unhandled Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
        stack: event.error?.stack
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.consoleErrors.push({
        timestamp: Date.now(),
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack
      });
    });
  }

  private setupNavigationTracking() {
    // Track navigation history
    this.navigationHistory.push(window.location.href);

    // Listen for navigation events
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      window.dispatchEvent(new Event('navigationchange'));
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      window.dispatchEvent(new Event('navigationchange'));
    };

    window.addEventListener('popstate', () => {
      window.dispatchEvent(new Event('navigationchange'));
    });

    window.addEventListener('navigationchange', () => {
      this.navigationHistory.push(window.location.href);
      // Keep only last 10 navigation events
      if (this.navigationHistory.length > 10) {
        this.navigationHistory = this.navigationHistory.slice(-10);
      }
    });
  }

  private setupStabilityTimer() {
    // Set up timer to reset circuit breaker after stable period
    setTimeout(() => {
      const state = this.getState();
      const now = Date.now();
      
      // If we've been stable for the required time, reset
      if (now - state.lastReloadTime >= STABLE_TIME_MS) {
        console.log('[InfiniteReloadDetector] Stable period detected, resetting circuit breaker');
        this.reset();
      }
    }, STABLE_TIME_MS);
  }

  private checkCircuitBreaker() {
    // Skip circuit breaker in development mode
    if (isDevelopment()) {
      console.log('[InfiniteReloadDetector] Development mode detected, circuit breaker disabled');
      return;
    }

    const state = this.getState();

    if (state.reloadCount >= MAX_RELOADS && !state.isTriggered) {
      const timeWindow = state.lastReloadTime - state.firstReloadTime;

      if (timeWindow <= RELOAD_WINDOW_MS) {
        console.error('[InfiniteReloadDetector] CIRCUIT BREAKER TRIGGERED!', {
          reloadCount: state.reloadCount,
          timeWindow,
          reloadEvents: state.reloadEvents
        });

        state.isTriggered = true;
        state.debugInfo = this.collectDebugInfo();
        this.saveState(state);

        // Dispatch event to show debug modal
        window.dispatchEvent(new CustomEvent('infiniteReloadDetected', {
          detail: { debugInfo: state.debugInfo }
        }));
      }
    }
  }

  private collectDebugInfo(): DebugInfo {
    const authState = this.getAuthState();
    const browserInfo = this.getBrowserInfo();
    const storageContents = this.getStorageContents();
    const networkStatus = navigator.onLine;
    const state = this.getState();

    return {
      reloadEvents: state.reloadEvents,
      authState,
      navigationHistory: [...this.navigationHistory],
      consoleErrors: [...this.consoleErrors],
      browserInfo,
      storageContents,
      networkStatus,
      componentStack: this.getReactComponentStack()
    };
  }

  private getAuthState() {
    try {
      // Try to get auth state from various sources
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && key.includes('auth') || key.includes('session') || key.includes('wewrite')) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      return {
        cookies,
        localStorage: {
          authState: localStorage.getItem('authState'),
          isAuthenticated: localStorage.getItem('isAuthenticated'),
          switchToAccount: localStorage.getItem('switchToAccount'),
          accountSwitchInProgress: localStorage.getItem('accountSwitchInProgress')
        },
        sessionStorage: {
          wewrite_accounts: sessionStorage.getItem('wewrite_accounts')
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  private getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      screen: {
        width: screen.width,
        height: screen.height
      },
      url: window.location.href,
      referrer: document.referrer,
      timestamp: new Date().toISOString()
    };
  }

  private getStorageContents() {
    try {
      const localStorage_contents: Record<string, any> = {};
      const sessionStorage_contents: Record<string, any> = {};

      // Get localStorage (sanitized)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          // Sanitize sensitive data
          if (key.includes('token') || key.includes('password') || key.includes('secret')) {
            localStorage_contents[key] = '[REDACTED]';
          } else {
            localStorage_contents[key] = value?.substring(0, 200) + (value && value.length > 200 ? '...' : '');
          }
        }
      }

      // Get sessionStorage (sanitized)
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key);
          // Sanitize sensitive data
          if (key.includes('token') || key.includes('password') || key.includes('secret')) {
            sessionStorage_contents[key] = '[REDACTED]';
          } else {
            sessionStorage_contents[key] = value?.substring(0, 200) + (value && value.length > 200 ? '...' : '');
          }
        }
      }

      return { localStorage: localStorage_contents, sessionStorage: sessionStorage_contents };
    } catch (error) {
      return { error: error.message };
    }
  }

  private getReactComponentStack(): string | undefined {
    try {
      // Try to get React component stack from error
      const error = new Error();
      return error.stack;
    } catch {
      return undefined;
    }
  }

  private getState(): CircuitBreakerState {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        // Migration: ensure reloadEvents exists on the state object
        if (!parsedState.reloadEvents) {
          parsedState.reloadEvents = parsedState.debugInfo?.reloadEvents || [];
        }
        return parsedState;
      }
    } catch (error) {
      console.warn('[InfiniteReloadDetector] Error reading state:', error);
    }

    return {
      isTriggered: false,
      reloadCount: 0,
      firstReloadTime: 0,
      lastReloadTime: 0,
      reloadEvents: [],
      debugInfo: {
        reloadEvents: [],
        authState: {},
        navigationHistory: [],
        consoleErrors: [],
        browserInfo: {},
        storageContents: {},
        networkStatus: true
      }
    };
  }

  private saveState(state: CircuitBreakerState) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('[InfiniteReloadDetector] Error saving state:', error);
    }
  }

  public isTriggered(): boolean {
    // Never trigger in development mode
    if (isDevelopment()) {
      return false;
    }
    return this.getState().isTriggered;
  }

  public getDebugInfo(): DebugInfo {
    return this.getState().debugInfo;
  }

  public reset() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      this.consoleErrors = [];
      this.navigationHistory = [window.location.href];
      console.log('[InfiniteReloadDetector] Circuit breaker reset');
    } catch (error) {
      console.warn('[InfiniteReloadDetector] Error resetting:', error);
    }
  }

  public recordManualReload(reason: string) {
    this.recordPageLoad(reason);
  }
}

// Export singleton instance
export const infiniteReloadDetector = new InfiniteReloadDetector();

// Export for manual usage
export { InfiniteReloadDetector };
export type { DebugInfo, CircuitBreakerState };
