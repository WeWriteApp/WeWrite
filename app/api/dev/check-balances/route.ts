import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionName } from '../../../utils/environmentConfig';

// Initialize Firebase Admin SDK
let balanceCheckApp;
try {
  balanceCheckApp = getApps().find(app => app.name === 'balance-check-app');
  
  if (!balanceCheckApp) {
    const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
    const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedJson);
    
    balanceCheckApp = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
      })
    }, 'balance-check-app');
  }
} catch (error) {
  console.error('[Balance Check Admin SDK] Initialization failed:', error);
  throw error;
}

const adminDb = getFirestore(balanceCheckApp);

/**
 * DEV ONLY: Check USD balances for both test accounts
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 });
  }

  try {
    const testUsers = ['dev_test_user_1', 'dev_admin_user'];
    const balances = {};

    for (const userId of testUsers) {
      try {
        const balanceDoc = await adminDb.collection(getCollectionName('usdBalances')).doc(userId).get();
        
        if (balanceDoc.exists) {
          const data = balanceDoc.data();
          balances[userId] = {
            totalUsdCents: data?.totalUsdCents || 0,
            allocatedUsdCents: data?.allocatedUsdCents || 0,
            availableUsdCents: data?.availableUsdCents || 0,
            monthlyAllocationCents: data?.monthlyAllocationCents || 0,
            lastAllocationDate: data?.lastAllocationDate,
            totalUsd: (data?.totalUsdCents || 0) / 100,
            availableUsd: (data?.availableUsdCents || 0) / 100,
          };
        } else {
          balances[userId] = {
            error: 'No balance found',
            totalUsdCents: 0,
            availableUsdCents: 0,
            totalUsd: 0,
            availableUsd: 0,
          };
        }
      } catch (error) {
        balances[userId] = {
          error: `Failed to fetch balance: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }

    return NextResponse.json({
      success: true,
      balances,
      collectionName: getCollectionName('usdBalances')
    });

  } catch (error) {
    console.error('[Balance Check] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to check balances',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
