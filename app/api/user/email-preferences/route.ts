import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';

/**
 * Email Preferences API
 * 
 * GET: Fetch user's email preferences
 * POST: Update user's email preferences
 */

const defaultPreferences = {
  securityAlerts: true,
  loginNotifications: true,
  newFollower: true,
  pageComments: true,
  pageMentions: true,
  payoutReminders: true,
  paymentReceipts: true,
  earningsSummary: true,
  weeklyDigest: true,
  productUpdates: true,
  tipsAndTricks: false,
};

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const isDev = process.env.NODE_ENV === 'development';
    const collectionPrefix = isDev ? 'DEV_' : '';
    
    const userDoc = await db.collection(`${collectionPrefix}users`).doc(userId).get();
    const userData = userDoc.data();
    
    const preferences = userData?.emailPreferences || defaultPreferences;

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('[Email Preferences API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { preferences } = body;

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid preferences' },
        { status: 400 }
      );
    }

    // Validate and sanitize preferences
    const validKeys = Object.keys(defaultPreferences);
    const sanitizedPreferences: Record<string, boolean> = {};
    
    for (const key of validKeys) {
      if (key in preferences) {
        sanitizedPreferences[key] = Boolean(preferences[key]);
      } else {
        sanitizedPreferences[key] = defaultPreferences[key as keyof typeof defaultPreferences];
      }
    }

    // Security alerts must always be enabled
    sanitizedPreferences.securityAlerts = true;

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const isDev = process.env.NODE_ENV === 'development';
    const collectionPrefix = isDev ? 'DEV_' : '';
    
    await db.collection(`${collectionPrefix}users`).doc(userId).update({
      emailPreferences: sanitizedPreferences,
      emailPreferencesUpdatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      preferences: sanitizedPreferences,
    });
  } catch (error) {
    console.error('[Email Preferences API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save preferences' },
      { status: 500 }
    );
  }
}
