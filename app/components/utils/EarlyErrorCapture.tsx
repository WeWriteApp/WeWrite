'use client'

/**
 * EarlyErrorCapture - Injects error capture script into document head
 * This runs before React and captures errors that happen during initial page load
 */
export default function EarlyErrorCapture() {
  // Only run in development and in browser
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return null
  }

  // Inject early error capture script
  if (typeof document !== 'undefined' && !document.getElementById('early-error-capture')) {
    const script = document.createElement('script')
    script.id = 'early-error-capture'
    script.innerHTML = `
      (function() {
        console.log('🔧 Early Error Capture: Initializing...');
        
        // Capture errors immediately
        window.addEventListener('error', function(event) {
          const message = event.message || 'Unknown error';
          const filename = event.filename || 'Unknown file';
          const lineno = event.lineno || 0;
          const colno = event.colno || 0;
          const stack = event.error?.stack || 'No stack trace';
          
          // Check for webpack/property errors
          const isWebpackError = message.includes('webpack') ||
                               message.includes('Cannot read properties of undefined') ||
                               message.includes('options.factory') ||
                               message.includes('reading webpack') ||
                               message.includes('reading \\'webpack\\'') ||
                               filename.includes('webpack') ||
                               stack.includes('webpack');
          
          const isPropertyError = message.includes('Cannot read properties') ||
                                message.includes('Cannot read property') ||
                                message.includes('reading \\'') ||
                                message.includes('reading "');
          
          if (isWebpackError || isPropertyError) {
            console.error('🔴 EARLY ERROR CAPTURED:', {
              message: message,
              filename: filename,
              lineno: lineno,
              colno: colno,
              stack: stack,
              timestamp: new Date().toISOString(),
              type: isWebpackError ? 'webpack-error' : 'property-error'
            });
            
            // Send to server immediately
            fetch('/api/log-console-error', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                level: 'error',
                message: 'EARLY CAPTURE: ' + message,
                timestamp: Date.now(),
                url: window.location.href,
                filename: filename,
                lineno: lineno,
                colno: colno,
                stack: stack,
                type: isWebpackError ? 'early-webpack-error' : 'early-property-error',
                userAgent: navigator.userAgent
              })
            }).catch(function(fetchError) {
              console.error('🔴 Early capture failed to send error:', fetchError);
            });
          }
        }, true); // Use capture phase
        
        // Also capture promise rejections
        window.addEventListener('unhandledrejection', function(event) {
          const reason = event.reason instanceof Error
            ? event.reason.message
            : typeof event.reason === 'string'
              ? event.reason
              : JSON.stringify(event.reason);
          
          console.error('🔴 EARLY PROMISE REJECTION:', reason);
          
          fetch('/api/log-console-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              level: 'error',
              message: 'EARLY PROMISE REJECTION: ' + reason,
              timestamp: Date.now(),
              url: window.location.href,
              type: 'early-promise-rejection',
              userAgent: navigator.userAgent
            })
          }).catch(function(fetchError) {
            console.error('🔴 Early capture failed to send rejection:', fetchError);
          });
        });
        
        console.log('🔧 Early Error Capture: Ready');
      })();
    `
    
    // Insert at the very beginning of head
    const head = document.head || document.getElementsByTagName('head')[0]
    if (head.firstChild) {
      head.insertBefore(script, head.firstChild)
    } else {
      head.appendChild(script)
    }
    
    console.log('🔧 Early Error Capture: Script injected')
  }

  return null // This component doesn't render anything
}