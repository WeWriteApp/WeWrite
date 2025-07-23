/**
 * Development API to setup test token allocations
 * 
 * Creates test token allocations between test users to demonstrate
 * the earnings dashboard functionality.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { DEV_TEST_USERS } from "../../../utils/testUsers";

const admin = getFirebaseAdmin();
if (!admin) {
  throw new Error('Firebase Admin not available');
}
const db = admin.firestore();

// Check if development auth is active
const isDevelopmentAuthActive = () => {
  return process.env.USE_DEV_AUTH === 'true' && process.env.NODE_ENV === 'development';
};

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (!isDevelopmentAuthActive()) {
      return NextResponse.json({
        error: 'Development auth not active'
      }, { status: 400 });
    }

    console.log('🎯 Setting up test token allocations...');
    
    const results = {
      tokenBalances: [],
      testPages: [],
      pendingAllocations: [],
      historicalEarnings: [],
      errors: []
    };

    try {
      // 1. Setup token balances for test users
      console.log('Setting up token balances...');
      
      // testuser2 (allocator) token balance
      const testUser2BalanceRef = db.collection(getCollectionName('tokenBalances')).doc(DEV_TEST_USERS.testUser2.uid);
      await testUser2BalanceRef.set({
        userId: DEV_TEST_USERS.testUser2.uid,
        totalTokens: 100,
        allocatedTokens: 25,
        availableTokens: 75,
        monthlyAllocation: 100,
        lastUpdated: new Date(),
        updatedAt: new Date(),
        createdAt: new Date()
      });
      results.tokenBalances.push(`${DEV_TEST_USERS.testUser2.username} (allocator)`);
      
      // testuser1 (recipient) writer token balance
      const testUser1BalanceRef = db.collection(getCollectionName('writerTokenBalances')).doc(DEV_TEST_USERS.testUser1.uid);
      await testUser1BalanceRef.set({
        userId: DEV_TEST_USERS.testUser1.uid,
        totalTokensEarned: 50,
        totalUsdEarned: 5.0,
        pendingTokens: 25,
        pendingUsdValue: 2.5,
        availableTokens: 15,
        availableUsdValue: 1.5,
        paidOutTokens: 10,
        paidOutUsdValue: 1.0,
        lastProcessedMonth: getPreviousMonth(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      results.tokenBalances.push(`${DEV_TEST_USERS.testUser1.username} (recipient)`);

    } catch (error) {
      console.error('Error setting up token balances:', error);
      results.errors.push(`Token balances: ${error}`);
    }

    try {
      // 2. Create test pages for testuser1
      console.log('Creating test pages...');
      
      const testPages = [
        {
          id: `test_page_1_${Date.now()}`,
          title: 'Getting Started with WeWrite',
          content: JSON.stringify([
            { type: 'heading', level: 1, children: [{ text: 'Getting Started with WeWrite' }] },
            { type: 'paragraph', children: [{ text: 'This is a comprehensive guide to getting started with WeWrite.' }] }
          ])
        },
        {
          id: `test_page_2_${Date.now()}`,
          title: 'Advanced Writing Techniques',
          content: JSON.stringify([
            { type: 'heading', level: 1, children: [{ text: 'Advanced Writing Techniques' }] },
            { type: 'paragraph', children: [{ text: 'Learn advanced techniques for better writing.' }] }
          ])
        }
      ];
      
      for (const page of testPages) {
        const pageRef = db.collection(getCollectionName('pages')).doc(page.id);
        await pageRef.set({
          id: page.id,
          title: page.title,
          content: page.content,
          userId: DEV_TEST_USERS.testUser1.uid,
          username: DEV_TEST_USERS.testUser1.username,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          stats: {
            views: 0,
            likes: 0,
            comments: 0
          }
        });
        results.testPages.push(page.title);
      }

      // 3. Create pending token allocations (simplified - no real pages needed)
      console.log('Creating pending allocations...');

      const currentMonth = getCurrentMonth();
      const allocations = [
        { pageId: 'test_page_1', pageTitle: 'Getting Started with WeWrite', tokens: 15 },
        { pageId: 'test_page_2', pageTitle: 'Advanced Writing Techniques', tokens: 10 }
      ];

      for (const allocation of allocations) {
        const allocationId = `${DEV_TEST_USERS.testUser2.uid}_page_${allocation.pageId}_${currentMonth}`;
        const allocationRef = db.collection(getCollectionName('pendingTokenAllocations')).doc(allocationId);

        await allocationRef.set({
          id: allocationId,
          userId: DEV_TEST_USERS.testUser2.uid,
          recipientUserId: DEV_TEST_USERS.testUser1.uid,
          resourceType: 'page',
          resourceId: allocation.pageId,
          tokens: allocation.tokens,
          month: currentMonth,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        results.pendingAllocations.push(`${allocation.tokens} tokens → ${allocation.pageTitle}`);
      }

    } catch (error) {
      console.error('Error creating pages/allocations:', error);
      results.errors.push(`Pages/Allocations: ${error}`);
    }

    try {
      // 4. Create historical earnings
      console.log('Creating historical earnings...');
      
      const lastMonth = getPreviousMonth();
      const earningsId = `${DEV_TEST_USERS.testUser1.uid}_${lastMonth}`;
      const earningsRef = db.collection(getCollectionName('writerTokenEarnings')).doc(earningsId);
      
      await earningsRef.set({
        id: earningsId,
        userId: DEV_TEST_USERS.testUser1.uid,
        month: lastMonth,
        totalTokensReceived: 15,
        totalUsdValue: 1.5,
        status: 'available',
        allocations: [
          {
            allocationId: `historical_${Date.now()}`,
            fromUserId: DEV_TEST_USERS.testUser2.uid,
            fromUsername: DEV_TEST_USERS.testUser2.username,
            resourceType: 'page',
            resourceId: 'historical_page_1',
            resourceTitle: 'Historical Test Page',
            tokens: 15,
            usdValue: 1.5
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      results.historicalEarnings.push(`${lastMonth}: 15 tokens ($1.50)`);

    } catch (error) {
      console.error('Error creating historical earnings:', error);
      results.errors.push(`Historical earnings: ${error}`);
    }

    console.log('✅ Test token allocations setup complete!');

    return NextResponse.json({
      success: true,
      message: 'Test token allocations setup complete',
      data: {
        summary: {
          tokenBalances: results.tokenBalances.length,
          testPages: results.testPages.length,
          pendingAllocations: results.pendingAllocations.length,
          historicalEarnings: results.historicalEarnings.length,
          errors: results.errors.length
        },
        details: results
      }
    });

  } catch (error) {
    console.error('Error setting up test token allocations:', error);
    return NextResponse.json({
      error: 'Failed to setup test token allocations',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousMonth(): string {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
}
