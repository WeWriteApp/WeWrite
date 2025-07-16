import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';

/**
 * Update custom date for a page
 * PATCH /api/pages/[id]/custom-date
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Get the current user ID for authorization
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const { customDate } = await request.json();

    // Validate custom date format (YYYY-MM-DD)
    if (customDate && !/^\d{4}-\d{2}-\d{2}$/.test(customDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD format.' },
        { status: 400 }
      );
    }

    // Validate that the date is a valid date
    if (customDate) {
      try {
        const [year, month, day] = customDate.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        if (isNaN(date.getTime()) || 
            date.getFullYear() !== year || 
            date.getMonth() !== month - 1 || 
            date.getDate() !== day) {
          return NextResponse.json(
            { error: 'Invalid date value' },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid date value' },
          { status: 400 }
        );
      }
    }

    console.log(`API: Updating custom date for page ${id} to ${customDate}`);

    // Import Firebase Admin modules (server-side)
    const { getFirebaseAdmin } = await import('../../../../firebase/firebaseAdmin');
    const { getCollectionName } = await import('../../../../utils/environmentConfig');

    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get the page document to check ownership
    const pageRef = db.collection(getCollectionName('pages')).doc(id);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data();

    // Check if page is deleted
    if (pageData.deleted === true) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    // Check if user owns the page
    if (pageData.userId !== userId) {
      return NextResponse.json(
        { error: 'You can only update the custom date of your own pages' },
        { status: 403 }
      );
    }

    // Update the page with new custom date
    const updateData = {
      customDate: customDate || null, // Allow clearing the custom date
      lastModified: new Date().toISOString()
    };

    await pageRef.update(updateData);

    console.log(`API: Successfully updated custom date for page ${id}`);

    // Trigger cache invalidation to refresh daily notes and other components
    try {
      const { invalidateUserPagesCache } = await import('../../../../utils/cacheInvalidation');
      invalidateUserPagesCache(userId);
      console.log('✅ Cache invalidation triggered after custom date update for user:', userId);
    } catch (cacheError) {
      console.error('Error triggering cache invalidation (non-fatal):', cacheError);
    }

    return NextResponse.json({
      success: true,
      customDate: customDate,
      message: customDate ? 'Custom date updated successfully' : 'Custom date cleared successfully'
    });

  } catch (error) {
    console.error('Error updating custom date:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while updating the custom date' },
      { status: 500 }
    );
  }
}

/**
 * Get custom date for a page
 * GET /api/pages/[id]/custom-date
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    console.log(`API: Getting custom date for page ${id}`);

    // Import Firebase Admin modules (server-side)
    const { getFirebaseAdmin } = await import('../../../../firebase/firebaseAdmin');
    const { getCollectionName } = await import('../../../../utils/environmentConfig');

    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get the page document
    const pageRef = db.collection(getCollectionName('pages')).doc(id);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data();

    // Check if page is deleted
    if (pageData.deleted === true) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      customDate: pageData.customDate || null
    });

  } catch (error) {
    console.error('Error getting custom date:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while getting the custom date' },
      { status: 500 }
    );
  }
}
