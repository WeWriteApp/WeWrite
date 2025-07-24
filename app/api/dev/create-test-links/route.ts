/**
 * Development API endpoint to create test page links
 * This helps verify that the graph visualization works when there are actual connections
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateTestLinksForExistingPages } from '../../../utils/createTestLinks';

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({
      error: 'This endpoint is only available in development',
      timestamp: new Date().toISOString(),
    }, { status: 403 });
  }

  try {
    console.log('🔗 [DEV] Creating test page links...');
    
    const result = await generateTestLinksForExistingPages();
    
    if (result.success) {
      console.log(`✅ [DEV] Successfully created ${result.linksCreated} test links`);
      return NextResponse.json({
        success: true,
        message: `Created ${result.linksCreated} test links`,
        linksCreated: result.linksCreated,
        timestamp: new Date().toISOString()
      }, { status: 200 });
    } else {
      console.error('❌ [DEV] Failed to create test links:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ [DEV] Error in create-test-links endpoint:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to create test links',
    description: 'This development endpoint creates test page links to verify graph functionality',
    usage: 'POST /api/dev/create-test-links',
    environment: process.env.NODE_ENV,
    available: process.env.NODE_ENV === 'development'
  }, { status: 200 });
}
