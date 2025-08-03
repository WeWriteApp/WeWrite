import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getUserIdFromRequest } from '../../../../utils/auth';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { createErrorResponse, createSuccessResponse } from '../../../../utils/apiHelpers';

/**
 * POST /api/pages/[id]/set-current-version
 * 
 * Set a specific version as the current version (restore functionality).
 * Environment-aware API replacement for the setCurrentVersion function.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const pageId = resolvedParams.id;

    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    // Get current user
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    // Parse request body
    const body = await request.json();
    const { versionId } = body;

    if (!versionId) {
      return createErrorResponse('BAD_REQUEST', 'Version ID is required');
    }

    console.log('🔄 [SET CURRENT VERSION] Starting version restore', {
      pageId,
      versionId,
      userId: currentUserId
    });

    // Check if page exists and user has permission
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Page not found');
    }

    const pageData = pageDoc.data();
    if (pageData?.userId !== currentUserId) {
      return createErrorResponse('FORBIDDEN', 'You do not have permission to modify this page');
    }

    // Get the version to restore
    const versionRef = pageRef.collection('versions').doc(versionId);
    const versionDoc = await versionRef.get();

    if (!versionDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Version not found');
    }

    const versionData = versionDoc.data();

    // Update the page document with the new current version and content
    const updateData = {
      currentVersion: versionId,
      content: versionData?.content || '',
      lastModified: new Date().toISOString()
    };

    await pageRef.update(updateData);

    console.log('✅ [SET CURRENT VERSION] Successfully restored version', {
      pageId,
      versionId,
      userId: currentUserId
    });

    return createSuccessResponse({
      success: true,
      pageId,
      versionId,
      restoredContent: versionData?.content || '',
      message: 'Version restored successfully'
    });

  } catch (error) {
    console.error('❌ [SET CURRENT VERSION] Error restoring version:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to restore version');
  }
}
