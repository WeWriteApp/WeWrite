/**
 * API endpoint for writer token earnings
 *
 * @deprecated This API is deprecated and will be removed in a future version.
 * Use /api/usd/earnings for USD-based earnings and payouts.
 *
 * Handles getting earnings data and requesting payouts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { TokenEarningsService } from '../../../services/tokenEarningsService';
import { FinancialOperationsService } from '../../../services/financialOperationsService';
import { FinancialUtils } from '../../../types/financial';

export async function GET(request: NextRequest) {
  // Return deprecation notice
  return NextResponse.json({
    error: 'This API endpoint has been deprecated',
    message: 'Please use /api/usd/earnings for USD-based earnings data',
    deprecated: true,
    replacement: '/api/usd/earnings'
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}

export async function POST(request: NextRequest) {
  // Return deprecation notice
  return NextResponse.json({
    error: 'This API endpoint has been deprecated',
    message: 'Please use /api/usd/earnings for USD-based earnings and payout operations',
    deprecated: true,
    replacement: '/api/usd/earnings'
  }, { status: 410 }); // 410 Gone status for deprecated endpoints
}