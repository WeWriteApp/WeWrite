import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/log-console-error
 *
 * Receives browser console errors and logs them to the server terminal
 * This helps with debugging by showing browser errors in the development terminal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, level, stack, url, line, column, ...extra } = body

    // Only log warnings and errors to reduce noise
    if (level === 'warn' || level === 'error') {
      console.log(`[BROWSER ${level?.toUpperCase()}] ${message}`)

      // Log additional context if available
      if (stack) {
        console.log(`[BROWSER STACK] ${stack}`)
      }

      if (url) {
        console.log(`[BROWSER LOCATION] ${url}:${line}:${column}`)
      }

      // Log any extra data
      if (Object.keys(extra).length > 0) {
        console.log(`[BROWSER EXTRA]`, extra)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[LOG-CONSOLE-ERROR] Failed to process log:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'}})
}