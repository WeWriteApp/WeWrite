'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import { useEffect } from 'react'
import FullPageError from '../ui/FullPageError'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

interface ErrorBoundaryProps {
  children: ReactNode
}

/**
 * NextJSErrorBoundary - Captures React errors and sends them to terminal
 * This works with Next.js's error system to catch all React component errors
 */
class NextJSErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 React Error Boundary caught error:', error)
    
    // Send to terminal via our API
    this.sendErrorToTerminal('react-error', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: errorInfo.errorBoundary,
      errorBoundaryStack: errorInfo.errorBoundaryStack
    })
  }

  private async sendErrorToTerminal(type: string, errorData: any) {
    try {
      await fetch('/api/log-console-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          args: [
            `🚨 ${type.toUpperCase()}: ${errorData.message}`,
            `📚 Stack: ${errorData.stack}`,
            `🧩 Component Stack: ${errorData.componentStack}`,
            `⏰ Time: ${new Date().toISOString()}`
          ]
        })
      })
    } catch (fetchError) {
      console.error('Failed to send error to terminal:', fetchError)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <FullPageError
          title="Something went wrong"
          message={`We encountered an unexpected error: ${this.state.error?.message || 'Unknown error'}`}
          showGoBack={true}
          showGoHome={true}
          showTryAgain={true}
          onRetry={() => window.location.reload()}
          error={this.state.error}
        />
      )
    }

    return this.props.children
  }
}

// Storage key for tracking chunk load error recovery attempts
const CHUNK_ERROR_RECOVERY_KEY = 'wewrite_chunk_error_recovery'
const CHUNK_ERROR_RECOVERY_EXPIRY = 10000 // 10 seconds - window for recovery attempts

/**
 * Check if this is a chunk load error
 */
function isChunkLoadError(error: any): boolean {
  if (!error) return false
  return (
    error.name === 'ChunkLoadError' ||
    error.message?.includes('Loading chunk') ||
    error.message?.includes('ChunkLoadError') ||
    error.message?.includes('failed to fetch dynamically imported module') ||
    error.message?.includes('Importing a module script failed')
  )
}

/**
 * Attempt to recover from a chunk load error by reloading the page
 * Uses sessionStorage to prevent infinite reload loops
 */
function attemptChunkErrorRecovery(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const recoveryData = sessionStorage.getItem(CHUNK_ERROR_RECOVERY_KEY)
    const now = Date.now()

    if (recoveryData) {
      const { timestamp, attempts } = JSON.parse(recoveryData)

      // If within the recovery window and already attempted, don't retry
      if (now - timestamp < CHUNK_ERROR_RECOVERY_EXPIRY) {
        console.log('🔄 Chunk error recovery already attempted recently, not retrying')
        return false
      }

      // If we've had multiple attempts in quick succession, something else is wrong
      if (attempts >= 2) {
        console.log('🔄 Multiple chunk error recovery attempts failed, not retrying')
        sessionStorage.removeItem(CHUNK_ERROR_RECOVERY_KEY)
        return false
      }
    }

    // Record this recovery attempt
    sessionStorage.setItem(CHUNK_ERROR_RECOVERY_KEY, JSON.stringify({
      timestamp: now,
      attempts: recoveryData ? JSON.parse(recoveryData).attempts + 1 : 1
    }))

    console.log('🔄 Attempting automatic recovery from chunk load error...')

    // Small delay to ensure the storage is written
    setTimeout(() => {
      window.location.reload()
    }, 100)

    return true
  } catch (e) {
    console.error('Failed to attempt chunk error recovery:', e)
    return false
  }
}

/**
 * Clear chunk error recovery state (call this on successful page load)
 */
function clearChunkErrorRecoveryState() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(CHUNK_ERROR_RECOVERY_KEY)
  } catch (e) {
    // Ignore errors
  }
}

/**
 * GlobalErrorHandler - Captures all global errors including ChunkLoadErrors
 * This component should be placed at the root level
 *
 * In production: Automatically recovers from ChunkLoadErrors by reloading
 * In development: Also logs errors to terminal for debugging
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isDev = process.env.NODE_ENV === 'development'

    // Clear recovery state on successful page load
    clearChunkErrorRecoveryState()

    if (isDev) {
      console.log('🔧 NextJS Error Handler: Initializing...')
    }

    // Global error handler for uncaught errors (including ChunkLoadError)
    const handleError = (event: ErrorEvent) => {
      const error = event.error

      // Check for chunk load errors and attempt recovery (works in both dev and prod)
      if (isChunkLoadError(error)) {
        console.error('🚨 Chunk load error detected:', error?.message)
        if (attemptChunkErrorRecovery()) {
          event.preventDefault() // Prevent default error handling since we're recovering
          return
        }
      }

      // Only send to terminal in development
      if (isDev) {
        const errorInfo = {
          message: error?.message || event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: error?.stack,
          type: error?.constructor?.name || 'Error'
        }

        sendToTerminal('uncaught-error', [
          `🚨 ${errorInfo.type}: ${errorInfo.message}`,
          `📁 File: ${errorInfo.filename}:${errorInfo.lineno}:${errorInfo.colno}`,
          `📚 Stack: ${errorInfo.stack || 'No stack trace'}`,
          `⏰ Time: ${new Date().toISOString()}`
        ])
      }
    }

    // Global handler for unhandled promise rejections (ChunkLoadError often appears here)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason

      // Check for chunk load errors and attempt recovery (works in both dev and prod)
      if (isChunkLoadError(reason)) {
        console.error('🚨 Chunk load error detected in promise rejection:', reason?.message)
        if (attemptChunkErrorRecovery()) {
          event.preventDefault() // Prevent default error handling since we're recovering
          return
        }
      }

      // Only send to terminal in development
      if (isDev) {
        sendToTerminal('unhandled-rejection', [
          `🚨 ${isChunkLoadError(reason) ? 'ChunkLoadError' : 'Promise Rejection'}: ${reason?.message || reason}`,
          `📚 Stack: ${reason?.stack || 'No stack trace'}`,
          `⏰ Time: ${new Date().toISOString()}`,
          isChunkLoadError(reason) ? '🔄 This is likely a hot-reload or build issue' : ''
        ].filter(Boolean))
      }
    }

    // Next.js specific error handler for router errors
    const handleRouterError = (url: string, { err }: { err: Error }) => {
      // Check for chunk load errors in router errors
      if (isChunkLoadError(err)) {
        console.error('🚨 Chunk load error detected in router:', err?.message)
        attemptChunkErrorRecovery()
        return
      }

      if (isDev) {
        sendToTerminal('router-error', [
          `🚨 Router Error on ${url}: ${err.message}`,
          `📚 Stack: ${err.stack || 'No stack trace'}`,
          `⏰ Time: ${new Date().toISOString()}`
        ])
      }
    }

    // Add event listeners
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Try to hook into Next.js router if available
    if ((window as any).next?.router?.events) {
      (window as any).next.router.events.on('routeChangeError', handleRouterError)
    }

    // Cleanup function
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      if ((window as any).next?.router?.events) {
        (window as any).next.router.events.off('routeChangeError', handleRouterError)
      }
    }
  }, [])

  return null // This component doesn't render anything
}

async function sendToTerminal(type: string, messages: string[]) {
  try {
    await fetch('/api/log-console-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        message: messages.join('\n'), // Convert messages array to a single message string
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
      })
    })
  } catch (error) {
    console.error('Failed to send error to terminal:', error)
  }
}

export default NextJSErrorBoundary
