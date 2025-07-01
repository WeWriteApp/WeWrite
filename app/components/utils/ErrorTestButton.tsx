'use client'

import { useState } from 'react'

/**
 * ErrorTestButton - Test button to generate errors for debugging the error capture system
 * Only shows in development mode
 */
export default function ErrorTestButton() {
  const [testCount, setTestCount] = useState(0)

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const triggerWebpackError = () => {
    setTestCount(prev => prev + 1)

    // Simulate a webpack-style error by dispatching a window error event
    const errorEvent = new ErrorEvent('error', {
      message: 'Cannot read properties of undefined (reading \'factory\')',
      filename: 'webpack://test-error.js',
      lineno: 42,
      colno: 15,
      error: new Error('Cannot read properties of undefined (reading \'factory\')')
    })

    // Dispatch the error event to trigger our error handlers
    window.dispatchEvent(errorEvent)
    console.error('🔴 Test webpack error dispatched')
  }

  const triggerPropertyError = () => {
    setTestCount(prev => prev + 1)

    // Simulate a property access error by dispatching a window error event
    const errorEvent = new ErrorEvent('error', {
      message: 'Cannot read properties of undefined (reading \'webpack\')',
      filename: 'test-component.tsx',
      lineno: 25,
      colno: 10,
      error: new Error('Cannot read properties of undefined (reading \'webpack\')')
    })

    // Dispatch the error event to trigger our error handlers
    window.dispatchEvent(errorEvent)
    console.error('🔴 Test property error dispatched')
  }

  const triggerPromiseRejection = () => {
    setTestCount(prev => prev + 1)
    
    // Create an unhandled promise rejection
    Promise.reject(new Error('Test unhandled promise rejection - webpack related'))
  }

  const triggerConsoleError = () => {
    setTestCount(prev => prev + 1)
    
    // Just log an error to console
    console.error('Test console error: Cannot read properties of undefined (reading webpack)', {
      testNumber: testCount + 1,
      timestamp: new Date().toISOString()
    })
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-red-100 border border-red-300 rounded-lg p-4 shadow-lg">
      <div className="text-sm font-semibold text-red-800 mb-2">
        Error Test Tools (Dev Only)
      </div>
      <div className="text-xs text-red-600 mb-3">
        Tests: {testCount}
      </div>
      <div className="space-y-2">
        <button
          onClick={triggerWebpackError}
          className="block w-full px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
        >
          Trigger Webpack Error
        </button>
        <button
          onClick={triggerPropertyError}
          className="block w-full px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Trigger Property Error
        </button>
        <button
          onClick={triggerPromiseRejection}
          className="block w-full px-3 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Trigger Promise Rejection
        </button>
        <button
          onClick={triggerConsoleError}
          className="block w-full px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Trigger Console Error
        </button>
      </div>
    </div>
  )
}