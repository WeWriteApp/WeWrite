/**
 * API endpoint for getting real pledge statistics for pages and groups
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../firebase/config';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    const groupId = searchParams.get('groupId');
    const userId = searchParams.get('userId');

    if (!pageId && !groupId && !userId) {
      return NextResponse.json({
        error: 'Either pageId, groupId, or userId is required'
      }, { status: 400 });
    }

    let stats = {};

    // Get page/group pledge statistics
    if (pageId || groupId) {
      const resourceType = pageId ? 'page' : 'group';
      const resourceId = pageId || groupId;
      
      // Get resource document for basic stats
      const resourceDoc = await getDoc(doc(db, resourceType === 'page' ? 'pages' : 'groups', resourceId));
      
      if (resourceDoc.exists()) {
        const resourceData = resourceDoc.data();
        
        // Get active pledges for this resource
        const pledgesQuery = query(
          collection(db, 'pledges'),
          where(resourceType === 'page' ? 'pageId' : 'groupId', '==', resourceId),
          where('status', '==', 'active')
        );
        
        const pledgesSnapshot = await getDocs(pledgesQuery);
        const activePledges = pledgesSnapshot.docs.map(doc => doc.data());
        
        // Calculate real-time statistics
        const totalPledged = activePledges.reduce((sum, pledge) => sum + pledge.amount, 0);
        const pledgeCount = activePledges.length;
        const averagePledge = pledgeCount > 0 ? totalPledged / pledgeCount : 0;
        
        // Get recent transactions for this resource
        const transactionsQuery = query(
          collection(db, 'paymentTransactions'),
          where(resourceType === 'page' ? 'pageId' : 'groupId', '==', resourceId),
          where('status', '==', 'completed'),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        
        const transactionsSnapshot = await getDocs(transactionsQuery);
        const recentTransactions = transactionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
        }));
        
        // Calculate monthly earnings
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyTransactions = recentTransactions.filter(txn => 
          txn.metadata?.period === currentMonth
        );
        const monthlyEarnings = monthlyTransactions.reduce((sum, txn) => sum + txn.netAmount, 0);
        
        stats = {
          resourceType,
          resourceId,
          resourceTitle: resourceData.title || resourceData.name,
          authorUserId: resourceData.userId || resourceData.createdBy,
          authorUsername: resourceData.username,
          totalPledged,
          pledgeCount,
          averagePledge,
          monthlyEarnings,
          activePledges: activePledges.map(pledge => ({
            id: pledge.id,
            userId: pledge.userId,
            amount: pledge.amount,
            createdAt: pledge.createdAt?.toDate?.()?.toISOString() || pledge.createdAt
          })),
          recentTransactions
        };
      } else {
        return NextResponse.json({
          error: `${resourceType} not found`
        }, { status: 404 });
      }
    }

    // Get user pledge statistics
    if (userId) {
      // Get user's active pledges
      const userPledgesQuery = query(
        collection(db, 'pledges'),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );
      
      const userPledgesSnapshot = await getDocs(userPledgesQuery);
      const userPledges = userPledgesSnapshot.docs.map(doc => doc.data());
      
      // Get user's earnings if they're a creator
      const userEarningsDoc = await getDoc(doc(db, 'userEarnings', userId));
      const userEarnings = userEarningsDoc.exists() ? userEarningsDoc.data() : null;
      
      // Get user's recent transactions as a pledger
      const userTransactionsQuery = query(
        collection(db, 'paymentTransactions'),
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      
      const userTransactionsSnapshot = await getDocs(userTransactionsQuery);
      const userTransactions = userTransactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      }));
      
      // Calculate user statistics
      const totalPledgedByUser = userPledges.reduce((sum, pledge) => sum + pledge.amount, 0);
      const activePledgeCount = userPledges.length;
      const totalSpent = userTransactions.reduce((sum, txn) => sum + txn.amount, 0);
      
      const userStats = {
        userId,
        totalPledgedByUser,
        activePledgeCount,
        totalSpent,
        userEarnings: userEarnings ? {
          totalEarnings: userEarnings.totalEarnings || 0,
          availableBalance: userEarnings.availableBalance || 0,
          pendingBalance: userEarnings.pendingBalance || 0,
          totalPlatformFees: userEarnings.totalPlatformFees || 0
        } : null,
        activePledges: userPledges.map(pledge => ({
          id: pledge.id,
          pageId: pledge.pageId,
          groupId: pledge.groupId,
          amount: pledge.amount,
          createdAt: pledge.createdAt?.toDate?.()?.toISOString() || pledge.createdAt,
          metadata: pledge.metadata
        })),
        recentTransactions: userTransactions
      };
      
      if (pageId || groupId) {
        stats = { ...stats, userStats };
      } else {
        stats = userStats;
      }
    }

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting pledge statistics:', error);
    return NextResponse.json({
      error: 'Failed to get pledge statistics'
    }, { status: 500 });
  }
}

// Helper endpoint to get supporter count and total for a specific page/group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageId, groupId } = body;

    if (!pageId && !groupId) {
      return NextResponse.json({
        error: 'Either pageId or groupId is required'
      }, { status: 400 });
    }

    const resourceType = pageId ? 'page' : 'group';
    const resourceId = pageId || groupId;

    // Get active pledges for this resource
    const pledgesQuery = query(
      collection(db, 'pledges'),
      where(resourceType === 'page' ? 'pageId' : 'groupId', '==', resourceId),
      where('status', '==', 'active')
    );

    const pledgesSnapshot = await getDocs(pledgesQuery);
    const activePledges = pledgesSnapshot.docs.map(doc => doc.data());

    // Calculate supporter statistics
    const uniqueSupporters = new Set(activePledges.map(pledge => pledge.userId));
    const supporterCount = uniqueSupporters.size;
    const totalAmount = activePledges.reduce((sum, pledge) => sum + pledge.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        supporterCount,
        totalAmount,
        activePledgeCount: activePledges.length
      }
    });

  } catch (error) {
    console.error('Error getting supporter statistics:', error);
    return NextResponse.json({
      error: 'Failed to get supporter statistics'
    }, { status: 500 });
  }
}
