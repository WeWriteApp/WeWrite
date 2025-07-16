import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { db } from '../../../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { getCollectionName } from '../../../utils/environmentConfig';

export interface NotificationPreferences {
  userId: string;
  email: {
    enabled: boolean;
    address: string;
  };
  inApp: {
    enabled: boolean;
  };
  push: {
    enabled: boolean;
    deviceTokens: string[];
  };
  types: {
    payout_initiated: boolean;
    payout_processing: boolean;
    payout_completed: boolean;
    payout_failed: boolean;
    payout_retry_scheduled: boolean;
    payout_cancelled: boolean;
  };
  createdAt: any;
  updatedAt: any;
}

/**
 * GET /api/payouts/notifications
 * Get user's notification preferences and recent notifications
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get notification preferences
    const preferencesDoc = await getDoc(
      doc(db, getCollectionName('notificationPreferences'), userId)
    );

    let preferences: NotificationPreferences;
    if (preferencesDoc.exists()) {
      preferences = preferencesDoc.data() as NotificationPreferences;
    } else {
      // Create default preferences
      preferences = {
        userId,
        email: {
          enabled: true,
          address: '' // Will be populated from user profile
        },
        inApp: {
          enabled: true
        },
        push: {
          enabled: false,
          deviceTokens: []
        },
        types: {
          payout_initiated: true,
          payout_processing: false, // Less important
          payout_completed: true,
          payout_failed: true,
          payout_retry_scheduled: true,
          payout_cancelled: true
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(
        doc(db, getCollectionName('notificationPreferences'), userId),
        preferences
      );
    }

    // Get recent notifications
    const notificationsQuery = query(
      collection(db, getCollectionName('userNotifications')),
      where('userId', '==', userId),
      where('type', '==', 'payout_update'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const notificationsSnapshot = await getDocs(notificationsQuery);
    const recentNotifications = notificationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      data: {
        preferences,
        recentNotifications
      }
    });

  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * PUT /api/payouts/notifications
 * Update user's notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, inApp, push, types } = body;

    // Validate input
    if (email && typeof email.enabled !== 'boolean') {
      return NextResponse.json({
        error: 'Invalid email preferences'
      }, { status: 400 });
    }

    if (inApp && typeof inApp.enabled !== 'boolean') {
      return NextResponse.json({
        error: 'Invalid in-app preferences'
      }, { status: 400 });
    }

    if (push && typeof push.enabled !== 'boolean') {
      return NextResponse.json({
        error: 'Invalid push preferences'
      }, { status: 400 });
    }

    // Get current preferences
    const preferencesDoc = await getDoc(
      doc(db, getCollectionName('notificationPreferences'), userId)
    );

    let currentPreferences: NotificationPreferences;
    if (preferencesDoc.exists()) {
      currentPreferences = preferencesDoc.data() as NotificationPreferences;
    } else {
      // Create default if doesn't exist
      currentPreferences = {
        userId,
        email: { enabled: true, address: '' },
        inApp: { enabled: true },
        push: { enabled: false, deviceTokens: [] },
        types: {
          payout_initiated: true,
          payout_processing: false,
          payout_completed: true,
          payout_failed: true,
          payout_retry_scheduled: true,
          payout_cancelled: true
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
    }

    // Update preferences
    const updatedPreferences = {
      ...currentPreferences,
      ...(email && { email: { ...currentPreferences.email, ...email } }),
      ...(inApp && { inApp: { ...currentPreferences.inApp, ...inApp } }),
      ...(push && { push: { ...currentPreferences.push, ...push } }),
      ...(types && { types: { ...currentPreferences.types, ...types } }),
      updatedAt: serverTimestamp()
    };

    await setDoc(
      doc(db, getCollectionName('notificationPreferences'), userId),
      updatedPreferences
    );

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated',
      data: updatedPreferences
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/payouts/notifications
 * Mark notifications as read or perform other notification actions
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, notificationIds } = body;

    if (action === 'mark_read') {
      if (!notificationIds || !Array.isArray(notificationIds)) {
        return NextResponse.json({
          error: 'notificationIds array is required for mark_read action'
        }, { status: 400 });
      }

      // Mark notifications as read
      const updatePromises = notificationIds.map(id =>
        updateDoc(doc(db, getCollectionName('userNotifications'), id), {
          read: true,
          readAt: serverTimestamp()
        })
      );

      await Promise.all(updatePromises);

      return NextResponse.json({
        success: true,
        message: `Marked ${notificationIds.length} notifications as read`
      });

    } else if (action === 'mark_all_read') {
      // Mark all user's payout notifications as read
      const notificationsQuery = query(
        collection(db, getCollectionName('userNotifications')),
        where('userId', '==', userId),
        where('type', '==', 'payout_update'),
        where('read', '==', false)
      );

      const notificationsSnapshot = await getDocs(notificationsQuery);
      const updatePromises = notificationsSnapshot.docs.map(doc =>
        updateDoc(doc.ref, {
          read: true,
          readAt: serverTimestamp()
        })
      );

      await Promise.all(updatePromises);

      return NextResponse.json({
        success: true,
        message: `Marked ${notificationsSnapshot.docs.length} notifications as read`
      });

    } else {
      return NextResponse.json({
        error: 'Invalid action. Use "mark_read" or "mark_all_read"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error processing notification action:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
