'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to the console with full details
    console.error('Application Error:', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      name: error.name,
      cause: error.cause,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server'})
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-red-50 border border-red-200 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-red-800 mb-4">Application Error</h1>
        
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-red-700">Error Message:</h2>
            <p className="text-red-600 font-mono text-sm bg-red-100 p-2 rounded">
              {error.message || 'Unknown error occurred'}
            </p>
          </div>
          
          {error.digest && (
            <div>
              <h2 className="text-lg font-semibold text-red-700">Error Digest:</h2>
              <p className="text-red-600 font-mono text-sm bg-red-100 p-2 rounded">
                {error.digest}
              </p>
            </div>
          )}
          
          {error.stack && (
            <div>
              <h2 className="text-lg font-semibold text-red-700">Stack Trace:</h2>
              <pre className="text-red-600 font-mono text-xs bg-red-100 p-2 rounded overflow-auto max-h-64">
                {error.stack}
              </pre>
            </div>
          )}
          
          <div className="flex gap-4 pt-4">
            <button
              onClick={reset}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}