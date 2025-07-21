/**
 * Test Subscription Creation Endpoint
 * 
 * Admin-only endpoint to test the subscription creation flow without payment
 * This helps debug production issues with subscription creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../../../utils/isAdmin';
import { getServerSession } from 'next-auth';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';

// Initialize Firebase Admin
const admin = initAdmin();
const adminDb = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

export async function POST(request: NextRequest) {
  try {
    // Check admin access
    const session = await getServerSession();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧪 Admin test: Testing subscription creation flow...');

    const body = await request.json();
    const { testUserId, testAmount = 10, testTier = 'basic' } = body;

    if (!testUserId) {
      return NextResponse.json({ 
        error: 'testUserId is required for testing' 
      }, { status: 400 });
    }

    // Test 1: Environment validation
    const environmentTest = {
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      hasFirebaseConfig: !!process.env.FIREBASE_PROJECT_ID || !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    };

    console.log('🔍 Environment test:', environmentTest);

    // Test 2: Firebase Admin initialization
    let firebaseTest = { initialized: false, error: null };
    try {
      const testDoc = await adminDb.collection('test').doc('connection').get();
      firebaseTest.initialized = true;
      console.log('✅ Firebase Admin connection test passed');
    } catch (error) {
      firebaseTest.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Firebase Admin connection test failed:', error);
    }

    // Test 3: User document access
    let userTest = { exists: false, hasStripeCustomerId: false, error: null };
    try {
      const userDoc = await adminDb.collection(getCollectionName('users')).doc(testUserId).get();
      userTest.exists = userDoc.exists();
      if (userDoc.exists()) {
        const userData = userDoc.data();
        userTest.hasStripeCustomerId = !!userData?.stripeCustomerId;
      }
      console.log('✅ User document access test passed');
    } catch (error) {
      userTest.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ User document access test failed:', error);
    }

    // Test 4: Subscription collection path
    let subscriptionPathTest = { path: null, error: null };
    try {
      const { parentPath, subCollectionName } = getSubCollectionPath(
        PAYMENT_COLLECTIONS.USERS, 
        testUserId, 
        PAYMENT_COLLECTIONS.SUBSCRIPTIONS
      );
      subscriptionPathTest.path = `${parentPath}/${subCollectionName}/current`;
      console.log('✅ Subscription path test passed:', subscriptionPathTest.path);
    } catch (error) {
      subscriptionPathTest.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Subscription path test failed:', error);
    }

    // Test 5: Stripe API connection (if keys are available)
    let stripeTest = { connected: false, error: null };
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const account = await stripe.accounts.retrieve();
        stripeTest.connected = true;
        console.log('✅ Stripe API connection test passed');
      } catch (error) {
        stripeTest.error = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Stripe API connection test failed:', error);
      }
    } else {
      stripeTest.error = 'No Stripe secret key configured';
    }

    // Test 6: Token service import
    let tokenServiceTest = { imported: false, error: null };
    try {
      const { ServerTokenService } = await import('../../../services/tokenService.server');
      tokenServiceTest.imported = true;
      console.log('✅ Token service import test passed');
    } catch (error) {
      tokenServiceTest.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Token service import test failed:', error);
    }

    // Test 7: Mock subscription data creation
    let subscriptionDataTest = { created: false, error: null };
    try {
      const mockSubscriptionData = {
        stripeSubscriptionId: `test_sub_${Date.now()}`,
        stripeCustomerId: `test_cus_${Date.now()}`,
        userId: testUserId,
        status: 'active',
        amount: testAmount,
        tier: testTier,
        tierName: testTier,
        tokens: testAmount * 10,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      subscriptionDataTest.created = true;
      console.log('✅ Mock subscription data creation test passed');
    } catch (error) {
      subscriptionDataTest.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Mock subscription data creation test failed:', error);
    }

    const testResults = {
      environment: environmentTest,
      firebase: firebaseTest,
      user: userTest,
      subscriptionPath: subscriptionPathTest,
      stripe: stripeTest,
      tokenService: tokenServiceTest,
      subscriptionData: subscriptionDataTest,
      overall: {
        allTestsPassed: firebaseTest.initialized && userTest.exists && !!subscriptionPathTest.path && tokenServiceTest.imported && subscriptionDataTest.created,
        criticalIssues: [
          !firebaseTest.initialized && 'Firebase Admin not initialized',
          !userTest.exists && 'Test user does not exist',
          !subscriptionPathTest.path && 'Subscription path generation failed',
          !tokenServiceTest.imported && 'Token service import failed'
        ].filter(Boolean),
        warnings: [
          !stripeTest.connected && 'Stripe API connection failed',
          !userTest.hasStripeCustomerId && 'Test user has no Stripe customer ID'
        ].filter(Boolean)
      },
      timestamp: new Date().toISOString()
    };

    console.log('🧪 Subscription creation test complete:', {
      allTestsPassed: testResults.overall.allTestsPassed,
      criticalIssues: testResults.overall.criticalIssues.length,
      warnings: testResults.overall.warnings.length
    });

    return NextResponse.json({
      success: true,
      testResults
    });

  } catch (error) {
    console.error('❌ Error running subscription creation test:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run test',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const session = await getServerSession();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      message: 'Subscription Creation Test Endpoint',
      usage: 'POST with { "testUserId": "user_id_to_test" }',
      description: 'Tests the subscription creation flow without creating actual subscriptions',
      requiredFields: ['testUserId'],
      optionalFields: ['testAmount', 'testTier']
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to get endpoint info'
    }, { status: 500 });
  }
}
