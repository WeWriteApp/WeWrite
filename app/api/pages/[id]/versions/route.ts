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
  groupId?: string;
  previousVersionId?: string;
  isNoOp?: boolean;
}

// GET /api/pages/[id]/versions?limit=20&includeNoOp=false
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: pageId } = params;
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const includeNoOp = searchParams.get('includeNoOp') === 'true';
    
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (limit > 100) {
      return createErrorResponse('Limit cannot exceed 100', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    // Check if page exists
    const pageDoc = await db.collection(getCollectionName('pages')).doc(pageId).get();
    if (!pageDoc.exists()) {
      return createErrorResponse('Page not found', 'NOT_FOUND');
    }

    // Build query for versions
    let versionsQuery = db.collection(getCollectionName('pages'))
      .doc(pageId)
      .collection('versions')
      .orderBy('createdAt', 'desc');

    // Filter out no-op edits unless specifically requested
    if (!includeNoOp) {
      versionsQuery = versionsQuery.where('isNoOp', '!=', true);
    }

    versionsQuery = versionsQuery.limit(limit);

    const versionsSnapshot = await versionsQuery.get();

    if (versionsSnapshot.empty) {
      return createApiResponse({
        versions: [],
        count: 0,
        pageId,
        note: 'No versions found for this page'
      });
    }

    const versions: PageVersion[] = versionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PageVersion));

    return createApiResponse({
      versions,
      count: versions.length,
      pageId,
      includeNoOp
    });

  } catch (error) {
    console.error('Error fetching page versions:', error);
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
