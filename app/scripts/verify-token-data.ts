/**
 * Script to verify token allocation data pipeline
 * This script checks if token allocation data is being properly collected and aggregated
 */

import { collection, query, limit, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getCollectionName } from '../utils/environmentConfig';

async function verifyTokenData() {
  console.log('🔍 Verifying token allocation data pipeline...');

  try {
    // Check token balances collection
    console.log('\n📊 Checking token balances...');
    const tokenBalancesQuery = query(
      collection(db, getCollectionName('tokenBalances')),
      limit(10)
    );
    const balancesSnapshot = await getDocs(tokenBalancesQuery);
    console.log(`Found ${balancesSnapshot.size} token balance records`);
    
    if (balancesSnapshot.size > 0) {
      const sampleBalance = balancesSnapshot.docs[0].data();
      console.log('Sample balance record:', {
        userId: sampleBalance.userId,
        totalTokens: sampleBalance.totalTokens,
        allocatedTokens: sampleBalance.allocatedTokens,
        availableTokens: sampleBalance.availableTokens,
        lastAllocationDate: sampleBalance.lastAllocationDate
      });
    }

    // Check token allocations collection
    console.log('\n🎯 Checking token allocations...');
    const tokenAllocationsQuery = query(
      collection(db, getCollectionName('tokenAllocations')),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const allocationsSnapshot = await getDocs(tokenAllocationsQuery);
    console.log(`Found ${allocationsSnapshot.size} token allocation records`);
    
    if (allocationsSnapshot.size > 0) {
      const sampleAllocation = allocationsSnapshot.docs[0].data();
      console.log('Sample allocation record:', {
        userId: sampleAllocation.userId,
        recipientUserId: sampleAllocation.recipientUserId,
        resourceType: sampleAllocation.resourceType,
        tokens: sampleAllocation.tokens,
        month: sampleAllocation.month,
        status: sampleAllocation.status
      });
    }

    // Check recent allocations (last 30 days)
    console.log('\n📅 Checking recent allocations (last 30 days)...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentAllocationsQuery = query(
      collection(db, getCollectionName('tokenAllocations')),
      where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo)),
      orderBy('createdAt', 'desc')
    );
    const recentSnapshot = await getDocs(recentAllocationsQuery);
    console.log(`Found ${recentSnapshot.size} allocations in the last 30 days`);

    // Calculate summary statistics
    let totalTokensAllocated = 0;
    const uniqueUsers = new Set();
    const uniqueRecipients = new Set();
    
    recentSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalTokensAllocated += data.tokens || 0;
      uniqueUsers.add(data.userId);
      uniqueRecipients.add(data.recipientUserId);
    });

    console.log('\n📈 Summary statistics (last 30 days):');
    console.log(`- Total tokens allocated: ${totalTokensAllocated}`);
    console.log(`- Unique allocators: ${uniqueUsers.size}`);
    console.log(`- Unique recipients: ${uniqueRecipients.size}`);

    // Check analytics events for token allocations
    console.log('\n📊 Checking analytics events...');
    const analyticsQuery = query(
      collection(db, 'analytics_events'),
      where('category', '==', 'subscription'),
      where('action', 'in', ['first_token_allocation', 'ongoing_token_allocation']),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const analyticsSnapshot = await getDocs(analyticsQuery);
    console.log(`Found ${analyticsSnapshot.size} token allocation analytics events`);

    console.log('\n✅ Token data verification complete!');
    
    return {
      tokenBalances: balancesSnapshot.size,
      tokenAllocations: allocationsSnapshot.size,
      recentAllocations: recentSnapshot.size,
      totalTokensAllocated,
      uniqueUsers: uniqueUsers.size,
      uniqueRecipients: uniqueRecipients.size,
      analyticsEvents: analyticsSnapshot.size
    };

  } catch (error) {
    console.error('❌ Error verifying token data:', error);
    throw error;
  }
}

// Export for use in other scripts
export { verifyTokenData };

// Run if called directly
if (typeof window !== 'undefined') {
  verifyTokenData().then(result => {
    console.log('Verification result:', result);
  }).catch(error => {
    console.error('Verification failed:', error);
  });
}
