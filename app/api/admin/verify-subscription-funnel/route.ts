/**
 * API endpoint to verify subscription conversion funnel pipeline
 * Admin-only endpoint to check if subscription funnel analytics events are being tracked
 */

import { NextRequest, NextResponse } from 'next/server';
import { collection, query, limit, getDocs, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getCollectionName } from '../../../utils/environmentConfig';
import { isAdmin } from '../../../utils/adminUtils';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const session = await getServerSession();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Admin verification: Checking subscription conversion funnel pipeline...');

    // Check for subscription funnel events in analytics_events
    const funnelActions = [
      'subscription_flow_started',
      'subscription_abandoned_before_payment',
      'subscription_abandoned_during_payment',
      'subscription_completed',
      'first_token_allocation',
      'ongoing_token_allocation'
    ];

    const funnelEventCounts: Record<string, number> = {};
    const sampleEvents: Record<string, any> = {};

    // Query each funnel stage separately to get counts and samples
    for (const action of funnelActions) {
      const eventQuery = query(
        collection(db, getCollectionName('analytics_events')),
        where('category', '==', 'subscription'),
        where('action', '==', action),
        orderBy('timestamp', 'desc'),
        limit(5)
      );

      const eventSnapshot = await getDocs(eventQuery);
      funnelEventCounts[action] = eventSnapshot.size;

      if (eventSnapshot.size > 0) {
        const sampleEvent = eventSnapshot.docs[0].data();
        sampleEvents[action] = {
          userId: sampleEvent.userId,
          tier: sampleEvent.tier,
          amount: sampleEvent.amount,
          tokens: sampleEvent.tokens,
          timestamp: sampleEvent.timestamp?.toDate?.()?.toISOString() || sampleEvent.timestamp,
          metadata: sampleEvent.metadata
        };
      }
    }

    // Check recent subscription activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentFunnelQuery = query(
      collection(db, getCollectionName('analytics_events')),
      where('category', '==', 'subscription'),
      where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const recentSnapshot = await getDocs(recentFunnelQuery);
    const recentEvents = recentSnapshot.docs.map(doc => ({
      action: doc.data().action,
      userId: doc.data().userId,
      timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
    }));

    // Calculate conversion rates
    const initiated = funnelEventCounts['subscription_flow_started'] || 0;
    const completed = funnelEventCounts['subscription_completed'] || 0;
    const firstAllocations = funnelEventCounts['first_token_allocation'] || 0;
    const ongoingAllocations = funnelEventCounts['ongoing_token_allocation'] || 0;

    const conversionRate = initiated > 0 ? (completed / initiated) * 100 : 0;
    const allocationRate = completed > 0 ? (firstAllocations / completed) * 100 : 0;
    const retentionRate = firstAllocations > 0 ? (ongoingAllocations / firstAllocations) * 100 : 0;

    // Check actual subscriptions for comparison
    const subscriptionsQuery = query(
      collection(db, getCollectionName('subscriptions')),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    let subscriptionsCount = 0;
    let sampleSubscription = null;

    try {
      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
      subscriptionsCount = subscriptionsSnapshot.size;
      
      if (subscriptionsSnapshot.size > 0) {
        const data = subscriptionsSnapshot.docs[0].data();
        sampleSubscription = {
          userId: data.userId,
          status: data.status,
          amount: data.amount,
          tier: data.tier,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        };
      }
    } catch (error) {
      console.warn('Could not query subscriptions collection:', error);
    }

    // Determine pipeline health
    const hasRecentActivity = recentSnapshot.size > 0;
    const hasCompleteData = initiated > 0 && completed > 0;
    const isTrackingProperly = Object.values(funnelEventCounts).some(count => count > 0);

    const result = {
      funnelEvents: {
        counts: funnelEventCounts,
        samples: sampleEvents,
        totalEvents: Object.values(funnelEventCounts).reduce((sum, count) => sum + count, 0)
      },
      recentActivity: {
        eventsLast30Days: recentSnapshot.size,
        recentEvents: recentEvents.slice(0, 10)
      },
      conversionMetrics: {
        conversionRate: Number(conversionRate.toFixed(2)),
        allocationRate: Number(allocationRate.toFixed(2)),
        retentionRate: Number(retentionRate.toFixed(2))
      },
      subscriptionsData: {
        count: subscriptionsCount,
        sample: sampleSubscription
      },
      pipelineHealth: {
        isTrackingEvents: isTrackingProperly,
        hasRecentActivity,
        hasCompleteData,
        missingStages: funnelActions.filter(action => funnelEventCounts[action] === 0)
      },
      status: isTrackingProperly ? (hasRecentActivity ? 'healthy' : 'warning') : 'error',
      timestamp: new Date().toISOString()
    };

    console.log('✅ Subscription funnel verification complete:', {
      totalEvents: result.funnelEvents.totalEvents,
      recentActivity: hasRecentActivity,
      isTracking: isTrackingProperly,
      status: result.status
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error verifying subscription funnel:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify subscription funnel'
    }, { status: 500 });
  }
}
