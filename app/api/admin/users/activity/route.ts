/**
 * Admin User Activity Feed API
 * 
 * Provides a unified activity feed combining subscription history, payout history,
 * and notifications for a specific user. Optimized for efficiency with limited queries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getCollectionName } from '../../../../utils/environmentConfig';

export type ActivityType = 'subscription' | 'payout' | 'notification';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: number;
  status?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  const filterType = searchParams.get('filter') as ActivityType | 'all' | null;
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100);

  if (!uid) {
    return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
  }

  const adminAuth = await checkAdminPermissions(request);
  if (!adminAuth.success) {
    return NextResponse.json({ error: adminAuth.error || 'Admin access required' }, { status: 403 });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const activities: Activity[] = [];
    const filter = filterType || 'all';
    
    // Run queries in parallel for efficiency
    const queries: Promise<void>[] = [];
    
    // 1. Fetch subscription data (subcollection under user)
    // Only fetch if filter is 'all' or 'subscription'
    if (filter === 'all' || filter === 'subscription') {
      queries.push((async () => {
        try {
          // Get current subscription doc
          const subscriptionDoc = await db
            .collection(getCollectionName('users'))
            .doc(uid)
            .collection('subscriptions')
            .doc('current')
            .get();
          
          if (subscriptionDoc.exists) {
            const data = subscriptionDoc.data()!;
            
            // Current subscription status
            if (data.status) {
              activities.push({
                id: `sub-current`,
                type: 'subscription',
                title: getSubscriptionTitle(data.status),
                description: getSubscriptionDescription(data),
                amount: data.amount,
                status: data.status,
                createdAt: data.updatedAt?._seconds 
                  ? new Date(data.updatedAt._seconds * 1000).toISOString()
                  : data.createdAt?._seconds
                    ? new Date(data.createdAt._seconds * 1000).toISOString()
                    : new Date().toISOString(),
                metadata: {
                  tier: data.tier,
                  cancelAtPeriodEnd: data.cancelAtPeriodEnd,
                  currentPeriodEnd: data.currentPeriodEnd?._seconds 
                    ? new Date(data.currentPeriodEnd._seconds * 1000).toISOString()
                    : null
                }
              });
            }
            
            // Last payment
            if (data.lastPaymentAt) {
              const paymentDate = data.lastPaymentAt._seconds 
                ? new Date(data.lastPaymentAt._seconds * 1000)
                : new Date(data.lastPaymentAt);
              
              activities.push({
                id: `sub-payment-${paymentDate.getTime()}`,
                type: 'subscription',
                title: 'Payment successful',
                description: `$${(data.amount || 0).toFixed(2)}/mo subscription payment processed`,
                amount: data.amount,
                status: 'paid',
                createdAt: paymentDate.toISOString(),
                metadata: { tier: data.tier }
              });
            }
            
            // Failed payment
            if (data.lastFailedPaymentAt) {
              const failedDate = data.lastFailedPaymentAt._seconds 
                ? new Date(data.lastFailedPaymentAt._seconds * 1000)
                : new Date(data.lastFailedPaymentAt);
              
              activities.push({
                id: `sub-failed-${failedDate.getTime()}`,
                type: 'subscription',
                title: 'Payment failed',
                description: `Subscription payment failed${data.failureCount ? ` (attempt ${data.failureCount})` : ''}`,
                status: 'failed',
                createdAt: failedDate.toISOString(),
                metadata: { failureCount: data.failureCount }
              });
            }
            
            // Cancellation
            if (data.canceledAt) {
              const cancelDate = data.canceledAt._seconds 
                ? new Date(data.canceledAt._seconds * 1000)
                : new Date(data.canceledAt);
              
              activities.push({
                id: `sub-cancel-${cancelDate.getTime()}`,
                type: 'subscription',
                title: 'Subscription cancelled',
                description: data.cancelAtPeriodEnd 
                  ? 'Subscription will end at period end'
                  : 'Subscription has been cancelled',
                status: 'cancelled',
                createdAt: cancelDate.toISOString(),
                metadata: { reason: data.cancelReason }
              });
            }
          }
          
          // Also check top-level subscriptions collection for history
          // (limit to 5 most recent to avoid excessive reads)
          const topLevelSubs = await db
            .collection(getCollectionName('subscriptions'))
            .where('userId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
          
          topLevelSubs.docs.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt?._seconds 
              ? new Date(data.createdAt._seconds * 1000).toISOString()
              : new Date().toISOString();
            
            activities.push({
              id: `sub-history-${doc.id}`,
              type: 'subscription',
              title: getSubscriptionTitle(data.status),
              description: getSubscriptionDescription(data),
              amount: data.amount,
              status: data.status,
              createdAt,
              metadata: {
                tier: data.tier,
                stripeSubscriptionId: data.stripeSubscriptionId
              }
            });
          });
        } catch (err) {
          console.warn('[Activity API] Error fetching subscriptions:', err);
        }
      })());
    }
    
    // 2. Fetch payout/earnings data
    // Only fetch if filter is 'all' or 'payout'
    if (filter === 'all' || filter === 'payout') {
      queries.push((async () => {
        try {
          // Check writerUsdEarnings for this user (limit to 10)
          const earningsQuery = await db
            .collection(getCollectionName('writerUsdEarnings'))
            .where('userId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
          
          earningsQuery.docs.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt?._seconds 
              ? new Date(data.createdAt._seconds * 1000).toISOString()
              : data.createdAt || new Date().toISOString();
            
            const amountCents = data.amountCents || 0;
            const amountUsd = amountCents / 100;
            
            activities.push({
              id: `earn-${doc.id}`,
              type: 'payout',
              title: data.status === 'paid' ? 'Payout completed' : 
                     data.status === 'available' ? 'Earnings available' :
                     data.status === 'pending' ? 'Earnings pending' : 'Earnings recorded',
              description: `$${amountUsd.toFixed(2)} ${data.status === 'paid' ? 'paid out' : data.status}`,
              amount: amountUsd,
              status: data.status,
              createdAt,
              metadata: {
                month: data.month,
                pageId: data.pageId,
                sourceType: data.sourceType
              }
            });
          });
          
          // Check payouts collection (actual transfers)
          const payoutsQuery = await db
            .collection(getCollectionName('payouts'))
            .where('userId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
          
          payoutsQuery.docs.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt?._seconds 
              ? new Date(data.createdAt._seconds * 1000).toISOString()
              : data.createdAt || new Date().toISOString();
            
            const amountUsd = (data.amountCents || data.amount || 0) / 100;
            
            activities.push({
              id: `payout-${doc.id}`,
              type: 'payout',
              title: data.status === 'completed' || data.status === 'paid' 
                ? 'Payout completed' 
                : data.status === 'pending' 
                  ? 'Payout pending'
                  : data.status === 'failed'
                    ? 'Payout failed'
                    : 'Payout recorded',
              description: `$${amountUsd.toFixed(2)} transferred to connected account`,
              amount: amountUsd,
              status: data.status,
              createdAt,
              metadata: {
                stripeTransferId: data.stripeTransferId,
                month: data.month
              }
            });
          });
        } catch (err) {
          console.warn('[Activity API] Error fetching payouts:', err);
        }
      })());
    }
    
    // 3. Fetch notifications
    // Only fetch if filter is 'all' or 'notification'
    if (filter === 'all' || filter === 'notification') {
      queries.push((async () => {
        try {
          const notificationsRef = db
            .collection(getCollectionName('users'))
            .doc(uid)
            .collection('notifications')
            .orderBy('createdAt', 'desc')
            .limit(20);
          
          const snapshot = await notificationsRef.get();
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt?._seconds 
              ? new Date(data.createdAt._seconds * 1000).toISOString()
              : data.createdAt || new Date().toISOString();
            
            activities.push({
              id: `notif-${doc.id}`,
              type: 'notification',
              title: data.title || data.type || 'Notification',
              description: data.message || '',
              status: data.read ? 'read' : 'unread',
              createdAt,
              metadata: {
                criticality: data.criticality,
                actionUrl: data.actionUrl,
                ...data.metadata
              }
            });
          });
        } catch (err) {
          console.warn('[Activity API] Error fetching notifications:', err);
        }
      })());
    }
    
    // Wait for all queries
    await Promise.all(queries);
    
    // Sort all activities by date (newest first)
    activities.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Deduplicate by id (in case of overlapping queries)
    const seen = new Set<string>();
    const uniqueActivities = activities.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    
    // Apply limit
    const limitedActivities = uniqueActivities.slice(0, limit);
    
    return NextResponse.json({ 
      success: true, 
      activities: limitedActivities,
      total: uniqueActivities.length,
      filter
    });
    
  } catch (error: any) {
    console.error('[Activity API] Failed to load activity feed:', error);
    return NextResponse.json({ error: 'Failed to load activity feed' }, { status: 500 });
  }
}

function getSubscriptionTitle(status: string): string {
  switch (status) {
    case 'active': return 'Subscription active';
    case 'canceled':
    case 'cancelled': return 'Subscription cancelled';
    case 'past_due': return 'Payment past due';
    case 'incomplete': return 'Subscription incomplete';
    case 'trialing': return 'Trial active';
    case 'unpaid': return 'Subscription unpaid';
    default: return `Subscription ${status}`;
  }
}

function getSubscriptionDescription(data: any): string {
  const amount = data.amount ? `$${data.amount.toFixed(2)}/mo` : '';
  const tier = data.tier ? `${data.tier} tier` : '';
  
  if (amount && tier) return `${tier} - ${amount}`;
  if (amount) return amount;
  if (tier) return tier;
  return 'Subscription';
}
