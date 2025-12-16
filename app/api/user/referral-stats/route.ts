/**
 * Referral Stats API
 *
 * Returns statistics about users who signed up using a referral link.
 * Tracks referredBy field on user documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const db = admin.firestore();

    // Query users who were referred by this user
    const referralsSnapshot = await db.collection(getCollectionName('users'))
      .where('referredBy', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const recentReferrals = referralsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        username: data.username || 'Anonymous',
        joinedAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        referralSource: data.referralSource || 'general', // Landing page vertical (e.g., 'writers', 'journalism')
      };
    });

    // Get total count (may be more than the 10 we fetched)
    const countSnapshot = await db.collection(getCollectionName('users'))
      .where('referredBy', '==', userId)
      .count()
      .get();

    const totalReferrals = countSnapshot.data().count;

    return NextResponse.json({
      success: true,
      totalReferrals,
      recentReferrals,
    });
  } catch (error) {
    console.error('[REFERRAL STATS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      totalReferrals: 0,
      recentReferrals: [],
    });
  }
}
