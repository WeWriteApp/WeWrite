import { NextRequest, NextResponse } from 'next/server';
import { getUrlDebugInfo } from '../../../utils/urlConfig';

/**
 * Debug endpoint for URL configuration troubleshooting
 * 
 * This endpoint helps diagnose URL-related issues in production,
 * especially for Stripe integrations that require return URLs.
 */
export async function GET(request: NextRequest) {
  try {
    const debugInfo = getUrlDebugInfo();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...debugInfo,
    });
  } catch (error) {
    console.error('Error getting URL debug info:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get URL debug information',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to get URL debug information.' },
    { status: 405 }
  );
}
