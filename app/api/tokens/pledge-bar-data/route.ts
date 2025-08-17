/**
 * Fast PledgeBar Data API
 *
 * @deprecated This API is deprecated and will be removed in a future version.
 * Use /api/usd/pledge-bar-data for USD-based pledge bar data.
 *
 * Optimized endpoint specifically for PledgeBar component that returns
 * only the essential data needed for fast loading.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // DEPRECATED: Token pledge bar data has been migrated to USD system
  return NextResponse.json({
    deprecated: true,
    message: 'Token pledge bar data has been migrated to USD system. Use USD-based pledge bar data instead.',
    replacement: '/api/usd/pledge-bar-data',
    data: null
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}
