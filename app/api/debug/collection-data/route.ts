import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Debug endpoint to check what data actually exists in collections
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Collection Data] Starting collection data check...');
    
    const testResults = {
      timestamp: new Date().toISOString(),
      collections: []
    };
    
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({
        error: 'Admin access required',
        details: adminCheck.error
      }, { status: 403 });
    }
    
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    // Check users collection
    try {
      const usersCollection = getCollectionName('users');
      const usersSnapshot = await db.collection(usersCollection)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        data: {
          email: doc.data().email,
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
          username: doc.data().username
        }
      }));
      
      testResults.collections.push({
        name: 'users',
        collectionName: usersCollection,
        totalDocs: usersSnapshot.size,
        sampleData: usersData,
        hasCreatedAt: usersData.some(u => u.data.createdAt)
      });
    } catch (error) {
      testResults.collections.push({
        name: 'users',
        error: error.message
      });
    }
    
    // Check pages collection
    try {
      const pagesCollection = getCollectionName('pages');
      const pagesSnapshot = await db.collection(pagesCollection)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      
      const pagesData = pagesSnapshot.docs.map(doc => ({
        id: doc.id,
        data: {
          title: doc.data().title,
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
          isPublic: doc.data().isPublic,
          authorId: doc.data().authorId
        }
      }));
      
      testResults.collections.push({
        name: 'pages',
        collectionName: pagesCollection,
        totalDocs: pagesSnapshot.size,
        sampleData: pagesData,
        hasCreatedAt: pagesData.some(p => p.data.createdAt)
      });
    } catch (error) {
      testResults.collections.push({
        name: 'pages',
        error: error.message
      });
    }
    
    // Check analytics_events collection
    try {
      const analyticsCollection = getCollectionName('analytics_events');
      const analyticsSnapshot = await db.collection(analyticsCollection)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
      
      const analyticsData = analyticsSnapshot.docs.map(doc => ({
        id: doc.id,
        data: {
          event: doc.data().event,
          timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp,
          userId: doc.data().userId,
          metadata: doc.data().metadata
        }
      }));
      
      testResults.collections.push({
        name: 'analytics_events',
        collectionName: analyticsCollection,
        totalDocs: analyticsSnapshot.size,
        sampleData: analyticsData,
        hasTimestamp: analyticsData.some(a => a.data.timestamp)
      });
    } catch (error) {
      testResults.collections.push({
        name: 'analytics_events',
        error: error.message
      });
    }
    
    // Check subscriptions collection
    try {
      const subscriptionsCollection = getCollectionName('subscriptions');
      const subscriptionsSnapshot = await db.collection(subscriptionsCollection)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      
      const subscriptionsData = subscriptionsSnapshot.docs.map(doc => ({
        id: doc.id,
        data: {
          userId: doc.data().userId,
          status: doc.data().status,
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
          plan: doc.data().plan
        }
      }));
      
      testResults.collections.push({
        name: 'subscriptions',
        collectionName: subscriptionsCollection,
        totalDocs: subscriptionsSnapshot.size,
        sampleData: subscriptionsData,
        hasCreatedAt: subscriptionsData.some(s => s.data.createdAt)
      });
    } catch (error) {
      testResults.collections.push({
        name: 'subscriptions',
        error: error.message
      });
    }
    
    // Check date ranges for recent data
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    testResults.dateRangeInfo = {
      now: now.toISOString(),
      sevenDaysAgo: sevenDaysAgo.toISOString(),
      thirtyDaysAgo: thirtyDaysAgo.toISOString()
    };
    
    return NextResponse.json(testResults, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[Collection Data] Error:', error);
    
    return NextResponse.json({
      error: 'Collection data check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
