import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    // Get the current user ID from request (authenticated user)
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get followed pages using Firebase Admin
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not initialized');
    }
    const db = admin.firestore();
    const followsRef = db.collection(getCollectionName('follows')).where('userId', '==', userId);
    const followsSnapshot = await followsRef.get();

    const followedPageIds: string[] = [];
    followsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.pageId) {
        followedPageIds.push(data.pageId);
      }
    });

    return NextResponse.json({
      success: true,
      followedPages: followedPageIds
    });

  } catch (error) {
    console.error('Error in followed-pages API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch followed pages' },
      { status: 500 }
    );
  }
}
