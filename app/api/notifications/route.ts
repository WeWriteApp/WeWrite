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
        // Get unread notification count
        const countRef = db.collection(getCollectionName('notifications'))
          .where('userId', '==', userId)
          .where('read', '==', false);
        const countSnapshot = await countRef.get();
        const count = countSnapshot.size;

        return NextResponse.json({
          success: true,
          count
        });

      case 'list':
      default:
        // Get notifications list (simplified query to avoid index requirement)
        let notificationsRef = db.collection(getCollectionName('notifications'))
          .where('userId', '==', userId)
          .limit(limit ? parseInt(limit) : 20);

        const notificationsSnapshot = await notificationsRef.get();
        let notifications = notificationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort by createdAt in memory since we can't use orderBy without an index
        notifications.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const bTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return bTime - aTime; // Descending order (newest first)
        });

        return NextResponse.json({
          success: true,
          notifications
        });
    }

  } catch (error) {
    console.error('Error in notifications API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, notificationId } = await request.json();

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
      case 'markAsRead':
        if (!notificationId) {
          return NextResponse.json(
            { error: 'Notification ID is required for markAsRead' },
            { status: 400 }
          );
        }
        await db.collection(getCollectionName('notifications')).doc(notificationId).update({
          read: true,
          readAt: new Date()
        });
        return NextResponse.json({ success: true });

      case 'markAsUnread':
        if (!notificationId) {
          return NextResponse.json(
            { error: 'Notification ID is required for markAsUnread' },
            { status: 400 }
          );
        }
        await db.collection(getCollectionName('notifications')).doc(notificationId).update({
          read: false,
          readAt: null
        });
        return NextResponse.json({ success: true });

      case 'markAllAsRead':
        // Get all unread notifications for the user
        const unreadRef = db.collection(getCollectionName('notifications'))
          .where('userId', '==', userId)
          .where('read', '==', false);
        const unreadSnapshot = await unreadRef.get();

        // Update all unread notifications to read
        const batch = db.batch();
        unreadSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            read: true,
            readAt: new Date()
          });
        });
        await batch.commit();

        return NextResponse.json({ success: true });

      case 'delete':
        if (!notificationId) {
          return NextResponse.json(
            { error: 'Notification ID is required for delete' },
            { status: 400 }
          );
        }
        await db.collection(getCollectionName('notifications')).doc(notificationId).delete();
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
