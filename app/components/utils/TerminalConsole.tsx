'use client';

import { useEffect } from 'react';

/**
 * Terminal Console Stream
 * Sends browser console logs directly to terminal via WebSocket
 */
export default function TerminalConsole() {
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isConnected = false;

    // Store original console methods
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    function sendToTerminal(type: string, message: string) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      
      try {
        ws.send(JSON.stringify({
          type,
          message,
          timestamp: new Date().toISOString(),
          source: 'wewrite-browser'
        }));
      } catch (error) {
        // Silently fail if WebSocket is not available
      }
    }

    function formatArgs(args: any[]): string {
      return args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
    }

    // Override console methods
    console.log = function(...args) {
      originalConsole.log.apply(console, args);
      sendToTerminal('log', formatArgs(args));
    };

    console.error = function(...args) {
      originalConsole.error.apply(console, args);
      sendToTerminal('error', formatArgs(args));
    };

    console.warn = function(...args) {
      originalConsole.warn.apply(console, args);
      sendToTerminal('warn', formatArgs(args));
    };

    console.info = function(...args) {
      originalConsole.info.apply(console, args);
      sendToTerminal('info', formatArgs(args));
    };

    console.debug = function(...args) {
      originalConsole.debug.apply(console, args);
      sendToTerminal('debug', formatArgs(args));
    };

    // DEPRECATED: WebSocket console streaming - replaced with HTTP-based ConsoleErrorLogger
    function connect() {
      // COMPLETELY DISABLED: This WebSocket implementation is deprecated
      // We now use the HTTP-based ConsoleErrorLogger.tsx for terminal logging
      // which is more reliable and doesn't cause connection errors
      console.log('TerminalConsole: WebSocket streaming disabled - using HTTP-based logging instead');
      return;
    }

    // Intercept unhandled errors
    const handleError = (event: ErrorEvent) => {
      sendToTerminal('error', `❌ Unhandled Error: ${event.error?.message || event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      sendToTerminal('error', `❌ Unhandled Promise Rejection: ${event.reason}`);
    };

    // Add error listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // DEPRECATED: Initial connection disabled
    // WebSocket console streaming has been replaced with HTTP-based ConsoleErrorLogger

    // Cleanup
    return () => {
      // Restore original console methods
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
      console.debug = originalConsole.debug;

      // Remove error listeners
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);

      // Close WebSocket
      if (ws) {
        ws.close();
      }

      // Clear reconnect timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  return null;
}