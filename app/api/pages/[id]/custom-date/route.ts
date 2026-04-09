import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

/**
 * PATCH /api/pages/[id]/custom-date
 * Update the custom date of a specific page
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Get current user
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { customDate } = body;

    // Validate customDate: must be a string (ISO date) or null
    if (customDate !== null && customDate !== undefined) {
      if (typeof customDate !== 'string') {
        return NextResponse.json(
          { error: 'Invalid date format. Expected an ISO date string or null.' },
          { status: 400 }
        );
      }
      // Basic ISO date validation (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate)) {
        return NextResponse.json(
          { error: 'Invalid date format. Expected YYYY-MM-DD.' },
          { status: 400 }
        );
      }
      // Validate it's a real date
      const parsed = new Date(customDate + 'T00:00:00Z');
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date value.' },
          { status: 400 }
        );
      }
    }

    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get the page to check ownership
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data();

    // Check if user owns the page
    if (pageData?.userId !== currentUserId) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Update the custom date
    const updateData: Record<string, any> = {
      lastModified: new Date().toISOString(),
    };

    if (customDate === null || customDate === undefined) {
      // Remove/clear the custom date
      updateData.customDate = admin.firestore.FieldValue.delete();
    } else {
      updateData.customDate = customDate;
    }

    await pageRef.update(updateData);

    return NextResponse.json({
      success: true,
      customDate: customDate || null,
    });

  } catch (error) {
    console.error('Error updating custom date:', error);
    return NextResponse.json(
      { error: 'Failed to update custom date' },
      { status: 500 }
    );
  }
}
