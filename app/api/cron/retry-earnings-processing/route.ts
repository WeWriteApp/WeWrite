import { NextRequest, NextResponse } from 'next/server';
import { UsdService } from '../../../services/usdService';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const cronApiKey = process.env.CRON_API_KEY;

  return (
    (!!cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (!!cronApiKey && authHeader === `Bearer ${cronApiKey}`)
  );
}

export async function GET(request: NextRequest) {
  const correlationId = `retry_earnings_${Date.now()}`;

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', correlationId },
      { status: 401 }
    );
  }

  try {
    const result = await UsdService.retryEarningsProcessingFailures(100);
    return NextResponse.json({ success: true, correlationId, ...result });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        correlationId,
        error: error?.message || 'Failed to retry earnings processing failures',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const correlationId = `retry_earnings_manual_${Date.now()}`;

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', correlationId },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit = typeof body.limit === 'number' ? Math.max(1, Math.min(body.limit, 500)) : 100;

    const result = await UsdService.retryEarningsProcessingFailures(limit);
    return NextResponse.json({ success: true, correlationId, limit, ...result });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        correlationId,
        error: error?.message || 'Failed to retry earnings processing failures',
      },
      { status: 500 }
    );
  }
}
