import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';

export async function GET(request, { params }) {
  try {
    // Await params for Next.js 15 compatibility
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }

    // Get limit from query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    console.log(`API: Fetching versions for page ID: ${id}, limit: ${limit}`);

    // Get the current user ID for access control
    const userId = await getUserIdFromRequest(request);

    // Import Firebase Admin modules (server-side)
    const { getFirebaseAdmin } = await import('../../../../firebase/firebaseAdmin');
    const { getCollectionName } = await import('../../../../utils/environmentConfig');

    // Get Firebase Admin instance
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get the page document first to check access
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
      // Only allow owners to access versions of deleted pages
      if (!userId || pageData.userId !== userId) {
        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        );
      }
    }

    // Check access permissions for non-public pages
    if (!pageData.isPublic && (!userId || pageData.userId !== userId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get versions from the subcollection with limit
    const versionsRef = pageRef.collection('versions');
    const versionsSnapshot = await versionsRef.orderBy('createdAt', 'desc').limit(limit).get();

    const versions = [];
    versionsSnapshot.forEach(doc => {
      const versionData = doc.data();
      
      // Convert Firestore timestamps to ISO strings for JSON serialization
      const version = {
        id: doc.id,
        content: versionData.content || '',
        createdAt: versionData.createdAt || new Date().toISOString(),
        userId: versionData.userId || 'anonymous',
        username: versionData.username || 'Anonymous',
        groupId: versionData.groupId || null,
        previousVersionId: versionData.previousVersionId || null,
        isNoOp: versionData.isNoOp || false
      };

      // Convert Firestore timestamp to ISO string if needed
      if (versionData.createdAt && typeof versionData.createdAt.toDate === 'function') {
        version.createdAt = versionData.createdAt.toDate().toISOString();
      } else if (versionData.createdAt && typeof versionData.createdAt === 'string') {
        version.createdAt = versionData.createdAt;
      }

      versions.push(version);
    });

    console.log(`API: Found ${versions.length} versions for page ${id}`);

    return NextResponse.json({
      success: true,
      versions: versions,
      pageId: id,
      pageTitle: pageData.title || 'Untitled'
    });

  } catch (error) {
    console.error('Error fetching page versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page versions' },
      { status: 500 }
    );
  }
}
