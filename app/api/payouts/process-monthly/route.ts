/**
 * Simplified monthly payout processor
 * Runs pending simple payouts via Storage Balance transfers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PayoutService } from '../../../services/payoutService';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.CRON_API_KEY;

    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await PayoutService.processAllPending();

    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      message: 'Processed pending payouts via storage balance'
    });
  } catch (error: any) {
    console.error('Error processing monthly payouts:', error);
    return NextResponse.json({
      error: 'Failed to process monthly payouts',
      details: error?.message || String(error)
    }, { status: 500 });
  }
}
