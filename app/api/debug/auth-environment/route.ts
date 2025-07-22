/**
 * Authentication Environment Debug API
 * 
 * This endpoint provides information about the current authentication
 * environment and helps validate that auth separation is working correctly.
 */

import { NextRequest, NextResponse } from 'next/server';
// Auth debug - complex auth wrapper removed
import { DEV_TEST_USERS } from "../../../utils/testUsers";
import { getEnvironmentType } from '../../../utils/environmentConfig';

// GET endpoint - Get authentication environment information
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Authentication Environment Debug API called');
    
    // Get environment information
    const envType = getEnvironmentType();

    // Auth info
    const authInfo = {
      environment: envType,
      authType: 'Simple Firebase Auth',
      isDevelopmentAuth: false
    };
    
    // Prepare response data
    const responseData = {
      timestamp: new Date().toISOString(),
      environment: {
        type: envType,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        useDevAuth: process.env.USE_DEV_AUTH
      },
      authentication: {
        ...authInfo,
        isDevelopmentAuthActive: isDev,
        currentUser: currentUser ? {
          uid: currentUser.uid,
          email: currentUser.email,
          isTestUser: currentUser.uid?.startsWith('dev_')
        } : null
      },
      testUsers: isDev ? {
        available: Object.keys(DEV_TEST_USERS),
        details: Object.entries(DEV_TEST_USERS).map(([key, user]) => ({
          key,
          email: user.email,
          username: user.username,
          isAdmin: user.isAdmin || false
        }))
      } : null,
      security: {
        environmentSeparated: isDev,
        productionDataProtected: isDev,
        testDataIsolated: isDev,
        authSystemType: isDev ? 'Mock Development Auth' : 'Firebase Production Auth'
      },
      recommendations: [
        ...(isDev ? [
          'Development authentication is active - test users are isolated from production',
          'Use the provided test users for development and testing',
          'Production user accounts are protected from development access'
        ] : [
          'Production Firebase Auth is active',
          'Be careful when testing - you may be using real user accounts',
          'Consider enabling USE_DEV_AUTH=true for safer development'
        ])
      ]
    };
    
    // Log to server console
    console.log('[Auth Environment] Type:', authInfo.authType);
    console.log('[Auth Environment] Environment Separated:', authInfo.isEnvironmentSeparated);
    console.log('[Auth Environment] Current User:', currentUser?.email || 'None');
    
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
