import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { createErrorResponse, createSuccessResponse } from '../../../../utils/apiHelpers';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';

/**
 * POST /api/pages/[id]/append-reference
 * 
 * Append content from a source page to a target page with proper reference header.
 * This is the environment-aware API replacement for the appendPageReference function.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const targetPageId = resolvedParams.id;

    // Get current user
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    // Initialize Firebase Admin using standardized function
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    const db = admin.firestore();

    // Parse request body
    const body = await request.json();
    const { sourcePageData } = body;

    if (!sourcePageData || !sourcePageData.id) {
      return createErrorResponse('BAD_REQUEST', 'Source page data is required');
    }

    console.log('📝 [APPEND REFERENCE] Starting append operation', {
      targetPageId,
      sourcePageId: sourcePageData.id,
      sourceTitle: sourcePageData.title,
      userId: currentUserId
    });

    // Get the target page using environment-aware collection naming
    const targetPageRef = db.collection(getCollectionName('pages')).doc(targetPageId);
    const targetPageDoc = await targetPageRef.get();

    if (!targetPageDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Target page not found');
    }

    const targetPageData = targetPageDoc.data();

    // Check if user can edit the target page
    if (targetPageData?.userId !== currentUserId) {
      // Check if page is public and allows editing (if such logic exists)
      if (!targetPageData?.isPublic) {
        return createErrorResponse('FORBIDDEN', 'You do not have permission to edit this page');
      }
    }

    // Parse current content
    let currentContent = [];
    try {
      if (targetPageData?.content) {
        currentContent = typeof targetPageData.content === 'string' 
          ? JSON.parse(targetPageData.content) 
          : targetPageData.content;
      }
    } catch (error) {
      console.error('Error parsing target page content:', error);
      currentContent = [];
    }

    // Parse source content
    let sourceContent = [];
    try {
      if (sourcePageData.content) {
        sourceContent = typeof sourcePageData.content === 'string' 
          ? JSON.parse(sourcePageData.content) 
          : sourcePageData.content;
      }
    } catch (error) {
      console.error('Error parsing source page content:', error);
      sourceContent = [];
    }

    // Validate content structure
    if (!Array.isArray(currentContent)) {
      currentContent = [];
    }
    if (!Array.isArray(sourceContent)) {
      sourceContent = [];
    }

    // Content size validation
    const MAX_CONTENT_SIZE = 50000;
    const MAX_CONTENT_BLOCKS = 100;

    const totalContentSize = JSON.stringify([...currentContent, ...sourceContent]).length;
    const totalBlocks = currentContent.length + sourceContent.length;

    if (totalContentSize > MAX_CONTENT_SIZE) {
      return createErrorResponse('BAD_REQUEST', 'Combined content exceeds maximum size limit');
    }

    if (totalBlocks > MAX_CONTENT_BLOCKS) {
      return createErrorResponse('BAD_REQUEST', 'Combined content exceeds maximum block limit');
    }

    // Create a reference header to append
    const referenceHeader = {
      type: "paragraph",
      children: [
        { text: "Content from " },
        {
          type: "link",
          url: `/pages/${sourcePageData.id}`,
          pageId: sourcePageData.id,
          pageTitle: sourcePageData.title,
          originalPageTitle: sourcePageData.title,
          isPageLink: true,
          className: "page-link",
          children: [{ text: sourcePageData.title }]
        }
      ]
    };

    // Append the reference header and source content to the target content
    const newContent = [
      ...currentContent,
      referenceHeader,
      ...sourceContent
    ];

    // Update the page with the new content using environment-aware collection naming
    const updateData = {
      content: JSON.stringify(newContent),
      lastModified: new Date().toISOString()
    };

    await targetPageRef.update(updateData);

    console.log('✅ [APPEND REFERENCE] Successfully appended content', {
      targetPageId,
      sourcePageId: sourcePageData.id,
      newContentBlocks: newContent.length,
      userId: currentUserId
    });

    return createSuccessResponse({
      success: true,
      targetPageId,
      sourcePageId: sourcePageData.id,
      newContentBlocks: newContent.length,
      message: 'Content successfully appended to page'
    });

  } catch (error) {
    console.error('❌ [APPEND REFERENCE] Error appending content:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to append content to page');
  }
}
