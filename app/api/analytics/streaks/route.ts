import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * GET /api/analytics/streaks
 * Get user streak data
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = admin.firestore();
    const streaksCollection = getCollectionName('streaks');
    const streakDoc = await db.collection(streaksCollection).doc(userId).get();

    if (!streakDoc.exists) {
      // Return default streak data for new users
      return NextResponse.json({
        data: {
          currentStreak: 0,
          longestStreak: 0,
          lastActiveDate: null,
          totalDaysActive: 0
        }
      });
    }

    const streakData = streakDoc.data();
    
    // Format the response to match expected interface
    const formattedData = {
      currentStreak: streakData?.currentStreak || 0,
      longestStreak: streakData?.longestStreak || 0,
      lastActiveDate: streakData?.lastActiveDate?.toDate?.()?.toISOString() || null,
      totalDaysActive: streakData?.totalDaysActive || 0
    };

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    console.error('Error fetching user streaks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user streaks' },
      { status: 500 }
    );
  }
}
