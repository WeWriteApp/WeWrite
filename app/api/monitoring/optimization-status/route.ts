import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getOptimizationStatus } from '../../../utils/emergencyReadOptimizer';
import { getCacheStats } from '../../../middleware/readOptimizationMiddleware';

/**
 * GET /api/monitoring/optimization-status
 * Get current optimization status including circuit breakers, rate limiters, etc.
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Require admin access for monitoring
    const userId = await getUserIdFromRequest(request);

    const optimizationStatus = getOptimizationStatus();
    const cacheStats = getCacheStats();

    return NextResponse.json({
      success: true,
      status: optimizationStatus,
      cacheStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting optimization status:', error);
    return NextResponse.json({
      error: 'Failed to get optimization status',
      details: error.message
    }, { status: 500 });
  }
}
