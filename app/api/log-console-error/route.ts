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
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ success: false, message: 'Only available in development' }, { status: 403 })
    }

    // Parse request body to check log level
    const body = await request.json()
    const { level } = body

    // Extract all fields from body, including message for filtering
    const {
      message = '',
      timestamp,
      url,
      userAgent,
      filename,
      lineno,
      colno,
      stack,
      stackAnalysis,
      isGoogleApiError,
      scriptTags,
      type,
      // Enhanced subscription error fields
      errorType,
      originalArgs,
      stackTrace,
      reactInfo,
      subscriptionStates,
      timingInfo,
      // Additional enhanced fields
      enhancedStack,
      componentInfo,
      sourceMapInfo,
      componentContext,
      errorName,
      additionalContext
    } = body

    // Skip common non-critical errors to reduce spam
    const ignoredErrors = [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Script error',
      'Network request failed',
      'Loading chunk',
      'ChunkLoadError',
      'Loading CSS chunk',
      'Unsupported prop change: options.clientSecret', // Stripe warning
      'You may test your Stripe.js integration over HTTP' // Stripe dev warning
    ]

    if (ignoredErrors.some(ignored => message.includes(ignored))) {
      return NextResponse.json({ success: true, skipped: true })
    }

    // Only process errors and important warnings
    if (level === 'log' || level === 'info') {
      return NextResponse.json({ success: true, skipped: true })
    }

    // Check if this is a subscription error for enhanced logging
    const isSubscriptionError = [
      'SUBSCRIPTION_TEMPORAL_DEAD_ZONE',
      'SUBSCRIPTION_TEMPORAL_DEAD_ZONE_ENHANCED',
      'SUBSCRIPTION_COMPONENT_ERROR',
      'SUBSCRIPTION_VARIABLE_ACCESS_ERROR',
      'SUBSCRIPTION_EFFECT_EXECUTION_ERROR'
    ].includes(errorType) || (message && (
      message.includes('subscription') ||
      message.includes('Cannot access') ||
      message.includes('before initialization') ||
      message.includes('temporal dead zone')
    ))

    if (isSubscriptionError && level === 'error') {
      console.log('\n🔴 SUBSCRIPTION ERROR DETECTED - ENHANCED DEBUGGING:');
      console.log('═'.repeat(100));
      console.log('📍 Error Type:', errorType || 'SUBSCRIPTION_ERROR');
      console.log('📍 Error Message:', message);
      console.log('📍 URL:', url);
      console.log('📍 Timestamp:', timestamp);

      if (originalArgs && originalArgs.length > 0) {
        console.log('📍 Original Arguments:');
        originalArgs.forEach((arg, index) => {
          console.log(`   [${index}]:`, arg);
        });
      }

      if (reactInfo) {
        console.log('📍 React Component Info:');
        console.log('   Component Name:', reactInfo.componentName);
        console.log('   Component Stack:', reactInfo.componentStack);
        if (reactInfo.props) {
          console.log('   Props:', JSON.stringify(reactInfo.props, null, 4));
        }
        if (reactInfo.state) {
          console.log('   State:', JSON.stringify(reactInfo.state, null, 4));
        }
        if (reactInfo.error) {
          console.log('   React Info Error:', reactInfo.error);
        }
      }

      if (subscriptionStates) {
        console.log('📍 Subscription Variable States:');
        Object.entries(subscriptionStates).forEach(([key, value]) => {
          console.log(`   ${key}:`, value);
        });
      }

      if (timingInfo) {
        console.log('📍 Timing Information:');
        console.log('   Performance Now:', timingInfo.performanceNow);
        console.log('   Document Ready State:', timingInfo.documentReadyState);
        console.log('   Window Loaded:', timingInfo.windowLoaded);
        console.log('   DOM Content Loaded:', timingInfo.domContentLoaded);
        if (timingInfo.navigationTiming) {
          console.log('   Navigation Timing:', JSON.stringify(timingInfo.navigationTiming, null, 4));
        }
        if (timingInfo.componentLifecycle) {
          console.log('   Component Lifecycle:', timingInfo.componentLifecycle);
        }
        if (timingInfo.error) {
          console.log('   Timing Info Error:', timingInfo.error);
        }
      }

      if (stackTrace) {
        console.log('📍 Enhanced Stack Trace:');
        console.log(stackTrace);
      }

      if (enhancedStack && enhancedStack.length > 0) {
        console.log('📍 Enhanced Stack Analysis:');
        enhancedStack.forEach((frame, index) => {
          console.log(`   [${index}] ${frame.functionName} at ${frame.fileName}:${frame.lineNumber}:${frame.columnNumber}`);
          if (frame.originalPosition) {
            console.log(`       → Original: ${frame.originalPosition.source}:${frame.originalPosition.line}:${frame.originalPosition.column}`);
          }
        });
      }

      if (componentInfo) {
        console.log('📍 Enhanced Component Info:');
        console.log('   Component Name:', componentInfo.componentName);
        console.log('   Component Type:', componentInfo.componentType);
        if (componentInfo.propsKeys) {
          console.log('   Props Keys:', componentInfo.propsKeys);
        }
        if (componentInfo.error) {
          console.log('   Component Info Error:', componentInfo.error);
        }
      }

      if (sourceMapInfo) {
        console.log('📍 Source Map Info:');
        console.log('   Development Mode:', sourceMapInfo.development);
        console.log('   Has Source Maps:', sourceMapInfo.hasSourceMaps);
      }

      if (componentContext) {
        console.log('📍 Component Context:');
        console.log('   Component Name:', componentContext.componentName);
        if (componentContext.timing) {
          console.log('   Timing:', JSON.stringify(componentContext.timing, null, 4));
        }
        if (componentContext.variableAccessLog) {
          console.log('   Variable Access Log:', JSON.stringify(componentContext.variableAccessLog, null, 4));
        }
        if (componentContext.effectExecutionLog) {
          console.log('   Effect Execution Log:', JSON.stringify(componentContext.effectExecutionLog, null, 4));
        }
      }

      if (additionalContext) {
        console.log('📍 Additional Context:');
        console.log(JSON.stringify(additionalContext, null, 4));
      }

      if (filename) {
        console.log('📍 File Location:', `${filename}:${lineno}:${colno}`);
      }

      console.log('📍 User Agent:', userAgent);
      console.log('📍 Full Body:', JSON.stringify(body, null, 2));
      console.log('═'.repeat(100));
    }

    // Enhanced logging for Google API errors
    const isGoogleError = isGoogleApiError || (message && (
      message.includes('apiKey') ||
      message.includes('authenticator') ||
      message.includes('google')
    ));

    if (isGoogleError && level === 'error') {
      console.log('\n🔍 GOOGLE API ERROR DETECTED - ENHANCED DEBUGGING:');
      console.log('📍 Error Message:', message);
      console.log('📍 Error Type:', type || 'unknown');
      console.log('📍 Stack Analysis:', stackAnalysis);
      console.log('📍 Filename:', filename);
      console.log('📍 Line/Column:', `${lineno}:${colno}`);
      console.log('📍 Script Tags:', scriptTags);
      console.log('📍 Full Stack:', stack);
      console.log('📍 URL:', url);
      console.log('📍 User Agent:', userAgent);
      console.log('📍 Full Body:', JSON.stringify(body, null, 2));
      console.log('─'.repeat(80));
    }

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
    if (userAgent && (level === 'error' || (message && message.includes('Firebase')))) {
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
      'Access-Control-Allow-Headers': 'Content-Type'}})
}