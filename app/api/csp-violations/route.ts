/**
 * Content Security Policy Violation Handler
 * 
 * Handles CSP violation reports to help identify and fix security issues
 */

import { NextRequest, NextResponse } from 'next/server';

interface CSPViolation {
  'blocked-uri': string;
  'violated-directive': string;
  'original-policy': string;
  'document-uri': string;
  'referrer': string;
  'status-code': number;
  'script-sample': string;
}

interface CSPReport {
  'csp-report': CSPViolation;
}

export async function POST(request: NextRequest) {
  try {
    const report: CSPReport = await request.json();
    const violation = report['csp-report'];
    
    // Log CSP violation with structured data
    console.warn('🚨 CSP Violation Detected:', {
      blockedURI: violation['blocked-uri'],
      violatedDirective: violation['violated-directive'],
      documentURI: violation['document-uri'],
      referrer: violation['referrer'],
      statusCode: violation['status-code'],
      scriptSample: violation['script-sample'],
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    // Categorize violations for better analysis
    const violationType = categorizeViolation(violation);
    
    // Only log significant violations to avoid spam
    if (violationType.severity === 'high') {
      console.error('🔴 High Severity CSP Violation:', {
        type: violationType.type,
        description: violationType.description,
        violation
      });
      
      // In production, you might want to send this to an error tracking service
      if (process.env.NODE_ENV === 'production') {
        await reportToMonitoring(violation, violationType);
      }
    }

    return NextResponse.json({ 
      received: true,
      severity: violationType.severity,
      type: violationType.type
    });

  } catch (error) {
    console.error('Error processing CSP violation report:', error);
    return NextResponse.json({ 
      error: 'Failed to process violation report' 
    }, { status: 500 });
  }
}

/**
 * Categorize CSP violations by type and severity
 */
function categorizeViolation(violation: CSPViolation) {
  const blockedURI = violation['blocked-uri'];
  const directive = violation['violated-directive'];

  // Browser extension violations (usually safe to ignore)
  if (blockedURI.includes('extension://') || 
      blockedURI.includes('chrome-extension://') ||
      blockedURI.includes('moz-extension://') ||
      blockedURI.includes('safari-extension://')) {
    return {
      type: 'browser-extension',
      severity: 'low',
      description: 'Browser extension attempting to inject content'
    };
  }

  // Inline script violations
  if (directive.includes('script-src') && blockedURI === 'inline') {
    return {
      type: 'inline-script',
      severity: 'medium',
      description: 'Inline script blocked by CSP'
    };
  }

  // External script violations
  if (directive.includes('script-src') && blockedURI.startsWith('http')) {
    return {
      type: 'external-script',
      severity: 'high',
      description: 'External script blocked by CSP'
    };
  }

  // Data URI violations
  if (blockedURI.startsWith('data:')) {
    return {
      type: 'data-uri',
      severity: 'medium',
      description: 'Data URI blocked by CSP'
    };
  }

  // Eval violations
  if (blockedURI === 'eval') {
    return {
      type: 'eval',
      severity: 'high',
      description: 'eval() usage blocked by CSP'
    };
  }

  // Unknown violations
  return {
    type: 'unknown',
    severity: 'medium',
    description: 'Unknown CSP violation type'
  };
}

/**
 * Report high-severity violations to monitoring service
 */
async function reportToMonitoring(violation: CSPViolation, violationType: any) {
  try {
    // This could be sent to your error tracking service
    // For now, we'll just log it
    console.error('🚨 CSP Violation Report:', {
      violation,
      violationType,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });

    // Example: Send to external monitoring service
    // await fetch('https://your-monitoring-service.com/csp-violations', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ violation, violationType })
    // });

  } catch (error) {
    console.error('Failed to report CSP violation to monitoring:', error);
  }
}

// Handle GET requests (CSP reports are typically POST, but just in case)
export async function GET() {
  return NextResponse.json({
    message: 'CSP violation reporting endpoint',
    method: 'POST',
    description: 'Send CSP violation reports to this endpoint'
  });
}
