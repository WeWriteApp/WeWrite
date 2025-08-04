import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { resetOptimization } from '../../../utils/emergencyReadOptimizer';

/**
 * POST /api/monitoring/reset-optimization
 * Reset all database read optimizations (circuit breakers, rate limits, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Require admin access for reset
    const userId = await getUserIdFromRequest(request);

    console.log(`🔄 Optimization reset triggered by user: ${userId || 'anonymous'}`);
    
    // Reset optimizations
    resetOptimization();

    return NextResponse.json({
      success: true,
      message: 'Optimizations reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error resetting optimization:', error);
    return NextResponse.json({
      error: 'Failed to reset optimization',
      details: error.message
    }, { status: 500 });
  }
}
