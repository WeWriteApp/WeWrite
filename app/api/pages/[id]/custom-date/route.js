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

    // Create a version record for this custom date change
    const now = new Date().toISOString();

    try {
      // Get current user data for version record
      const userRef = db.collection(getCollectionName('users')).doc(userId);
      const userDoc = await userRef.get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const username = userData?.username || 'Anonymous';

      // Create version data for custom date change
      const versionData = {
        content: pageData.content || '', // Keep existing content
        title: pageData.title || 'Untitled',
        createdAt: now,
        userId: userId,
        username: username,
        previousVersionId: pageData.currentVersion || null,
        groupId: pageData.groupId || null,

        // Special metadata for custom date changes
        changeType: 'customDate',
        customDateChange: {
          from: pageData.customDate || null,
          to: customDate
        },

        // No content diff for custom date changes
        diff: {
          added: 0,
          removed: 0,
          hasChanges: true // Always true for custom date changes
        }
      };

      // Create the version document
      const versionRef = await pageRef.collection('versions').add(versionData);
      console.log(`API: Created version record for custom date change: ${versionRef.id}`);

      // Update the page with new custom date and version info
      const updateData = {
        customDate: customDate || null, // Allow clearing the custom date
        lastModified: now,
        currentVersion: versionRef.id,
        // Add lastDiff for recent edits display
        lastDiff: {
          added: 0,
          removed: 0,
          hasChanges: true,
          preview: customDate ? `Set date to ${customDate}` : 'Removed custom date'
        }
      };

      await pageRef.update(updateData);
      console.log(`API: Successfully updated custom date and created version for page ${id}`);

    } catch (versionError) {
      console.error('API: Error creating version record for custom date (non-fatal):', versionError);

      // Fallback: just update the custom date without version record
      const updateData = {
        customDate: customDate || null,
        lastModified: now
      };
      await pageRef.update(updateData);
      console.log(`API: Updated custom date without version record (fallback) for page ${id}`);
    }

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
