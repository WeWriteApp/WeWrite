/**
 * Authentication Environment Debug API
 * 
 * This endpoint provides information about the current authentication
 * environment and helps validate that auth separation is working correctly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentType, getEnvironmentContext, logEnvironmentConfig } from '../../../utils/environmentConfig';

// GET endpoint - Get authentication environment information
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Authentication Environment Debug API called');

    // Get environment information
    const environmentType = getEnvironmentType();
    const environmentContext = getEnvironmentContext();

    // Check auth configuration (same logic as login/session routes)
    const isLocalDev = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
    const isPreviewEnv = environmentType === 'preview';
    const useDevAuth = isLocalDev || isPreviewEnv;

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
        isLocalDev,
        isPreviewEnv,
        useDevAuth,
        authSystem: useDevAuth ? 'dev-auth' : 'firebase-auth'
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
          'vercel preview': 'Should use dev auth for testing with production data',
          'vercel production': 'Should use Firebase auth with real credentials'
        },
        commonIssues: {
          '401 on preview': 'Check that VERCEL_ENV=preview is set correctly',
          'wrong auth system': 'Verify environment detection logic',
          'missing credentials': 'Ensure test accounts exist in dev auth system'
        }
      },
      recommendations: [
        ...(useDevAuth ? [
          'Dev authentication is active - test users are available',
          'Use the provided test credentials for testing',
          'Production user accounts are protected from development access'
        ] : [
          'Firebase Auth is active - use your production credentials',
          'Be careful when testing - you may be using real user accounts',
          'Consider using preview environment for safer testing'
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
