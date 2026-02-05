import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getCollectionNameAsync } from '../../../../utils/environmentConfig';
import { getFirebaseAdmin } from '../../../../firebase/admin';

/**
 * Update page visibility (isPublic field)
 *
 * Only the page owner can change visibility.
 * Requires the private_pages feature flag to be enabled.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;

    // Require authentication
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { isPublic } = body;

    if (typeof isPublic !== 'boolean') {
      return NextResponse.json(
        { error: 'isPublic must be a boolean' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const collectionName = await getCollectionNameAsync('pages');

    // Get the page to verify ownership
    const pageRef = db.collection(collectionName).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data();

    // Verify ownership
    if (pageData?.userId !== currentUserId) {
      return NextResponse.json(
        { error: 'Only the page owner can change visibility' },
        { status: 403 }
      );
    }

    // Update the visibility
    await pageRef.update({
      isPublic,
      lastModified: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      pageId,
      isPublic,
    });

  } catch (error: any) {
    console.error('[Page Visibility API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update visibility',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
