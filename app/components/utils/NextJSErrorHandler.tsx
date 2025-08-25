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

/**
 * GlobalErrorHandler - Captures all global errors including ChunkLoadErrors
 * This component should be placed at the root level
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
      return
    }

    console.log('🔧 NextJS Error Handler: Initializing...')

    // Global error handler for uncaught errors (including ChunkLoadError)
    const handleError = (event: ErrorEvent) => {
      const errorInfo = {
        message: event.error?.message || event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        type: event.error?.constructor?.name || 'Error'
      }
      
      sendToTerminal('uncaught-error', [
        `🚨 ${errorInfo.type}: ${errorInfo.message}`,
        `📁 File: ${errorInfo.filename}:${errorInfo.lineno}:${errorInfo.colno}`,
        `📚 Stack: ${errorInfo.stack || 'No stack trace'}`,
        `⏰ Time: ${new Date().toISOString()}`
      ])
    }

    // Global handler for unhandled promise rejections (ChunkLoadError often appears here)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const isChunkError = reason?.name === 'ChunkLoadError' || 
                          reason?.message?.includes('Loading chunk') ||
                          reason?.message?.includes('ChunkLoadError')
      
      sendToTerminal('unhandled-rejection', [
        `🚨 ${isChunkError ? 'ChunkLoadError' : 'Promise Rejection'}: ${reason?.message || reason}`,
        `📚 Stack: ${reason?.stack || 'No stack trace'}`,
        `⏰ Time: ${new Date().toISOString()}`,
        isChunkError ? '🔄 This is likely a hot-reload or build issue' : ''
      ].filter(Boolean))
    }

    // Next.js specific error handler for router errors
    const handleRouterError = (url: string, { err }: { err: Error }) => {
      sendToTerminal('router-error', [
        `🚨 Router Error on ${url}: ${err.message}`,
        `📚 Stack: ${err.stack || 'No stack trace'}`,
        `⏰ Time: ${new Date().toISOString()}`
      ])
    }

    // Add event listeners
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Try to hook into Next.js router if available
    if (typeof window !== 'undefined' && (window as any).next?.router?.events) {
      (window as any).next.router.events.on('routeChangeError', handleRouterError)
    }

    // Cleanup function
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      if (typeof window !== 'undefined' && (window as any).next?.router?.events) {
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
