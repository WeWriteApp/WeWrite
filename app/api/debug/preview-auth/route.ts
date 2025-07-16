/**
 * Preview Authentication Debug Endpoint
 * 
 * Helps debug authentication issues in Vercel preview environment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentType, getEnvironmentPrefix } from '../../../utils/environmentConfig';
import { getEnvironmentContext } from '../../../utils/environmentDetection';
import { getAuthEnvironmentInfo } from '../../../firebase/authWrapper';

export async function GET(request: NextRequest) {
  try {
    const envType = getEnvironmentType();
    const envContext = getEnvironmentContext();
    const authInfo = getAuthEnvironmentInfo();
    const envPrefix = getEnvironmentPrefix();

    // Get Firebase configuration (without sensitive data)
    const firebaseConfig = {
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
      hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      hasAppId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    // Get Vercel environment info
    const vercelInfo = {
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL,
      vercelUrl: process.env.VERCEL_URL,
      vercelBranch: process.env.VERCEL_GIT_COMMIT_REF,
    };

    // Get authentication configuration
    const authConfig = {
      useDevAuth: process.env.USE_DEV_AUTH === 'true',
      authType: authInfo.authType,
      isDevelopmentAuth: authInfo.isDevelopmentAuth,
      environment: authInfo.environment,
    };

    // Get data access configuration
    const dataConfig = {
      environmentType: envType,
      collectionPrefix: envPrefix,
      exampleCollection: `${envPrefix}users`,
      usesProductionData: envType === 'preview' || envType === 'production',
    };

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        detected: envType,
        context: envContext,
        vercel: vercelInfo,
      },
      authentication: {
        config: authConfig,
        info: authInfo,
        expectedBehavior: {
          preview: 'Should use production Firebase Auth with production data (PROD_ collections)',
          development: 'Should use development auth with test users (DEV_ collections)',
          production: 'Should use production Firebase Auth with production data (base collections)',
        },
      },
      dataAccess: dataConfig,
      firebase: firebaseConfig,
      troubleshooting: {
        commonIssues: [
          'Firebase Auth domain mismatch',
          'Missing environment variables in Vercel',
          'CORS issues with auth domain',
          'Firebase project configuration issues',
        ],
        recommendations: [
          'Check Vercel environment variables are set correctly',
          'Verify Firebase Auth domain matches Vercel preview URL pattern',
          'Ensure Firebase project allows authentication from preview domains',
          'Check browser console for specific Firebase Auth errors',
        ],
      },
    };

    return NextResponse.json(debugInfo, { status: 200 });

  } catch (error) {
    console.error('Preview auth debug error:', error);
    return NextResponse.json({
      error: 'Failed to get debug info',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
