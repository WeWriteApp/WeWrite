import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../auth-helper';
import { initAdmin } from '../../firebase/admin';
import { getCollectionName } from '../../utils/environmentConfig';

/**
 * Activity API Route
 * 
 * GET: Get recent activity data
 * POST: Record new activity
 * 
 * This route replaces direct Firebase calls for activity operations
 * and ensures environment-aware collection naming.
 */

// GET /api/activity?limit=30&userId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const currentUserId = await getUserIdFromRequest(request);
    
    const limit = limitParam ? parseInt(limitParam, 10) : 30;
    
    if (limit > 100) {
      return createErrorResponse('Limit cannot exceed 100', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Query recent activities
    const activitiesQuery = db.collection(getCollectionName('activities'))
      .where('isPublic', '==', true)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    const activitiesSnapshot = await activitiesQuery.get();

    if (activitiesSnapshot.empty) {
      return createApiResponse({
        activities: [],
        note: "No activities found"
      });
    }

    const activities = activitiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
    }));

    return createApiResponse({
      activities,
      count: activities.length
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    return createErrorResponse('Failed to fetch activities', 'INTERNAL_ERROR');
  }
}

// POST /api/activity
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { 
      type, 
      pageId, 
      pageName, 
      content, 
      previousContent, 
      isPublic = true,
      groupId,
      groupName 
    } = body;

    if (!type || !pageId) {
      return createErrorResponse('Activity type and pageId are required', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Get user data for the activity
    const userDoc = await db.collection(getCollectionName('users')).doc(currentUserId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const activityData = {
      type,
      pageId,
      pageName: pageName || 'Untitled',
      userId: currentUserId,
      username: userData.username || 'Anonymous',
      content: content || '',
      previousContent: previousContent || '',
      isPublic,
      timestamp: new Date(),
      createdAt: new Date().toISOString()
    };

    // Add group data if provided
    if (groupId) {
      activityData.groupId = groupId;
      activityData.groupName = groupName || '';
    }

    // Add the activity
    const activityRef = await db.collection(getCollectionName('activities')).add(activityData);

    return createApiResponse({ 
      success: true, 
      activityId: activityRef.id,
      message: 'Activity recorded successfully'
    });

  } catch (error) {
    console.error('Error recording activity:', error);
    return createErrorResponse('Failed to record activity', 'INTERNAL_ERROR');
  }
}
