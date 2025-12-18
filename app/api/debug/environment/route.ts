import { NextRequest, NextResponse } from 'next/server';
import {
  getEnvironmentType,
  getEnvironmentPrefix,
  getCollectionName,
  getSubCollectionPath,
  COLLECTIONS,
  PAYMENT_COLLECTIONS,
  getPaymentCollectionNames
} from '../../../utils/environmentConfig';
import { requireDevelopmentEnvironment } from '../debugHelper';

/**
 * Debug Environment API Endpoint
 *
 * Returns current environment configuration and collection names
 * to help debug environment separation issues.
 */
export async function GET(request: NextRequest) {
  // SECURITY: Only allow in local development
  const devCheck = requireDevelopmentEnvironment();
  if (devCheck) return devCheck;

  try {
    const envType = getEnvironmentType();
    const prefix = getEnvironmentPrefix();
    
    // Get environment-specific collection names
    const collections = {
      // Core collections
      users: getCollectionName('users'),
      pages: getCollectionName('pages'),
      versions: getCollectionName('versions'),
      config: getCollectionName('config'),

      // Payment collections
      subscriptions: getCollectionName('subscriptions'),
      usdBalances: getCollectionName('usdBalances'),
      usdAllocations: getCollectionName('usdAllocations'),
      writerUsdBalances: getCollectionName('writerUsdBalances'),
      writerUsdEarnings: getCollectionName('writerUsdEarnings'),
      usdPayouts: getCollectionName('usdPayouts'),
      payouts: getCollectionName('payouts'),
      transactions: getCollectionName('transactions'),

      // Analytics collections
      analytics_counters: getCollectionName('analytics_counters'),
      analytics_daily: getCollectionName('analytics_daily'),

      // User feature collections
      readingHistory: getCollectionName('readingHistory'),
      sessions: getCollectionName('sessions'),
      usernames: getCollectionName('usernames'),

      // Additional collections
      pledges: getCollectionName('pledges'),
      backlinks: getCollectionName('backlinks'),
      siteVisitors: getCollectionName('siteVisitors'),
      featureOverrides: getCollectionName('featureOverrides')
    };
    
    // Test subscription path
    const testUserId = 'test-user-123';
    const { parentPath, subCollectionName } = getSubCollectionPath(
      COLLECTIONS.USERS,
      testUserId,
      COLLECTIONS.SUBSCRIPTIONS
    );
    
    const environmentInfo = {
      environment: {
        type: envType,
        prefix: prefix,
        vercelEnv: process.env.VERCEL_ENV || 'not set',
        nodeEnv: process.env.NODE_ENV || 'not set'
      },
      collections,
      subscriptionPath: {
        parentPath,
        subCollectionName,
        fullPath: `${parentPath}/${subCollectionName}/current`
      },
      paymentCollections: getPaymentCollectionNames(),
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(environmentInfo, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error in environment debug API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get environment info',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}
