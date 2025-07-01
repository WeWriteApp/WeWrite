'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the global error with maximum detail
    console.error('GLOBAL APPLICATION ERROR:', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      name: error.name,
      cause: error.cause,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      referrer: typeof document !== 'undefined' ? document.referrer : 'server',
      errorType: 'GLOBAL_ERROR'})
    
    // Also log to any external error reporting service if configured
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: true
      });
    }
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
          <div className="max-w-4xl w-full bg-white border border-red-300 rounded-lg p-8 shadow-lg">
            <h1 className="text-3xl font-bold text-red-800 mb-6">Critical Application Error</h1>
            
            <div className="space-y-6">
              <div className="bg-red-100 border border-red-300 rounded p-4">
                <h2 className="text-xl font-semibold text-red-700 mb-2">Error Details:</h2>
                <p className="text-red-600 font-mono text-sm">
                  {error.message || 'A critical error occurred that prevented the application from loading'}
                </p>
              </div>
              
              {error.digest && (
                <div className="bg-orange-100 border border-orange-300 rounded p-4">
                  <h2 className="text-lg font-semibold text-orange-700">Error Digest:</h2>
                  <p className="text-orange-600 font-mono text-sm">
                    {error.digest}
                  </p>
                </div>
              )}
              
              {error.stack && (
                <div className="bg-gray-100 border border-gray-300 rounded p-4">
                  <h2 className="text-lg font-semibold text-gray-700">Full Stack Trace:</h2>
                  <pre className="text-gray-600 font-mono text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </div>
              )}
              
              <div className="bg-blue-100 border border-blue-300 rounded p-4">
                <h2 className="text-lg font-semibold text-blue-700">Debugging Information:</h2>
                <ul className="text-blue-600 text-sm space-y-1">
                  <li>• Check the browser console for additional error details</li>
                  <li>• Check the terminal/server logs for server-side errors</li>
                  <li>• Verify all required dependencies are installed</li>
                  <li>• Check for syntax errors in your code</li>
                  <li>• Ensure all imports are correctly resolved</li>
                </ul>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  onClick={reset}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  Go to Home
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}