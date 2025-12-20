/**
 * API endpoint for individual page version operations
 * GET /api/pages/[id]/versions/[versionId] - Get a specific version
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../../auth-helper';
import { initAdmin } from '../../../../../firebase/admin';
import { getCollectionName } from '../../../../../utils/environmentConfig';
import { isUserAdmin } from '../../../../../utils/adminSecurity';

interface VersionNavData {
  id: string;
  title?: string;
  createdAt: any;
  username?: string;
  diff?: any;
  [key: string]: any;
}

// GET /api/pages/[id]/versions/[versionId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: pageId, versionId } = await params;

    if (!pageId || !versionId) {
      return createErrorResponse('BAD_REQUEST', 'Page ID and Version ID are required');
    }

    console.log(`📊 [VERSION_DETAIL] Fetching version:`, {
      pageId,
      versionId,
      timestamp: new Date().toISOString()
    });

    // Initialize Firebase Admin
    const admin = initAdmin();
    const db = admin.firestore();

    // Get the page document first to check permissions
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Page not found');
    }

    const pageData = pageDoc.data();

    // Check permissions - all pages are now accessible
    const currentUserId = await getUserIdFromRequest(request);

    // Enhanced permission check with admin support
    const isOwner = pageData?.userId === currentUserId;

    // Check if user is admin using centralized config (for debugging and admin access)
    const isAdmin = currentUserId ? await isUserAdmin(currentUserId) : false;

    // All pages are now public - simplified access model
    const isDevelopment = process.env.NODE_ENV === 'development' ||
                         process.env.VERCEL_ENV === 'development' ||
                         process.env.VERCEL_ENV === 'preview';

    console.log(`📊 [VERSION_DETAIL] Permission check:`, {
      pageId,
      versionId,
      currentUserId,
      isOwner,
      isAdmin,
      isDevelopment,
      canView: true,
      pageUserId: pageData?.userId,
      pageTitle: pageData?.title,
      note: 'All pages are now public'
    });

    // No access control needed - all pages are accessible

    // Get the specific version
    const versionRef = pageRef.collection('versions').doc(versionId);
    const versionDoc = await versionRef.get();

    if (!versionDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Version not found');
    }

    const versionData = versionDoc.data();

    // Get the previous version for comparison if it exists
    let previousVersion: VersionNavData | null = null;
    if (versionData?.previousVersionId) {
      const prevVersionRef = pageRef.collection('versions').doc(versionData.previousVersionId);
      const prevVersionDoc = await prevVersionRef.get();
      if (prevVersionDoc.exists) {
        const prevData = prevVersionDoc.data();
        previousVersion = {
          id: prevVersionDoc.id,
          ...prevData
        };
      }
    }

    // Get the next version (version that has this version as previousVersionId)
    let nextVersion: VersionNavData | null = null;
    const nextVersionQuery = pageRef.collection('versions')
      .where('previousVersionId', '==', versionId)
      .limit(1);
    const nextVersionSnapshot = await nextVersionQuery.get();

    if (!nextVersionSnapshot.empty) {
      const nextVersionDoc = nextVersionSnapshot.docs[0];
      const nextData = nextVersionDoc.data();
      nextVersion = {
        id: nextVersionDoc.id,
        ...nextData
      };
    }

    // Format the response
    const response = {
      version: {
        id: versionDoc.id,
        ...versionData,
        // Ensure timestamps are properly formatted
        createdAt: versionData?.createdAt?.toDate?.() || versionData?.createdAt,
        timestamp: versionData?.timestamp?.toDate?.() || versionData?.timestamp || versionData?.createdAt
      },
      previousVersion: previousVersion ? {
        id: previousVersion.id,
        title: previousVersion.title,
        createdAt: previousVersion.createdAt?.toDate?.() || previousVersion.createdAt,
        username: previousVersion.username,
        diff: previousVersion.diff
      } : null,
      nextVersion: nextVersion ? {
        id: nextVersion.id,
        title: nextVersion.title,
        createdAt: nextVersion.createdAt?.toDate?.() || nextVersion.createdAt,
        username: nextVersion.username,
        diff: nextVersion.diff
      } : null,
      pageId,
      pageTitle: pageData?.title || 'Untitled'
    };

    console.log(`✅ [VERSION_DETAIL] Successfully fetched version:`, {
      pageId,
      versionId,
      hasContent: !!versionData?.content,
      hasPreviousVersion: !!previousVersion,
      hasNextVersion: !!nextVersion,
      username: versionData?.username
    });

    return createApiResponse(response);

  } catch (error) {
    console.error('❌ [VERSION_DETAIL] Error fetching version:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch page version');
  }
}
