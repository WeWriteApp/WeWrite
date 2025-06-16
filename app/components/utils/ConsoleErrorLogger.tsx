'use client'

import { useEffect } from 'react'

/**
 * ConsoleErrorLogger - Captures browser console errors and sends them to the server
 * This helps debug issues by showing browser console errors in the terminal
 */
export default function ConsoleErrorLogger() {
  useEffect(() => {
    // Only run in development mode
    if (process.env.NODE_ENV !== 'development') {
      return
    }

    // Store original console methods
    const originalError = console.error
    const originalWarn = console.warn
    const originalLog = console.log
    const originalInfo = console.info

    // Helper function to format arguments
    const formatArgs = (args: any[]) => {
      return args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2)
          } catch (e) {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' ')
    }

    // Helper function to send to server
    const sendToServer = (level: string, message: string, extra?: any) => {
      fetch('/api/log-console-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level,
          message,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          ...extra
        })
      }).catch(() => {
        // Silently fail if logging endpoint is not available
      })
    }

    // Override console.error to capture ALL errors
    console.error = function(...args) {
      // Call original console.error first
      originalError.apply(console, args)

      // Send ALL errors to server for terminal logging
      const errorMessage = formatArgs(args)
      sendToServer('error', errorMessage)
    }

    // Override console.warn to capture ALL warnings
    console.warn = function(...args) {
      // Call original console.warn first
      originalWarn.apply(console, args)

      // Send ALL warnings to server
      const warningMessage = formatArgs(args)
      sendToServer('warn', warningMessage)
    }

    // Override console.log to capture important logs
    console.log = function(...args) {
      // Call original console.log first
      originalLog.apply(console, args)

      // Only send Firebase/Firestore/Error related logs to reduce noise
      const logMessage = formatArgs(args)
      if (logMessage.includes('Firebase') ||
          logMessage.includes('Firestore') ||
          logMessage.includes('Error') ||
          logMessage.includes('Failed') ||
          logMessage.includes('failed') ||
          logMessage.includes('error')) {
        sendToServer('log', logMessage)
      }
    }

    // Override console.info for important info
    console.info = function(...args) {
      // Call original console.info first
      originalInfo.apply(console, args)

      // Send Firebase/Firestore related info
      const infoMessage = formatArgs(args)
      if (infoMessage.includes('Firebase') ||
          infoMessage.includes('Firestore') ||
          infoMessage.includes('Error') ||
          infoMessage.includes('Failed')) {
        sendToServer('info', infoMessage)
      }
    }

    // Capture unhandled errors
    const handleUnhandledError = (event: ErrorEvent) => {
      fetch('/api/log-console-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          message: `Unhandled Error: ${event.message}`,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(() => {
        // Silently fail if logging endpoint is not available
      })
    }

    // Capture unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      fetch('/api/log-console-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          message: `Unhandled Promise Rejection: ${event.reason}`,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(() => {
        // Silently fail if logging endpoint is not available
      })
    }

    // Capture network errors (like Firebase connection issues)
    const originalFetch = window.fetch
    window.fetch = async function(...args) {
      try {
        const response = await originalFetch.apply(this, args)

        // Log failed Firebase requests
        if (!response.ok && args[0] && String(args[0]).includes('firestore')) {
          sendToServer('error', `Firebase Network Error: ${response.status} ${response.statusText} for ${args[0]}`, {
            status: response.status,
            statusText: response.statusText,
            url: args[0]
          })
        }

        return response
      } catch (error) {
        // Log network failures
        if (args[0] && String(args[0]).includes('firestore')) {
          sendToServer('error', `Firebase Network Failure: ${error.message} for ${args[0]}`, {
            error: error.message,
            url: args[0]
          })
        }
        throw error
      }
    }

    // Add event listeners
    window.addEventListener('error', handleUnhandledError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Cleanup function
    return () => {
      console.error = originalError
      console.warn = originalWarn
      console.log = originalLog
      console.info = originalInfo
      window.fetch = originalFetch
      window.removeEventListener('error', handleUnhandledError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null // This component doesn't render anything
}
