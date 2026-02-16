import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const limit = searchParams.get('limit');
    const lastVisible = searchParams.get('lastVisible');

    // Get the current user ID from request (authenticated user)
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    const db = admin.firestore();

    // Handle different actions
    switch (action) {
      case 'count':
        // Get unread notification count - use subcollection structure
        const userNotificationsRef = db.collection(getCollectionName('users'))
          .doc(userId)
          .collection(getCollectionName('notifications'));

        const countQuery = userNotificationsRef.where('read', '==', false);
        const countSnapshot = await countQuery.get();
        const count = countSnapshot.size;

        // Also try to get cached count from user document
        const userDocRef = db.collection(getCollectionName('users')).doc(userId);
        const userDoc = await userDocRef.get();
        const cachedCount = userDoc.exists ? (userDoc.data()?.unreadNotificationsCount || 0) : 0;

        return NextResponse.json({
          success: true,
          count,
          cachedCount
        });

      case 'list':
      default:
        // Get notifications list using subcollection structure
        const notificationsRef = db.collection(getCollectionName('users'))
          .doc(userId)
          .collection(getCollectionName('notifications'));

        let query = notificationsRef
          .orderBy('createdAt', 'desc')
          .limit(limit ? parseInt(limit) : 20);

        // Handle pagination with lastVisible
        if (lastVisible) {
          try {
            // In a real implementation, you'd need to reconstruct the document reference
            // For now, we'll skip pagination and just return the first page
          } catch (error) {
            console.warn('Error handling pagination:', error);
          }
        }

        const notificationsSnapshot = await query.get();
        const notifications = notificationsSnapshot.docs.map(doc => {
          const data = doc.data();
          // Convert Firestore Timestamps to ISO strings for proper client-side parsing
          const createdAt = data.createdAt?.toDate?.()
            ? data.createdAt.toDate().toISOString()
            : data.createdAt?._seconds
              ? new Date(data.createdAt._seconds * 1000).toISOString()
              : data.createdAt || null;
          const readAt = data.readAt?.toDate?.()
            ? data.readAt.toDate().toISOString()
            : data.readAt?._seconds
              ? new Date(data.readAt._seconds * 1000).toISOString()
              : data.readAt || null;
          return {
            id: doc.id,
            userId: data.userId || userId,
            type: data.type || 'unknown',
            title: data.title || '',
            message: data.message || '',
            sourceUserId: data.sourceUserId,
            sourcePageId: data.sourcePageId,
            sourcePageTitle: data.sourcePageTitle,
            targetPageId: data.targetPageId,
            targetPageTitle: data.targetPageTitle,
            actionUrl: data.actionUrl,
            metadata: data.metadata || {},
            read: data.read || false,
            createdAt,
            readAt
          };
        });

        const lastDoc = notificationsSnapshot.docs.length > 0
          ? notificationsSnapshot.docs[notificationsSnapshot.docs.length - 1].id
          : null;

        return NextResponse.json({
          success: true,
          notifications,
          lastVisible: lastDoc,
          hasMore: notifications.length === (limit ? parseInt(limit) : 20)
        });
    }

  } catch (error) {
    console.error('Error in notifications API:', error);

    // Return empty notifications instead of 500 error to prevent UI breaking
    return NextResponse.json({
      success: true,
      notifications: [],
      lastVisible: null,
      hasMore: false,
      error: 'Failed to fetch notifications - returning empty list'
    }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, notificationId, notificationData, criticality } = body;

    // Get the current user ID from request (authenticated user)
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    const db = admin.firestore();

    // Handle different actions
    switch (action) {
      case 'create':
        // Create a new notification
        if (!notificationData) {
          return NextResponse.json(
            { error: 'Notification data is required for create' },
            { status: 400 }
          );
        }

        const batch = db.batch();

        // Create the notification document in subcollection
        const notificationsRef = db.collection(getCollectionName('users'))
          .doc(notificationData.userId)
          .collection(getCollectionName('notifications'));
        const notificationRef = notificationsRef.doc();

        // Import criticality utilities
        const { getDefaultCriticality } = await import('../../utils/notificationCriticality');

        const notification = {
          ...notificationData,
          read: notificationData.read || false,
          criticality: notificationData.criticality || getDefaultCriticality(notificationData.type as any),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        batch.set(notificationRef, notification);

        // Increment unread count if notification is unread
        if (!notificationData.read) {
          const userDocRef = db.collection(getCollectionName('users')).doc(notificationData.userId);
          batch.update(userDocRef, {
            unreadNotificationsCount: admin.firestore.FieldValue.increment(1)
          });
        }

        await batch.commit();

        return NextResponse.json({
          success: true,
          notificationId: notificationRef.id
        });

      case 'markAsRead':
        if (!notificationId) {
          return NextResponse.json(
            { error: 'Notification ID is required for markAsRead' },
            { status: 400 }
          );
        }

        const readBatch = db.batch();

        // Update the notification in subcollection
        const notificationToReadRef = db.collection(getCollectionName('users'))
          .doc(userId)
          .collection(getCollectionName('notifications'))
          .doc(notificationId);

        readBatch.update(notificationToReadRef, {
          read: true,
          readAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Decrement unread count in user document
        const userDocRef = db.collection(getCollectionName('users')).doc(userId);
        readBatch.update(userDocRef, {
          unreadNotificationsCount: admin.firestore.FieldValue.increment(-1)
        });

        await readBatch.commit();
        return NextResponse.json({ success: true });

      case 'markAsUnread':
        if (!notificationId) {
          return NextResponse.json(
            { error: 'Notification ID is required for markAsUnread' },
            { status: 400 }
          );
        }

        const unreadBatch = db.batch();

        // Update the notification in subcollection
        const notificationToUnreadRef = db.collection(getCollectionName('users'))
          .doc(userId)
          .collection(getCollectionName('notifications'))
          .doc(notificationId);

        unreadBatch.update(notificationToUnreadRef, {
          read: false,
          readAt: null
        });

        // Increment unread count in user document
        const userDocRefUnread = db.collection(getCollectionName('users')).doc(userId);
        unreadBatch.update(userDocRefUnread, {
          unreadNotificationsCount: admin.firestore.FieldValue.increment(1)
        });

        await unreadBatch.commit();
        return NextResponse.json({ success: true });

      case 'markAllAsRead':
        // Get all unread notifications for the user from subcollection
        const userNotificationsRef = db.collection(getCollectionName('users'))
          .doc(userId)
          .collection(getCollectionName('notifications'));

        const unreadQuery = userNotificationsRef.where('read', '==', false);
        const unreadSnapshot = await unreadQuery.get();

        if (unreadSnapshot.empty) {
          return NextResponse.json({ success: true, message: 'No unread notifications' });
        }

        // Update all unread notifications to read
        const markAllBatch = db.batch();
        unreadSnapshot.docs.forEach(doc => {
          markAllBatch.update(doc.ref, {
            read: true,
            readAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });

        // Reset unread count in user document
        const userDocRefMarkAll = db.collection(getCollectionName('users')).doc(userId);
        markAllBatch.update(userDocRefMarkAll, {
          unreadNotificationsCount: 0
        });

        await markAllBatch.commit();
        return NextResponse.json({ success: true });

      case 'updateCriticality':
        if (!notificationId || !criticality) {
          return NextResponse.json(
            { error: 'Notification ID and criticality are required for updateCriticality' },
            { status: 400 }
          );
        }

        // Validate criticality value
        if (!['device', 'normal', 'hidden'].includes(criticality)) {
          return NextResponse.json(
            { error: 'Invalid criticality value. Must be: device, normal, or hidden' },
            { status: 400 }
          );
        }

        // Update notification criticality in subcollection
        const criticalityNotificationRef = db.collection(getCollectionName('users'))
          .doc(userId)
          .collection(getCollectionName('notifications'))
          .doc(notificationId);

        await criticalityNotificationRef.update({
          criticality,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return NextResponse.json({ success: true });

      case 'delete':
        if (!notificationId) {
          return NextResponse.json(
            { error: 'Notification ID is required for delete' },
            { status: 400 }
          );
        }

        // Delete from subcollection
        const notificationToDeleteRef = db.collection(getCollectionName('users'))
          .doc(userId)
          .collection(getCollectionName('notifications'))
          .doc(notificationId);

        await notificationToDeleteRef.delete();
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in notifications API:', error);
    return NextResponse.json(
      { error: 'Failed to process notification action' },
      { status: 500 }
    );
  }
}
