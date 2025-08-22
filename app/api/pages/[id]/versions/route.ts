import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../auth-helper';
import { initAdmin } from '../../../../firebase/admin';
import { getCollectionName } from '../../../../utils/environmentConfig';

/**
 * Page Versions API Route
 * 
 * GET: Get version history for a page
 * POST: Create a new version for a page
 * 
 * This route replaces direct Firebase calls for page versioning operations
 * and ensures environment-aware collection naming.
 */

interface PageVersion {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  username: string;
  title?: string;
  groupId?: string;
  previousVersionId?: string;
  isNoOp?: boolean;
  isNewPage?: boolean;
  diff?: {
    added: number;
    removed: number;
    hasChanges: boolean;
  };
  diffPreview?: {
    beforeContext: string;
    addedText: string;
    removedText: string;
    afterContext: string;
    hasAdditions: boolean;
    hasRemovals: boolean;
  };
}

// GET /api/pages/[id]/versions?limit=20&includeNoOp=false
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('📊 [PAGE VERSIONS API] Called for pageId:', resolvedParams.id);
  try {
    const { id: pageId } = resolvedParams;
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const includeNoOp = searchParams.get('includeNoOp') === 'true';
    
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (limit > 100) {
      return createErrorResponse('Limit cannot exceed 100', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Check if page exists and get page data
    const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
    if (!pageDoc.exists) {
      return createErrorResponse('Page not found', 'NOT_FOUND');
    }

    const pageData = pageDoc.data();

    // Check permissions - user must own the page or it must be public
    let currentUserId: string | null = null;
    try {
      currentUserId = await getUserIdFromRequest(request);
    } catch (error) {
      console.log('📊 [PAGE_VERSIONS] Anonymous access (getUserIdFromRequest failed):', error);
      // Continue with null currentUserId for anonymous access
    }

    // Enhanced permission check with admin support
    const isOwner = pageData?.userId === currentUserId;
    const isPublic = pageData?.isPublic;

    // Check if user is admin (for debugging and admin access)
    const isAdmin = currentUserId && (
      currentUserId === 'jamie' ||
      currentUserId === 'jamiegray2234@gmail.com' ||
      // Add any other admin identifiers
      false
    );

    // Enhanced permission check - allow public pages, owners, admins, or in development
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
    const canView = isPublic || isOwner || isAdmin || isDevelopment;

    console.log(`📊 [PAGE_VERSIONS] Permission check:`, {
      pageId,
      currentUserId,
      isOwner,
      isPublic,
      isAdmin,
      canView,
      pageUserId: pageData?.userId,
      pageTitle: pageData?.title
    });

    if (!canView) {
      return createErrorResponse('You do not have permission to view this page', 'FORBIDDEN');
    }

    console.log(`📊 [PAGE_VERSIONS] Fetching versions for page: ${pageId}`);

    // Build query for versions - ultra-simplified to avoid any index requirements
    console.log(`📊 [PAGE_VERSIONS] Building simple query for page: ${pageId}`);

    const versionsRef = db.collection(getCollectionName('pages'))
      .doc(pageId)
      .collection('versions');

    console.log(`📊 [PAGE_VERSIONS] Collection path: ${getCollectionName('pages')}/${pageId}/versions`);

    // Ultra-simple query - just get all versions and sort/filter in memory
    const versionsSnapshot = await versionsRef.get();

    if (versionsSnapshot.empty) {
      console.log(`📊 [PAGE_VERSIONS] No versions found for page: ${pageId}`);
      return createApiResponse({
        versions: [],
        count: 0,
        pageId,
        pageTitle: pageData?.title || 'Untitled',
        note: 'No versions found for this page'
      });
    }

    // Transform all versions first
    let allVersions: PageVersion[] = versionsSnapshot.docs.map(doc => {
      const data = doc.data();

      return {
        id: doc.id,
        content: data.content || '',
        createdAt: data.createdAt,
        userId: data.userId,
        username: data.username || 'Unknown',
        title: data.title || pageData?.title || 'Untitled',
        groupId: data.groupId,
        previousVersionId: data.previousVersionId,
        isNoOp: data.isNoOp || false,
        isNewPage: data.isNewPage || false,

        // Diff data for sparkline and activity display
        diff: data.diff || {
          added: 0,
          removed: 0,
          hasChanges: false
        },

        // Rich diff preview for UI
        diffPreview: data.diffPreview || {
          beforeContext: '',
          addedText: '',
          removedText: '',
          afterContext: '',
          hasAdditions: false,
          hasRemovals: false
        },

        // For compatibility with existing UI components
        timestamp: data.createdAt,
        action: data.isNewPage ? 'Created' : 'Edited'
      } as PageVersion;
    });

    // Sort by createdAt descending (most recent first)
    allVersions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Filter out no-op edits unless specifically requested
    let filteredVersions = allVersions;
    if (!includeNoOp) {
      filteredVersions = allVersions.filter(version => !version.isNoOp);
    }

    // Apply limit after filtering
    const versions = filteredVersions.slice(0, limit);

    console.log(`📊 [PAGE_VERSIONS] Returning ${versions.length} versions for page: ${pageId} (filtered from ${allVersions.length})`);

    return createApiResponse({
      versions,
      count: versions.length,
      pageId,
      pageTitle: pageData?.title || 'Untitled',
      includeNoOp
    });

  } catch (error) {
    console.error('📊 [PAGE_VERSIONS] Error fetching page versions:', {
      pageId: resolvedParams.id,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    return createErrorResponse('Failed to fetch page versions', 'INTERNAL_ERROR');
  }
}

// POST /api/pages/[id]/versions
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: pageId } = params;
    const currentUserId = await getUserIdFromRequest(request);
    
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { 
      content, 
      username, 
      groupId, 
      previousVersionId,
      isNoOp = false 
    } = body;

    if (!content || !username) {
      return createErrorResponse('Content and username are required', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Check if page exists and user has permission
    const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
    if (!pageDoc.exists()) {
      return createErrorResponse('Page not found', 'NOT_FOUND');
    }

    const pageData = pageDoc.data();
    if (pageData?.userId !== currentUserId) {
      return createErrorResponse('Permission denied', 'FORBIDDEN');
    }

    // Create version data
    const now = new Date().toISOString();
    const versionData = {
      content: typeof content === 'string' ? content : JSON.stringify(content),
      createdAt: now,
      userId: currentUserId,
      username,
      groupId: groupId || null,
      previousVersionId: previousVersionId || null,
      isNoOp
    };

    // Add the version to the versions subcollection
    const versionRef = await db.collection(getCollectionName('pages'))
      .doc(pageId)
      .collection('versions')
      .add(versionData);

    // Update the page document with the new current version
    await db.collection(getCollectionName('pages')).doc(pageId).update({
      currentVersion: versionRef.id,
      content: versionData.content,
      lastModified: now
    });

    // CRITICAL FIX: Invalidate cache after updating page with new version
    try {
      console.log('🗑️ [VERSION API] Invalidating cache for page:', pageId);

      // Import cache invalidation utilities
      const { invalidatePageData } = await import('../../../../utils/unifiedCache');
      const { pageCache } = await import('../../../../utils/pageCache');

      // Invalidate unified cache
      invalidatePageData(pageId, currentUserId);

      // Invalidate page cache specifically
      pageCache.invalidate(pageId);

      console.log('✅ [VERSION API] Cache invalidation completed for page:', pageId);
    } catch (cacheError) {
      console.error('⚠️ [VERSION API] Cache invalidation failed (non-fatal):', cacheError);
    }

    return createApiResponse({
      success: true,
      message: 'Version created successfully',
      versionId: versionRef.id,
      pageId,
      isNoOp
    });

  } catch (error) {
    console.error('Error creating page version:', error);
    return createErrorResponse('Failed to create page version', 'INTERNAL_ERROR');
  }
}
