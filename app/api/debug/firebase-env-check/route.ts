/**
 * Firebase Environment Variables Debug Endpoint
 * 
 * Checks which Firebase environment variables are available
 * and helps diagnose Firebase initialization issues
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check all Firebase-related environment variables
    const firebaseEnvVars = {
      // Required client-side Firebase config
      NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
      NEXT_PUBLIC_FIREBASE_DB_URL: !!process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
      NEXT_PUBLIC_FIREBASE_PID: !!process.env.NEXT_PUBLIC_FIREBASE_PID,
      NEXT_PUBLIC_FIREBASE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MSNGR_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      
      // Optional Firebase config
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: !!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      
      // Server-side Firebase config
      GOOGLE_CLOUD_KEY_JSON: !!process.env.GOOGLE_CLOUD_KEY_JSON,
      LOGGING_CLOUD_KEY_JSON: !!process.env.LOGGING_CLOUD_KEY_JSON,
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      
      // Environment detection
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL: !!process.env.VERCEL,
      VERCEL_URL: process.env.VERCEL_URL,
    };

    // Check which required variables are missing
    const requiredClientVars = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_DOMAIN', 
      'NEXT_PUBLIC_FIREBASE_DB_URL',
      'NEXT_PUBLIC_FIREBASE_PID',
      'NEXT_PUBLIC_FIREBASE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MSNGR_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID'
    ];

    const missingClientVars = requiredClientVars.filter(varName => 
      !process.env[varName as keyof NodeJS.ProcessEnv]
    );

    const requiredServerVars = [
      'GOOGLE_CLOUD_KEY_JSON'
    ];

    const missingServerVars = requiredServerVars.filter(varName => 
      !process.env[varName as keyof NodeJS.ProcessEnv]
    );

    // Try to initialize Firebase client config to see what fails
    let clientConfigError = null;
    try {
      const clientConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      // Check if any required fields are missing
      const missingFields = Object.entries(clientConfig)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (missingFields.length > 0) {
        clientConfigError = `Missing required fields: ${missingFields.join(', ')}`;
      }
    } catch (error) {
      clientConfigError = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check Firebase Admin initialization
    let adminConfigError = null;
    try {
      if (!process.env.GOOGLE_CLOUD_KEY_JSON) {
        adminConfigError = 'Missing GOOGLE_CLOUD_KEY_JSON';
      } else {
        // Try to parse the service account
        let jsonString = process.env.GOOGLE_CLOUD_KEY_JSON;
        if (!jsonString.includes(' ') && !jsonString.startsWith('{')) {
          jsonString = Buffer.from(jsonString, 'base64').toString('utf-8');
        }
        const serviceAccount = JSON.parse(jsonString);
        
        if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
          adminConfigError = 'Invalid service account: missing required fields';
        }
      }
    } catch (error) {
      adminConfigError = error instanceof Error ? error.message : 'Unknown error';
    }

    // Environment analysis
    const environmentAnalysis = {
      detectedEnvironment: process.env.VERCEL_ENV || 'local',
      isVercelDeployment: !!process.env.VERCEL,
      isPreviewEnvironment: process.env.VERCEL_ENV === 'preview',
      shouldUseProductionAuth: process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'production',
      shouldUseDevAuth: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_DEV_AUTH === 'true',
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: environmentAnalysis,
      firebaseEnvVars,
      missingClientVars,
      missingServerVars,
      clientConfigError,
      adminConfigError,
      diagnosis: {
        canInitializeClient: missingClientVars.length === 0 && !clientConfigError,
        canInitializeAdmin: missingServerVars.length === 0 && !adminConfigError,
        likelyIssue: missingClientVars.length > 0 
          ? 'Missing client-side Firebase environment variables'
          : clientConfigError
          ? 'Invalid client-side Firebase configuration'
          : missingServerVars.length > 0
          ? 'Missing server-side Firebase environment variables'
          : adminConfigError
          ? 'Invalid server-side Firebase configuration'
          : 'Configuration appears valid'
      },
      recommendations: [
        ...(missingClientVars.length > 0 ? [`Add missing client variables to Vercel: ${missingClientVars.join(', ')}`] : []),
        ...(missingServerVars.length > 0 ? [`Add missing server variables to Vercel: ${missingServerVars.join(', ')}`] : []),
        ...(process.env.VERCEL_ENV === 'preview' ? ['Preview environments should use production Firebase configuration'] : []),
        ...(clientConfigError ? ['Check Firebase project configuration in Vercel environment variables'] : [])
      ]
    });

  } catch (error) {
    console.error('[Firebase Env Check] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to check Firebase environment variables.' },
    { status: 405 }
  );
}
