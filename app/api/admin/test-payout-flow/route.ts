/**
 * Admin API for testing the complete payout flow end-to-end
 *
 * @deprecated This API is deprecated as the token system has been migrated to USD.
 * Use USD-based payout testing instead.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // DEPRECATED: Token payout testing has been migrated to USD system
  return NextResponse.json({
    deprecated: true,
    message: 'Token payout testing has been migrated to USD system. Use USD-based payout testing instead.',
    replacement: '/api/payouts/test',
    data: null
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}