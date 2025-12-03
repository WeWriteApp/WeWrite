/**
 * Replies API Endpoint
 * 
 * Returns all pages that reply to a specific page, with filtering by reply type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

interface ReplyInfo {
  id: string;
  title: string;
  username: string;
  replyType: 'agree' | 'disagree' | 'neutral' | 'standard' | null;
  createdAt: any;
  userId: string;
}

interface RepliesResponse {
  replies: ReplyInfo[];
  counts: {
    agree: number;
    disagree: number;
    neutral: number;
    total: number;
  };
  pageId: string;
  timestamp: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<RepliesResponse | { error: string; timestamp: string }>> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({
        error: 'Firebase Admin not initialized',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const db = admin.firestore();
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get('pageId');
    const filterType = searchParams.get('type'); // 'agree' | 'disagree' | 'neutral' | null for all

    if (!pageId) {
      return NextResponse.json({
        error: 'pageId parameter is required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    console.log(`📝 [REPLIES_API] Getting replies for page ${pageId}`, {
      filterType,
      timestamp: new Date().toISOString()
    });

    // Query pages that have replyTo pointing to this page
    // Note: We can't query for isDeleted == false directly since some docs may not have the field
    // So we query all replies and filter in code
    const pagesCollection = getCollectionName('pages');
    let query = db.collection(pagesCollection)
      .where('replyTo', '==', pageId);

    const snapshot = await query.get();

    const replies: ReplyInfo[] = [];
    const counts = {
      agree: 0,
      disagree: 0,
      neutral: 0,
      total: 0
    };

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Skip deleted pages
      if (data.isDeleted || data.deleted) {
        continue;
      }
      
      // Determine reply type - check multiple possible locations
      let replyType: 'agree' | 'disagree' | 'neutral' | 'standard' | null = null;
      
      // Check page-level replyType
      if (data.replyType) {
        replyType = data.replyType;
      }
      
      // Check content block for replyType (for older format)
      if (!replyType && Array.isArray(data.content) && data.content.length > 0) {
        const firstBlock = data.content[0];
        if (firstBlock?.replyType) {
          replyType = firstBlock.replyType;
        }
      }
      
      // Normalize reply type
      if (replyType === 'standard' || !replyType) {
        replyType = 'neutral';
      }

      // Update counts
      counts.total++;
      if (replyType === 'agree') counts.agree++;
      else if (replyType === 'disagree') counts.disagree++;
      else counts.neutral++;

      // Apply filter if specified
      if (filterType && replyType !== filterType) {
        continue;
      }

      replies.push({
        id: doc.id,
        title: data.title || 'Untitled',
        username: data.username || '',
        replyType,
        createdAt: data.createdAt,
        userId: data.userId
      });
    }

    // Sort by createdAt descending (newest first)
    replies.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return bTime.getTime() - aTime.getTime();
    });

    console.log(`📝 [REPLIES_API] Found ${replies.length} replies for page ${pageId}`, {
      counts,
      filterType,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      replies,
      counts,
      pageId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('📝 [REPLIES_API] Error getting replies:', error);
    return NextResponse.json({
      error: 'Failed to get replies',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
