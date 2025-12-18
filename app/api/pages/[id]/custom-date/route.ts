import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface PageData {
  content?: string;
  title?: string;
  userId?: string;
  deleted?: boolean;
  customDate?: string | null;
  currentVersion?: string | null;
  groupId?: string | null;
}

interface UserData {
  username?: string;
}

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

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!id) {
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

    const { getFirebaseAdmin } = await import('../../../../firebase/firebaseAdmin');
    const { getCollectionName } = await import('../../../../utils/environmentConfig');

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const db = admin.firestore();
    const pageRef = db.collection(getCollectionName('pages')).doc(id);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data() as PageData;

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

    try {
      const userRef = db.collection(getCollectionName('users')).doc(userId);
      const userDoc = await userRef.get();
      const userData = userDoc.exists ? userDoc.data() as UserData : null;
      const username = userData?.username || 'Anonymous';

      const versionData = {
        content: pageData.content || '',
        title: pageData.title || 'Untitled',
        createdAt: now,
        userId: userId,
        username: username,
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

      const updateData = {
        customDate: customDate || null,
        lastModified: now,
        currentVersion: versionRef.id,
        lastDiff: {
          added: 0,
          removed: 0,
          hasChanges: true,
          preview: customDate ? `Set date to ${customDate}` : 'Removed custom date'
        }
      };

      await pageRef.update(updateData);

    } catch (versionError) {
      console.error('Error creating version record for custom date (non-fatal):', versionError);

      const updateData = {
        customDate: customDate || null,
        lastModified: now
      };
      await pageRef.update(updateData);
    }

    try {
      const { invalidateCache } = await import('../../../../utils/serverCache');
      invalidateCache.user(userId);
    } catch (cacheError) {
      console.error('Error triggering cache invalidation (non-fatal):', cacheError);
    }

    return NextResponse.json({
      success: true,
      customDate: customDate,
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

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    const { getFirebaseAdmin } = await import('../../../../firebase/firebaseAdmin');
    const { getCollectionName } = await import('../../../../utils/environmentConfig');

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const db = admin.firestore();
    const pageRef = db.collection(getCollectionName('pages')).doc(id);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data() as PageData;

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
