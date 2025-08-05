import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getReadStats, resetReadStats, getProductionMonitoringInfo } from '../../../utils/databaseReadTracker';
import { analyzeDatabaseReads, getEndpointReport, exportReadData } from '../../../utils/databaseReadAnalyzer';

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
 * Get current database read statistics with advanced analysis
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Require admin access for monitoring
    const userId = await getUserIdFromRequest(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const endpoint = searchParams.get('endpoint');

    // Handle different analysis types
    switch (action) {
      case 'analyze':
        const analysis = analyzeDatabaseReads();
        return NextResponse.json({
          success: true,
          analysis,
          timestamp: new Date().toISOString()
        });

      case 'endpoint-report':
        if (!endpoint) {
          return NextResponse.json({
            error: 'Endpoint parameter required for endpoint-report action'
          }, { status: 400 });
        }
        const report = getEndpointReport(endpoint);
        return NextResponse.json({
          success: true,
          report,
          timestamp: new Date().toISOString()
        });

      case 'export':
        const exportData = exportReadData();
        return NextResponse.json({
          success: true,
          data: exportData,
          timestamp: new Date().toISOString()
        });

      default:
        // Default: return basic stats + analysis + production monitoring info
        const basicStats = getReadStats();
        const advancedAnalysis = analyzeDatabaseReads();
        const productionMonitoring = getProductionMonitoringInfo();

        return NextResponse.json({
          ...basicStats,
          advancedAnalysis,
          productionMonitoring,
          timestamp: new Date().toISOString()
        });
    }

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
