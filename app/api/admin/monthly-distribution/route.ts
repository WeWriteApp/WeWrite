/**
 * Admin API for manually triggering monthly token distribution processing
 *
 * @deprecated This API is deprecated as the token system has been migrated to USD.
 * Use USD-based payout processing instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';

export async function POST(request: NextRequest) {
  // DEPRECATED: Token distribution has been migrated to USD system
  return NextResponse.json({
    deprecated: true,
    message: 'Token distribution has been migrated to USD system. Use USD-based payout processing instead.',
    replacement: '/api/payouts/process-monthly',
    data: null
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}