/**
 * Development endpoint to create test token allocations
 * This bypasses normal validation for testing purposes
 *
 * @deprecated This API is deprecated as the token system has been migrated to USD.
 * Use USD-based allocation testing instead.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // DEPRECATED: Token allocation testing has been migrated to USD system
  return NextResponse.json({
    deprecated: true,
    message: 'Token allocation testing has been migrated to USD system. Use USD-based allocation testing instead.',
    replacement: '/api/usd/allocations',
    data: null
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}
