import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/log-console-error
 * 
 * Receives browser console errors and logs them to the server terminal
 * This helps with debugging by showing browser errors in the development terminal
 */
export async function POST(request) {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ success: false, message: 'Only available in development' }, { status: 403 })
    }

    // Handle malformed JSON gracefully
    let body;
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error('Invalid JSON in log-console-error request:', jsonError.message)
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const { level, message, timestamp, url, userAgent, filename, lineno, colno, stack } = body

    // Format the log message for terminal output
    const logPrefixes = {
      'error': '🔴 BROWSER ERROR:',
      'warn': '🟡 BROWSER WARNING:',
      'log': '🔵 BROWSER LOG:',
      'info': '🟢 BROWSER INFO:'
    }
    const logPrefix = logPrefixes[level] || '⚪ BROWSER:'
    const timeStr = new Date(timestamp).toLocaleTimeString()

    let logMessage = `\n${logPrefix} [${timeStr}]`
    logMessage += `\n📍 URL: ${url}`
    logMessage += `\n💬 Message: ${message}`

    if (filename) {
      logMessage += `\n📁 File: ${filename}:${lineno}:${colno}`
    }

    if (stack) {
      logMessage += `\n📚 Stack:\n${stack}`
    }

    // Add user agent for debugging browser-specific issues
    if (userAgent && (level === 'error' || message.includes('Firebase'))) {
      const browserInfo = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/)?.[0] || 'Unknown'
      logMessage += `\n🌐 Browser: ${browserInfo}`
    }

    logMessage += `\n${'─'.repeat(80)}\n`

    // Log to server console (will appear in terminal)
    switch (level) {
      case 'error':
        console.error(logMessage)
        break
      case 'warn':
        console.warn(logMessage)
        break
      case 'info':
        console.info(logMessage)
        break
      default:
        console.log(logMessage)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in log-console-error endpoint:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
