import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getUserTotalViewCount } from '../../../firebase/counters';
import logger from '../../../utils/logger';

/**
 * GET /api/users/view-count
 * Get total view count for a user's pages
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    
    // Get authenticated user
    const currentUserId = await getUserIdFromRequest(request);
    
    if (!targetUserId) {
      return createErrorResponse('User ID is required', 400);
    }

    logger.info('🔍 [USER_VIEW_COUNT_API] Getting view count', {
      targetUserId,
      currentUserId,
      timestamp: new Date().toISOString()
    });

    // Get real view count from database
    const viewCount = await getUserTotalViewCount(targetUserId);

    logger.info('🔍 [USER_VIEW_COUNT_API] Retrieved view count', {
      targetUserId,
      viewCount,
      timestamp: new Date().toISOString()
    });

    return createApiResponse({
      viewCount,
      userId: targetUserId
    });

  } catch (error) {
    logger.error('❌ [USER_VIEW_COUNT_API] Error getting user view count:', error);
    return createErrorResponse('Failed to get user view count', 500);
  }
}
