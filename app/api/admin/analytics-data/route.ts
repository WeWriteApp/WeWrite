import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { checkAdminPermissions } from '../../admin-auth-helper';

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const permissionCheck = await checkAdminPermissions();
    if (!permissionCheck.success) {
      return NextResponse.json({ error: permissionCheck.error }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }
    const adminDb = admin.firestore();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100');
    const days = parseInt(searchParams.get('days') || '30');

    if (!type) {
      return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
    }

    console.log(`🔍 Admin Analytics Data: Fetching ${type} data...`);

    let data: any[] = [];

    switch (type) {
      case 'events':
        {
          const eventsSnapshot = await adminDb.collection('analytics_events')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
          
          data = eventsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        break;

      case 'hourly':
        {
          const hourlySnapshot = await adminDb.collection('analytics_hourly')
            .orderBy('datetime', 'desc')
            .limit(limit)
            .get();
          
          data = hourlySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        break;

      case 'daily':
        {
          const dailySnapshot = await adminDb.collection('analytics_daily')
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
          
          data = dailySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        break;

      case 'global-counters':
        {
          const globalCountersDoc = await adminDb.collection('analytics_counters').doc('global').get();
          
          if (globalCountersDoc.exists) {
            data = globalCountersDoc.data();
          } else {
            data = null;
          }
        }
        break;

      case 'token-balances':
        {
          const balancesSnapshot = await adminDb.collection('tokenBalances')
            .limit(limit)
            .get();
          
          data = balancesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        break;

      case 'token-allocations':
        {
          const allocationsSnapshot = await adminDb.collection('tokenAllocations')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
          
          data = allocationsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        break;

      case 'recent-token-allocations':
        {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days);
          
          const recentSnapshot = await adminDb.collection('tokenAllocations')
            .where('createdAt', '>=', cutoffDate)
            .orderBy('createdAt', 'desc')
            .get();
          
          data = recentSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        break;

      case 'subscription-funnel':
        {
          const funnelActions = [
            'subscription_flow_started',
            'subscription_abandoned_before_payment',
            'subscription_abandoned_during_payment',
            'subscription_completed',
            'first_token_allocation',
            'ongoing_token_allocation'
          ];

          const results: Record<string, any> = {};

          for (const action of funnelActions) {
            const eventSnapshot = await adminDb.collection('analytics_events')
              .where('category', '==', 'subscription')
              .where('action', '==', action)
              .orderBy('timestamp', 'desc')
              .limit(50)
              .get();

            results[action] = {
              count: eventSnapshot.size,
              events: eventSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
            };
          }

          data = results;
        }
        break;

      case 'users':
        {
          const usersSnapshot = await adminDb.collection(getCollectionName('users'))
            .limit(limit)
            .get();
          
          data = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        break;

      case 'pages':
        {
          const pagesSnapshot = await adminDb.collection(getCollectionName('pages'))
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
          
          data = pagesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        break;

      case 'subscriptions':
        {
          const subscriptionsSnapshot = await adminDb.collection(getCollectionName('subscriptions'))
            .limit(limit)
            .get();
          
          data = subscriptionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }

    console.log(`✅ Admin Analytics Data: ${type} data fetched successfully`);

    return NextResponse.json({
      success: true,
      data: data,
      count: Array.isArray(data) ? data.length : (data ? 1 : 0),
      type: type
    });

  } catch (error) {
    console.error('Error fetching admin analytics data:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
