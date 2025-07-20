import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentType } from '../../../utils/environmentConfig';

/**
 * Debug endpoint to check LogRocket configuration status
 * GET /api/debug/logrocket-status
 */
export async function GET(request: NextRequest) {
  try {
    const envType = getEnvironmentType();
    const isProduction = process.env.NODE_ENV === 'production';
    const logRocketAppId = process.env.NEXT_PUBLIC_LOGROCKET_APP_ID;
    
    const status = {
      environment: {
        type: envType,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        isProduction
      },
      logrocket: {
        appIdConfigured: !!logRocketAppId,
        appIdValue: logRocketAppId ? `${logRocketAppId.substring(0, 8)}...` : 'NOT_SET',
        shouldInitialize: isProduction && !!logRocketAppId,
        initializationConditions: {
          isProduction,
          hasAppId: !!logRocketAppId,
          isClientSide: 'N/A (server-side check)'
        }
      },
      recommendations: []
    };

    // Add recommendations based on configuration
    if (!logRocketAppId) {
      status.recommendations.push('Set NEXT_PUBLIC_LOGROCKET_APP_ID environment variable');
    }
    
    if (!isProduction) {
      status.recommendations.push('LogRocket only initializes in production environment');
    }
    
    if (isProduction && !logRocketAppId) {
      status.recommendations.push('CRITICAL: Production environment missing LogRocket configuration');
    }
    
    if (isProduction && logRocketAppId) {
      status.recommendations.push('✅ LogRocket should be working in production');
    }

    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Error checking LogRocket status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check LogRocket status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
