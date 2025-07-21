/**
 * API endpoint to verify global counters pipeline
 * Admin-only endpoint to check if global application counters are being maintained
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, limit, getDocs, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getCollectionName } from '../../../utils/environmentConfig';
import { isAdmin } from '../../../utils/isAdmin';
import { getServerSession } from 'next-auth/next';

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const session = await getServerSession();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Admin verification: Checking global counters pipeline...');

    // Check analytics_counters collection
    const globalCountersRef = doc(db, getCollectionName('analytics_counters'), 'global');
    const globalCountersDoc = await getDoc(globalCountersRef);
    
    let globalCounters = null;
    if (globalCountersDoc.exists()) {
      const data = globalCountersDoc.data();
      globalCounters = {
        totalPagesEverCreated: data.totalPagesEverCreated || 0,
        totalActivePages: data.totalActivePages || 0,
        totalDeletedPages: data.totalDeletedPages || 0,
        totalPublicPages: data.totalPublicPages || 0,
        totalPrivatePages: data.totalPrivatePages || 0,
        lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || data.lastUpdated
      };
    }

    // Check individual counters collection
    const countersQuery = query(
      collection(db, getCollectionName('counters')),
      limit(10)
    );
    const countersSnapshot = await getDocs(countersQuery);
    
    const individualCounters = [];
    countersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      individualCounters.push({
        id: doc.id,
        pageCount: data.pageCount || 0,
        followerCount: data.followerCount || 0,
        viewCount: data.viewCount || 0,
        lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || data.lastUpdated
      });
    });

    // Get actual counts from collections for verification
    let actualCounts = {
      users: 0,
      pages: 0,
      publicPages: 0,
      privatePages: 0
    };

    try {
      // Count users
      const usersQuery = query(collection(db, getCollectionName('users')), limit(1000));
      const usersSnapshot = await getDocs(usersQuery);
      actualCounts.users = usersSnapshot.size;

      // Count pages
      const pagesQuery = query(collection(db, getCollectionName('pages')), limit(1000));
      const pagesSnapshot = await getDocs(pagesQuery);
      actualCounts.pages = pagesSnapshot.size;

      // Count public pages
      const publicPagesQuery = query(
        collection(db, getCollectionName('pages')),
        where('isPublic', '==', true),
        limit(1000)
      );
      const publicPagesSnapshot = await getDocs(publicPagesQuery);
      actualCounts.publicPages = publicPagesSnapshot.size;

      // Count private pages
      const privatePagesQuery = query(
        collection(db, getCollectionName('pages')),
        where('isPublic', '==', false),
        limit(1000)
      );
      const privatePagesSnapshot = await getDocs(privatePagesQuery);
      actualCounts.privatePages = privatePagesSnapshot.size;

    } catch (error) {
      console.warn('Could not get actual counts for verification:', error);
    }

    // Check if counters are up to date (within reasonable margin)
    const isCountersAccurate = globalCounters ? 
      Math.abs((globalCounters.totalActivePages || 0) - actualCounts.pages) <= 5 &&
      Math.abs((globalCounters.totalPublicPages || 0) - actualCounts.publicPages) <= 5 &&
      Math.abs((globalCounters.totalPrivatePages || 0) - actualCounts.privatePages) <= 5
      : false;

    // Check if counters have been updated recently (within last 24 hours)
    const lastUpdated = globalCounters?.lastUpdated ? new Date(globalCounters.lastUpdated) : null;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const isRecentlyUpdated = lastUpdated ? lastUpdated > twentyFourHoursAgo : false;

    // Calculate discrepancies
    const discrepancies = globalCounters ? {
      totalActivePages: (globalCounters.totalActivePages || 0) - actualCounts.pages,
      totalPublicPages: (globalCounters.totalPublicPages || 0) - actualCounts.publicPages,
      totalPrivatePages: (globalCounters.totalPrivatePages || 0) - actualCounts.privatePages
    } : null;

    const result = {
      globalCounters: {
        available: !!globalCounters,
        data: globalCounters,
        isRecentlyUpdated,
        lastUpdatedHoursAgo: lastUpdated ? Math.round((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60)) : null
      },
      individualCounters: {
        count: countersSnapshot.size,
        samples: individualCounters.slice(0, 5)
      },
      actualCounts,
      verification: {
        isCountersAccurate,
        discrepancies,
        maxDiscrepancy: discrepancies ? Math.max(...Object.values(discrepancies).map(Math.abs)) : 0
      },
      systemHealth: {
        globalCountersExist: !!globalCounters,
        countersAreAccurate: isCountersAccurate,
        countersRecentlyUpdated: isRecentlyUpdated,
        individualCountersExist: countersSnapshot.size > 0
      },
      status: globalCounters && isCountersAccurate && isRecentlyUpdated ? 'healthy' : 
              globalCounters && isCountersAccurate ? 'warning' : 'error',
      timestamp: new Date().toISOString()
    };

    console.log('✅ Global counters verification complete:', {
      globalCountersExist: !!globalCounters,
      isAccurate: isCountersAccurate,
      isRecentlyUpdated,
      status: result.status
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error verifying global counters:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify global counters'
    }, { status: 500 });
  }
}
