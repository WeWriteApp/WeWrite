/**
 * Authentication Environment Debug API
 * 
 * This endpoint provides information about the current authentication
 * environment and helps validate that auth separation is working correctly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getAuthEnvironmentInfo,
  isDevelopmentAuthActive,
  getGlobalAuthWrapper
} from '../../../firebase/authWrapper';
import { DEV_TEST_USERS } from '../../../firebase/developmentAuth';
import { getEnvironmentType } from '../../../utils/environmentConfig';

// GET endpoint - Get authentication environment information
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Authentication Environment Debug API called');
    
    // Get environment information
    const envType = getEnvironmentType();
    const authInfo = getAuthEnvironmentInfo();
    const isDev = isDevelopmentAuthActive();
    const authWrapper = getGlobalAuthWrapper();
    
    // Get current user info (safely)
    let currentUser = null;
    try {
      currentUser = authWrapper.currentUser;
    } catch (error) {
      console.warn('Could not get current user:', error);
    }
    
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

// POST endpoint - Test authentication operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userKey } = body;
    
    console.log(`🧪 Testing auth action: ${action}`);
    
    const authWrapper = getGlobalAuthWrapper();
    const isDev = isDevelopmentAuthActive();
    
    if (!isDev) {
      return NextResponse.json({
        error: 'Development auth not active',
        message: 'Cannot perform test operations without development authentication enabled'
      }, { status: 400 });
    }
    
    let result;
    
    switch (action) {
      case 'signInTestUser':
        if (!userKey || !DEV_TEST_USERS[userKey as keyof typeof DEV_TEST_USERS]) {
          throw new Error(`Invalid test user key: ${userKey}`);
        }
        
        if (authWrapper.signInWithTestUser) {
          result = await authWrapper.signInWithTestUser(userKey);
          result = {
            success: true,
            user: {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName
            }
          };
        } else {
          throw new Error('Test user sign in not available');
        }
        break;
        
      case 'signOut':
        await authWrapper.signOut();
        result = { success: true, message: 'Signed out successfully' };
        break;
        
      case 'getCurrentUser':
        const currentUser = authWrapper.currentUser;
        result = {
          success: true,
          user: currentUser ? {
            uid: currentUser.uid,
            email: currentUser.email,
            isTestUser: currentUser.uid?.startsWith('dev_')
          } : null
        };
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return NextResponse.json({
      action,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in auth test operation:', error);
    
    return NextResponse.json({
      error: 'Test operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
