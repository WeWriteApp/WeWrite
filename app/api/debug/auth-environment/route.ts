/**
 * Authentication Environment Debug API
 * 
 * This endpoint provides information about the current authentication
 * environment and helps validate that auth separation is working correctly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentType, logEnvironmentConfig } from '../../../utils/environmentConfig';
import { getEnvironmentContext } from '../../../utils/environmentDetection';

// GET endpoint - Get authentication environment information
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Authentication Environment Debug API called');

    // Get environment information
    const environmentType = getEnvironmentType();
    const environmentContext = getEnvironmentContext();

    // Check auth configuration (same logic as login/session routes)
    // ONLY use dev auth for local development with USE_DEV_AUTH=true
    // Preview and production environments should use Firebase Auth with real credentials
    const useDevAuth = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';

    // Log environment config for server logs
    logEnvironmentConfig();

    // Prepare response data
    const responseData = {
      timestamp: new Date().toISOString(),
      environment: {
        type: environmentType,
        context: environmentContext,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        useDevAuth: process.env.USE_DEV_AUTH
      },
      authConfiguration: {
        useDevAuth,
        authSystem: useDevAuth ? 'dev-auth' : 'firebase-auth',
        description: useDevAuth ? 'Local development with test accounts' : 'Production Firebase Auth with real credentials'
      },
      testCredentials: useDevAuth ? {
        available: [
          'jamie@wewrite.app / TestPassword123! (admin)',
          'test@wewrite.app / TestPassword123! (regular)',
          'getwewrite@gmail.com / TestPassword123! (regular)',
          'test@local.dev / TestPassword123! (local dev)'
        ]
      } : {
        note: 'Using Firebase Auth - use your production credentials'
      },
      troubleshooting: {
        expectedBehavior: {
          'local development': 'Should use dev auth when USE_DEV_AUTH=true',
          'vercel preview': 'Should use Firebase auth with your production credentials',
          'vercel production': 'Should use Firebase auth with your production credentials'
        },
        commonIssues: {
          '401 on preview/production': 'Use your real Firebase Auth credentials (jamiegray2234@gmail.com)',
          'wrong auth system': 'Only local development should use dev auth',
          'missing credentials': 'Preview/production need real user accounts, not test accounts'
        }
      },
      recommendations: [
        ...(useDevAuth ? [
          'Dev authentication is active - test users are available',
          'Use the provided test credentials for local development',
          'Production user accounts are protected from development access'
        ] : [
          'Firebase Auth is active - use your real production credentials',
          'Use jamiegray2234@gmail.com or other real Firebase Auth accounts',
          'Preview environments test with production data using real credentials'
        ])
      ]
    };

    // Log to server console
    console.log('[Auth Environment] Type:', environmentType);
    console.log('[Auth Environment] Auth System:', useDevAuth ? 'dev-auth' : 'firebase-auth');
    console.log('[Auth Environment] Environment Context:', environmentContext);
    
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Error in authentication environment debug API:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// POST endpoint - Auth testing (complex auth wrapper removed)
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({
      error: 'Complex auth testing disabled',
      message: 'Auth wrapper functionality has been simplified. Use simple Firebase auth instead.'
    }, { status: 400 });
  } catch (error) {
    console.error('Error in auth test operation:', error);

    return NextResponse.json({
      error: 'Test operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
