import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { invalidateCache } from '../../../../utils/serverCache';

function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return !isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

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

    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { customDate } = await request.json();

    if (customDate && !isValidDate(customDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD format.' },
        { status: 400 }
      );
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data()!;

    if (pageData.deleted === true) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    if (pageData.userId !== userId) {
      return NextResponse.json(
        { error: 'You can only update the custom date of your own pages' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    // Create version record for the date change
    try {
      const userRef = db.collection(getCollectionName('users')).doc(userId);
      const userDoc = await userRef.get();
      const userData = userDoc.exists ? userDoc.data() : null;
      const username = userData?.username || 'Anonymous';

      const versionData = {
        content: pageData.content || '',
        title: pageData.title || 'Untitled',
        createdAt: now,
        userId,
        username,
        previousVersionId: pageData.currentVersion || null,
        groupId: pageData.groupId || null,
        changeType: 'customDate',
        customDateChange: {
          from: pageData.customDate || null,
          to: customDate
        },
        diff: {
          added: 0,
          removed: 0,
          hasChanges: true
        }
      };

      const versionRef = await pageRef.collection('versions').add(versionData);

      await pageRef.update({
        customDate: customDate || null,
        lastModified: now,
        currentVersion: versionRef.id,
        lastDiff: {
          added: 0,
          removed: 0,
          hasChanges: true,
          preview: customDate ? `Set date to ${customDate}` : 'Removed custom date'
        }
      });
    } catch (versionError) {
      console.error('Error creating version record for custom date (non-fatal):', versionError);
      // Fallback: update without version record
      await pageRef.update({
        customDate: customDate || null,
        lastModified: now
      });
    }

    // Invalidate cache
    try {
      invalidateCache.user(userId);
    } catch (cacheError) {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      customDate: customDate || null,
      message: customDate ? 'Custom date updated successfully' : 'Custom date cleared successfully'
    });

  } catch (error) {
    const err = error as Error;
    console.error('Error updating custom date:', err);
    return NextResponse.json(
      { error: err.message || 'An error occurred while updating the custom date' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pages/[id]/custom-date
 * Get the custom date of a specific page
 */
export async function GET(
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

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data()!;

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
    const err = error as Error;
    console.error('Error getting custom date:', err);
    return NextResponse.json(
      { error: err.message || 'An error occurred while getting the custom date' },
      { status: 500 }
    );
  }
}
