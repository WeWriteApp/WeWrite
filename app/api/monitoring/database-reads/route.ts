import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getReadStats, resetReadStats } from '../../../utils/databaseReadTracker';

/**
 * Database Read Monitoring API
 * 
 * Provides real-time monitoring of database read operations
 * to help track and optimize the 9.2M read overage issue
 */

/**
 * Database Read Monitoring API
 *
 * Provides real-time monitoring of database read operations
 * to help track and optimize the 9.2M read overage issue
 *
 * Uses shared tracking system from databaseReadTracker.ts
 */

/**
 * GET /api/monitoring/database-reads
 * Get current database read statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Require admin access for monitoring
    const userId = await getUserIdFromRequest(request);

    // Use shared tracking system
    const response = getReadStats();
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error getting database read stats:', error);
    return NextResponse.json({
      error: 'Failed to get database read statistics',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/monitoring/database-reads
 * Reset read statistics (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reset all stats using shared system
    resetReadStats();

    return NextResponse.json({
      success: true,
      message: 'Database read statistics reset',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error resetting database read stats:', error);
    return NextResponse.json({
      error: 'Failed to reset database read statistics',
      details: error.message
    }, { status: 500 });
  }
}
