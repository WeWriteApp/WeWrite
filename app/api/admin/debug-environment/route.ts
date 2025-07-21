/**
 * Debug endpoint to check environment configuration
 * Admin-only endpoint to debug environment and collection name issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../../../utils/isAdmin';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getEnvironmentType, getEnvironmentPrefix, getCollectionName, logEnvironmentConfig } from '../../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user email from Firebase to check admin status
    const firebaseAdmin = getFirebaseAdmin();
    const userRecord = await firebaseAdmin.auth().getUser(userId);
    if (!userRecord.email || !isAdmin(userRecord.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Admin debug: Checking environment configuration...');

    // Log environment config to console
    logEnvironmentConfig();

    const envType = getEnvironmentType();
    const envPrefix = getEnvironmentPrefix();

    // Get collection names that the admin dashboard is trying to access
    const collections = {
      analytics_events: getCollectionName('analytics_events'),
      analytics_hourly: getCollectionName('analytics_hourly'),
      analytics_daily: getCollectionName('analytics_daily'),
      analytics_counters: getCollectionName('analytics_counters'),
      tokenBalances: getCollectionName('tokenBalances'),
      tokenAllocations: getCollectionName('tokenAllocations'),
      subscriptions: getCollectionName('subscriptions'),
      users: getCollectionName('users'),
      pages: getCollectionName('pages')
    };

    // Get environment variables
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
      SUBSCRIPTION_ENV: process.env.SUBSCRIPTION_ENV,
      NEXT_PUBLIC_FIREBASE_PID: process.env.NEXT_PUBLIC_FIREBASE_PID
    };

    const result = {
      environment: {
        type: envType,
        prefix: envPrefix,
        isProduction: envType === 'production',
        isPreview: envType === 'preview',
        isDevelopment: envType === 'development'
      },
      collections,
      environmentVariables: envVars,
      expectedBehavior: {
        production: 'No prefix - accesses base collections (analytics_events, tokenBalances, etc.)',
        preview: 'No prefix - accesses base collections (same as production)',
        development: 'DEV_ prefix - accesses DEV_analytics_events, DEV_tokenBalances, etc.'
      },
      firebaseRulesStatus: {
        baseCollections: 'Should have admin rules for analytics_events, analytics_hourly, etc.',
        prefixedCollections: 'Should have admin rules for DEV_analytics_events, PREVIEW_analytics_events, etc.',
        recommendation: envType === 'development' 
          ? 'Ensure DEV_ prefixed collections have proper admin rules'
          : 'Ensure base collections have proper admin rules'
      },
      timestamp: new Date().toISOString()
    };

    console.log('✅ Environment debug complete:', {
      type: envType,
      prefix: envPrefix,
      exampleCollection: collections.analytics_events
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error debugging environment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to debug environment'
    }, { status: 500 });
  }
}
