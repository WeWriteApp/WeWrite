import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../../firebase/admin';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { getUserIdFromRequest } from '../../../auth-helper';

/**
 * GET /api/pages/[id]/activities
 * 
 * Fetches recent activities (versions) for a specific page
 * This replaces the old page versions system with the unified version system
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    
    // Get current user for permission checking
    const currentUserId = await getUserIdFromRequest(request);
    
    const admin = initAdmin();
    const db = admin.firestore();
    
    // Check if page exists and get page data
    const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
    if (!pageDoc.exists()) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    const pageData = pageDoc.data();
    
    // Check permissions - only allow access to public pages or user's own pages
    if (!pageData?.isPublic && pageData?.userId !== currentUserId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Skip deleted pages
    if (pageData?.deleted === true) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    
    
    // Query versions from the unified version system
    const versionsQuery = db.collection(getCollectionName('pages'))
      .doc(pageId)
      .collection('versions')
      .orderBy('createdAt', 'desc')
      .limit(limit);
    
    const versionsSnapshot = await versionsQuery.get();
    
    if (versionsSnapshot.empty) {
      return NextResponse.json({
        activities: [],
        count: 0,
        pageId,
        note: 'No activities found for this page'
      });
    }
    
    // Convert versions to activity format
    const activities = versionsSnapshot.docs.map(doc => {
      const versionData = doc.data();
      
      return {
        id: doc.id,
        pageId,
        pageName: pageData.title || 'Untitled',
        userId: versionData.userId,
        username: versionData.username,
        timestamp: versionData.createdAt,
        createdAt: versionData.createdAt, // For compatibility
        
        // Version-specific data
        content: versionData.content,
        previousVersionId: versionData.previousVersionId,
        isNewPage: versionData.isNewPage || false,
        isNoOp: versionData.isNoOp || false,
        
        // Diff data for activity display
        diff: versionData.diff,
        diffPreview: versionData.diffPreview,
        
        // Activity metadata
        activityType: 'page_edit',
        isPublic: pageData.isPublic || false
      };
    });
    
    
    return NextResponse.json({
      activities,
      count: activities.length,
      pageId,
      pageTitle: pageData.title,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [PAGE_ACTIVITIES] Error fetching page activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page activities' },
      { status: 500 }
    );
  }
}
