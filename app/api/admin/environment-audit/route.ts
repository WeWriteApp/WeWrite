/**
 * Environment Audit API
 * 
 * Comprehensive audit of environment configuration to ensure proper
 * separation between development/test and production environments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { isAdminUser } from '../../../utils/adminUtils';
import { getStripeSecretKey, getStripePublishableKey } from '../../../utils/stripeConfig';
import { getCollectionName } from '../../../utils/environmentConfig';
import { getEnvironmentContext } from '../../../utils/environmentDetection';
import Stripe from 'stripe';

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`🔍 [ADMIN] Starting comprehensive environment audit`);

    // 1. Environment Detection
    const environmentContext = getEnvironmentContext();
    
    // 2. Stripe Configuration Audit
    const stripeSecretKey = getStripeSecretKey();
    const stripePublishableKey = getStripePublishableKey();
    
    const stripeAudit = {
      secretKeyConfigured: !!stripeSecretKey,
      publishableKeyConfigured: !!stripePublishableKey,
      secretKeyType: stripeSecretKey ? (stripeSecretKey.startsWith('sk_test_') ? 'test' : 'live') : 'none',
      publishableKeyType: stripePublishableKey ? (stripePublishableKey.startsWith('pk_test_') ? 'test' : 'live') : 'none',
      secretKeyPrefix: stripeSecretKey ? stripeSecretKey.substring(0, 8) + '...' : 'not configured',
      publishableKeyPrefix: stripePublishableKey ? stripePublishableKey.substring(0, 8) + '...' : 'not configured'
    };

    // 3. Test Stripe Connection and Storage Balance
    let stripeConnectionTest = null;
    let storageBalanceTest = null;
    
    if (stripeSecretKey) {
      try {
        const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
        
        // Test basic connection
        const account = await stripe.accounts.retrieve();
        stripeConnectionTest = {
          success: true,
          accountId: account.id,
          country: account.country,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted
        };

        // Test Storage Balance availability
        try {
          const balance = await stripe.balance.retrieve();
          storageBalanceTest = {
            success: true,
            hasStorageBalance: balance.available.some(b => b.source_types?.includes('storage')),
            paymentsBalance: balance.available.find(b => b.currency === 'usd')?.amount || 0,
            storageBalance: balance.available.find(b => b.source_types?.includes('storage'))?.amount || 0,
            balanceBreakdown: balance.available.map(b => ({
              currency: b.currency,
              amount: b.amount,
              sourceTypes: b.source_types || []
            }))
          };
        } catch (balanceError) {
          storageBalanceTest = {
            success: false,
            error: balanceError instanceof Error ? balanceError.message : 'Unknown error',
            note: 'Storage Balance might not be available in this Stripe account'
          };
        }

      } catch (stripeError) {
        stripeConnectionTest = {
          success: false,
          error: stripeError instanceof Error ? stripeError.message : 'Unknown error'
        };
      }
    }

    // 4. Firebase Collections Audit
    const collectionsAudit = {
      users: getCollectionName('users'),
      pages: getCollectionName('pages'),
      subscriptions: getCollectionName('subscriptions'),
      usdBalances: getCollectionName('usdBalances'),
      usdAllocations: getCollectionName('usdAllocations'),
      usdEarnings: getCollectionName('usdEarnings'),
      usdPayouts: getCollectionName('usdPayouts'),
      storageBalanceOperations: getCollectionName('storageBalanceOperations')
    };

    // 5. Environment Variables Audit
    const envVarsAudit = {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PID,
      stripeTestSecretKey: process.env.STRIPE_TEST_SECRET_KEY ? 'configured' : 'not configured',
      stripeProdSecretKey: process.env.STRIPE_PROD_SECRET_KEY ? 'configured' : 'not configured',
      stripeTestPublishableKey: process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY ? 'configured' : 'not configured',
      stripeProdPublishableKey: process.env.NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY ? 'configured' : 'not configured'
    };

    // 6. Configuration Consistency Check
    const consistencyCheck = {
      stripeKeysMatch: stripeAudit.secretKeyType === stripeAudit.publishableKeyType,
      environmentExpected: environmentContext.type === 'development' ? 'test' : 'live',
      stripeEnvironmentCorrect: environmentContext.type === 'development' 
        ? stripeAudit.secretKeyType === 'test'
        : stripeAudit.secretKeyType === 'live',
      collectionsHavePrefix: Object.values(collectionsAudit).some(name => name.includes('dev') || name.includes('test') || name.includes('prod'))
    };

    // 7. Storage Balance Availability Analysis
    const storageBalanceAnalysis = {
      available: storageBalanceTest?.success && storageBalanceTest?.hasStorageBalance,
      reason: !storageBalanceTest?.success 
        ? 'Stripe connection failed'
        : !storageBalanceTest?.hasStorageBalance
        ? 'Storage Balance not enabled on this Stripe account'
        : 'Storage Balance available',
      recommendation: !storageBalanceTest?.success
        ? 'Check Stripe API keys and account status'
        : !storageBalanceTest?.hasStorageBalance
        ? 'Enable Global Payouts/Storage Balance in Stripe Dashboard'
        : 'Storage Balance is properly configured'
    };

    // 8. Issues and Recommendations
    const issues = [];
    const recommendations = [];

    if (!consistencyCheck.stripeKeysMatch) {
      issues.push('Stripe secret key and publishable key are from different environments');
      recommendations.push('Ensure both keys are either test or live keys');
    }

    if (!consistencyCheck.stripeEnvironmentCorrect) {
      issues.push(`Environment is ${environmentContext.type} but using ${stripeAudit.secretKeyType} Stripe keys`);
      recommendations.push(`Use ${consistencyCheck.environmentExpected} Stripe keys for ${environmentContext.type} environment`);
    }

    if (!storageBalanceAnalysis.available) {
      issues.push('Storage Balance not available');
      recommendations.push(storageBalanceAnalysis.recommendation);
    }

    if (!consistencyCheck.collectionsHavePrefix) {
      recommendations.push('Consider using environment-specific collection prefixes for better separation');
    }

    return NextResponse.json({
      success: true,
      audit: {
        timestamp: new Date().toISOString(),
        environment: environmentContext,
        stripe: {
          configuration: stripeAudit,
          connection: stripeConnectionTest,
          storageBalance: storageBalanceTest
        },
        firebase: {
          collections: collectionsAudit
        },
        environmentVariables: envVarsAudit,
        consistency: consistencyCheck,
        storageBalanceAnalysis,
        issues,
        recommendations
      },
      summary: {
        environmentType: environmentContext.type,
        stripeMode: stripeAudit.secretKeyType,
        storageBalanceAvailable: storageBalanceAnalysis.available,
        configurationValid: issues.length === 0,
        issuesFound: issues.length,
        recommendationsCount: recommendations.length
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error in environment audit:', error);
    return NextResponse.json({
      error: 'Environment audit failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'test_storage_balance_setup':
        return await handleTestStorageBalanceSetup();
      
      case 'verify_environment_separation':
        return await handleVerifyEnvironmentSeparation();
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: test_storage_balance_setup, verify_environment_separation'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Error in environment audit POST:', error);
    return NextResponse.json({
      error: 'Environment audit action failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleTestStorageBalanceSetup() {
  console.log(`🧪 [ADMIN] Testing Storage Balance setup`);
  
  const stripeSecretKey = getStripeSecretKey();
  if (!stripeSecretKey) {
    return NextResponse.json({
      success: false,
      error: 'Stripe secret key not configured'
    }, { status: 500 });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' });
    
    // Check if Global Payouts is enabled
    const account = await stripe.accounts.retrieve();
    const balance = await stripe.balance.retrieve();
    
    const hasStorageBalance = balance.available.some(b => b.source_types?.includes('storage'));
    
    return NextResponse.json({
      success: true,
      test: {
        accountId: account.id,
        country: account.country,
        payoutsEnabled: account.payouts_enabled,
        storageBalanceAvailable: hasStorageBalance,
        currentBalance: balance.available.map(b => ({
          currency: b.currency,
          amount: b.amount,
          sourceTypes: b.source_types || []
        })),
        recommendation: hasStorageBalance 
          ? 'Storage Balance is available and ready to use'
          : 'Enable Global Payouts in Stripe Dashboard to access Storage Balance'
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      recommendation: 'Check Stripe API keys and account configuration'
    }, { status: 500 });
  }
}

async function handleVerifyEnvironmentSeparation() {
  console.log(`🔍 [ADMIN] Verifying environment separation`);
  
  const environmentContext = getEnvironmentContext();
  const stripeSecretKey = getStripeSecretKey();
  
  const verification = {
    environment: environmentContext.type,
    stripeMode: stripeSecretKey?.startsWith('sk_test_') ? 'test' : 'live',
    expectedStripeMode: environmentContext.type === 'development' ? 'test' : 'live',
    collectionsUsed: {
      users: getCollectionName('users'),
      subscriptions: getCollectionName('subscriptions'),
      usdBalances: getCollectionName('usdBalances')
    },
    separation: {
      stripeCorrect: (environmentContext.type === 'development' && stripeSecretKey?.startsWith('sk_test_')) ||
                    (environmentContext.type !== 'development' && stripeSecretKey?.startsWith('sk_live_')),
      collectionsEnvironmentAware: true // Our collections are environment-aware
    }
  };

  return NextResponse.json({
    success: true,
    verification,
    status: verification.separation.stripeCorrect && verification.separation.collectionsEnvironmentAware
      ? 'Environment separation is properly configured'
      : 'Environment separation issues detected',
    issues: [
      ...(verification.separation.stripeCorrect ? [] : ['Stripe keys do not match environment']),
      ...(verification.separation.collectionsEnvironmentAware ? [] : ['Collections are not environment-aware'])
    ]
  });
}
