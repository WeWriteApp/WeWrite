import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

/**
 * GET /api/user-preferences/notifications
 * Get user's notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = initAdmin();
    const db = admin.firestore();

    const preferencesRef = db.collection(getCollectionName(COLLECTIONS.USER_PREFERENCES)).doc(userId);
    const preferencesDoc = await preferencesRef.get();

    if (!preferencesDoc.exists || !preferencesDoc.data()?.notificationPreferences) {
      return NextResponse.json({ preferences: null });
    }

    return NextResponse.json({
      preferences: preferencesDoc.data()?.notificationPreferences
    });
  } catch (error) {
    console.error('[Notification Preferences GET] Error:', error);
    return NextResponse.json({
      error: 'Failed to load notification preferences'
    }, { status: 500 });
  }
}

/**
 * POST /api/user-preferences/notifications
 * Save user's notification preferences
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { preferences } = await request.json();

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ error: 'Invalid preferences data' }, { status: 400 });
    }

    const admin = initAdmin();
    const db = admin.firestore();

    const preferencesRef = db.collection(getCollectionName(COLLECTIONS.USER_PREFERENCES)).doc(userId);
    await preferencesRef.set({
      notificationPreferences: preferences,
      notificationPreferencesUpdatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notification Preferences POST] Error:', error);
    return NextResponse.json({
      error: 'Failed to save notification preferences'
    }, { status: 500 });
  }
}
