import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { createErrorResponse, createSuccessResponse } from '../../../utils/apiHelpers';

/**
 * GET /api/contributors/[pageId]
 * 
 * Get contributor statistics for a specific page.
 * Environment-aware API replacement for ContributorsService real-time listeners.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const resolvedParams = await params;
    const pageId = resolvedParams.pageId;

    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    console.log('👥 [CONTRIBUTORS API] Fetching contributors for page:', pageId);

    // Use environment-aware collection naming
    const versionsRef = db.collection(getCollectionName('pages'))
      .doc(pageId)
      .collection('versions');

    // Get all versions to calculate contributor stats
    const versionsSnapshot = await versionsRef.get();

    if (versionsSnapshot.empty) {
      return createSuccessResponse({
        pageId,
        count: 0,
        uniqueContributors: [],
        contributors: []
      });
    }

    // Calculate contributor statistics
    const contributorMap = new Map<string, {
      userId: string;
      username: string;
      contributionCount: number;
      lastContribution: string;
    }>();

    versionsSnapshot.docs.forEach(doc => {
      const versionData = doc.data();
      const userId = versionData.userId;
      const username = versionData.username || 'Anonymous';
      const createdAt = versionData.createdAt || versionData.timestamp;

      if (userId) {
        if (contributorMap.has(userId)) {
          const existing = contributorMap.get(userId)!;
          existing.contributionCount++;
          
          // Update last contribution if this one is more recent
          if (createdAt && (!existing.lastContribution || createdAt > existing.lastContribution)) {
            existing.lastContribution = createdAt;
          }
        } else {
          contributorMap.set(userId, {
            userId,
            username,
            contributionCount: 1,
            lastContribution: createdAt || new Date().toISOString()
          });
        }
      }
    });

    // Convert to array and sort by contribution count
    const contributors = Array.from(contributorMap.values())
      .sort((a, b) => b.contributionCount - a.contributionCount);

    const uniqueContributors = contributors.map(c => c.userId);

    console.log('✅ [CONTRIBUTORS API] Found contributors', {
      pageId,
      count: contributors.length,
      totalVersions: versionsSnapshot.size
    });

    return createSuccessResponse({
      pageId,
      count: contributors.length,
      uniqueContributors,
      contributors,
      totalVersions: versionsSnapshot.size,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [CONTRIBUTORS API] Error fetching contributors:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch contributors');
  }
}
