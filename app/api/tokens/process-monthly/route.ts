/**
 * API endpoint for processing monthly token distribution
 * This should be called by a cron job on the 1st of each month
 *
 * @deprecated This API is deprecated as the token system has been migrated to USD.
 * Use USD-based monthly processing instead.
 */

import { NextRequest, NextResponse } from 'next/server';

// This endpoint should be protected by API key or admin auth in production
export async function POST(request: NextRequest) {
  // DEPRECATED: Token monthly processing has been migrated to USD system
  return NextResponse.json({
    deprecated: true,
    message: 'Token monthly processing has been migrated to USD system. Use USD-based monthly processing instead.',
    replacement: '/api/payouts/process-monthly',
    data: null
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}

// GET endpoint for checking distribution status
export async function GET(request: NextRequest) {
  // DEPRECATED: Token distribution status has been migrated to USD system
  return NextResponse.json({
    deprecated: true,
    message: 'Token distribution status has been migrated to USD system. Use USD-based status checking instead.',
    replacement: '/api/payouts/status',
    data: null
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}