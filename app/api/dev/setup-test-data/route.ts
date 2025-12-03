import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCollectionName } from '../../../utils/environmentConfig';

// Initialize Firebase Admin SDK
let testDataApp;
try {
  testDataApp = getApps().find(app => app.name === 'test-data-app');
  
  if (!testDataApp) {
    const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
    const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(decodedJson);
    
    testDataApp = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
      })
    }, 'test-data-app');
  }
} catch (error) {
  console.error('[Test Data Admin SDK] Initialization failed:', error);
  throw error;
}

const adminDb = getFirestore(testDataApp);

/**
 * DEV ONLY: Setup test data for fund allocation testing
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 });
  }

  try {
    const { action } = await request.json();

    if (action === 'create-test-pages') {
      // Create some test pages for dev_test_user_1
      const testPages = [
        {
          title: 'Test Page 1 by User 1',
          content: JSON.stringify([{
            type: 'paragraph',
            children: [{ text: 'This is a test page created by dev_test_user_1 for fund allocation testing.' }]
          }]),
          userId: 'dev_test_user_1',
          username: 'testuser',
          // displayName removed - fully deprecated
          isPublic: true,
          lastModified: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          deleted: false
        },
        {
          title: 'Another Test Page by User 1',
          content: JSON.stringify([{
            type: 'paragraph',
            children: [{ text: 'Another test page for testing the dollarized fund allocation system.' }]
          }]),
          userId: 'dev_test_user_1',
          username: 'testuser',
          // displayName removed - fully deprecated
          isPublic: true,
          lastModified: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          createdAt: new Date(Date.now() - 60000).toISOString(),
          deleted: false
        },
        {
          title: 'Fund Allocation Test Page',
          content: JSON.stringify([{
            type: 'paragraph',
            children: [{ text: 'This page is specifically for testing fund allocation between dev accounts.' }]
          }]),
          userId: 'dev_test_user_1',
          username: 'testuser',
          // displayName removed - fully deprecated
          isPublic: true,
          lastModified: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
          createdAt: new Date(Date.now() - 120000).toISOString(),
          deleted: false
        }
      ];

      const batch = adminDb.batch();
      const createdPages = [];

      for (const pageData of testPages) {
        const pageRef = adminDb.collection(getCollectionName('pages')).doc();
        batch.set(pageRef, pageData);
        createdPages.push({ id: pageRef.id, ...pageData });
      }

      await batch.commit();

      return NextResponse.json({
        success: true,
        message: 'Created test pages for dev_test_user_1',
        pages: createdPages
      });
    }

    if (action === 'setup-usd-balances') {
      // Set up USD balances for both test accounts
      const balances = [
        {
          userId: 'dev_test_user_1',
          totalUsdCents: 5000, // $50
          allocatedUsdCents: 0,
          availableUsdCents: 5000,
          monthlyAllocationCents: 5000,
          lastAllocationDate: new Date().toISOString().substring(0, 7), // YYYY-MM format
        },
        {
          userId: 'dev_admin_user',
          totalUsdCents: 10000, // $100 (already exists, but ensure it's set)
          allocatedUsdCents: 0,
          availableUsdCents: 10000,
          monthlyAllocationCents: 10000,
          lastAllocationDate: new Date().toISOString().substring(0, 7),
        }
      ];

      const batch = adminDb.batch();
      
      for (const balance of balances) {
        const balanceRef = adminDb.collection(getCollectionName('usdBalances')).doc(balance.userId);
        batch.set(balanceRef, {
          ...balance,
          createdAt: new Date(),
          updatedAt: new Date()
        }, { merge: true });
      }

      await batch.commit();

      return NextResponse.json({
        success: true,
        message: 'Set up USD balances for test accounts',
        balances
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Test Data Setup] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to setup test data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
