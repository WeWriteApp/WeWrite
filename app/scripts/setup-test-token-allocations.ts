/**
 * Setup Test Token Allocations
 * 
 * Creates test token allocations between test users to demonstrate
 * the earnings dashboard functionality.
 */

import { getFirebaseAdmin } from '../firebase/admin';
import { getCollectionName } from '../utils/environmentConfig';
import { DEV_TEST_USERS } from '../firebase/developmentAuth';

const { db } = getFirebaseAdmin();

interface TestAllocation {
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  pageId: string;
  pageTitle: string;
  tokens: number;
  month: string;
}

async function setupTestTokenAllocations() {
  console.log('🎯 Setting up test token allocations...');
  
  try {
    // First, ensure test users have token balances
    await setupTestUserTokenBalances();
    
    // Create test pages for testuser1 if they don't exist
    const testPages = await createTestPages();
    
    // Create token allocations from testuser2 to testuser1's pages
    const allocations: TestAllocation[] = [
      {
        fromUserId: DEV_TEST_USERS.testUser2.uid,
        fromUsername: DEV_TEST_USERS.testUser2.username,
        toUserId: DEV_TEST_USERS.testUser1.uid,
        toUsername: DEV_TEST_USERS.testUser1.username,
        pageId: testPages[0].id,
        pageTitle: testPages[0].title,
        tokens: 15,
        month: getCurrentMonth()
      },
      {
        fromUserId: DEV_TEST_USERS.testUser2.uid,
        fromUsername: DEV_TEST_USERS.testUser2.username,
        toUserId: DEV_TEST_USERS.testUser1.uid,
        toUsername: DEV_TEST_USERS.testUser1.username,
        pageId: testPages[1].id,
        pageTitle: testPages[1].title,
        tokens: 10,
        month: getCurrentMonth()
      }
    ];
    
    // Create pending token allocations
    for (const allocation of allocations) {
      await createPendingTokenAllocation(allocation);
    }
    
    // Create some historical earnings for testuser1
    await createHistoricalEarnings();
    
    console.log('✅ Test token allocations setup complete!');
    console.log('\nTest data created:');
    console.log(`- Token balances for ${DEV_TEST_USERS.testUser1.username} and ${DEV_TEST_USERS.testUser2.username}`);
    console.log(`- ${testPages.length} test pages for ${DEV_TEST_USERS.testUser1.username}`);
    console.log(`- ${allocations.length} pending token allocations`);
    console.log('- Historical earnings data');
    
  } catch (error) {
    console.error('❌ Error setting up test token allocations:', error);
    throw error;
  }
}

async function setupTestUserTokenBalances() {
  console.log('Setting up token balances for test users...');
  
  // Setup token balance for testuser2 (the allocator)
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
  
  // Setup writer token balance for testuser1 (the recipient)
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
  
  console.log('✅ Token balances created');
}

async function createTestPages() {
  console.log('Creating test pages for testuser1...');
  
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
  }
  
  console.log(`✅ Created ${testPages.length} test pages`);
  return testPages;
}

async function createPendingTokenAllocation(allocation: TestAllocation) {
  const allocationId = `${allocation.fromUserId}_page_${allocation.pageId}_${allocation.month}`;
  const allocationRef = db.collection(getCollectionName('pendingTokenAllocations')).doc(allocationId);
  
  await allocationRef.set({
    id: allocationId,
    userId: allocation.fromUserId,
    recipientUserId: allocation.toUserId,
    resourceType: 'page',
    resourceId: allocation.pageId,
    tokens: allocation.tokens,
    month: allocation.month,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  console.log(`✅ Created pending allocation: ${allocation.tokens} tokens from ${allocation.fromUsername} to ${allocation.toUsername}`);
}

async function createHistoricalEarnings() {
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
  
  console.log(`✅ Created historical earnings for ${lastMonth}`);
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

// Run the setup
if (require.main === module) {
  setupTestTokenAllocations()
    .then(() => {
      console.log('\n🎉 Test token allocation setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}

export { setupTestTokenAllocations };
