import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { optimizeReads } from '../../../utils/emergencyReadOptimizer';

/**
 * POST /api/monitoring/optimize
 * Manually trigger database read optimization
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Require admin access for optimization
    const userId = await getUserIdFromRequest(request);

    console.log(`🔧 Manual optimization triggered by user: ${userId || 'anonymous'}`);
    
    // Trigger optimization
    await optimizeReads();

    return NextResponse.json({
      success: true,
      message: 'Optimization triggered successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error triggering optimization:', error);
    return NextResponse.json({
      error: 'Failed to trigger optimization',
      details: error.message
    }, { status: 500 });
  }
}
