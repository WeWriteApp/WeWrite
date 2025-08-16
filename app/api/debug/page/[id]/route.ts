import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

/**
 * Debug API for page loading issues
 * GET /api/debug/page/[id] - Get detailed debug information about a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;
    
    if (!pageId) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
    }

    console.log(`🔍 [DEBUG] Analyzing page: ${pageId}`);

    // Get authenticated user (optional for debugging)
    let currentUserId: string | null = null;
    try {
      currentUserId = await getUserIdFromRequest(request);
    } catch (error) {
      console.log('🔍 [DEBUG] Anonymous access');
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({
        error: 'Firebase Admin not available',
        pageId
      }, { status: 503 });
    }

    const db = admin.firestore();

    // Get page document
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json({
        error: 'Page not found',
        pageId,
        exists: false
      }, { status: 404 });
    }

    const pageData = pageDoc.data();

    // Get versions
    const versionsRef = pageRef.collection('versions');
    const versionsSnapshot = await versionsRef.orderBy('createdAt', 'desc').limit(5).get();
    
    const versions = versionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      contentLength: doc.data().content?.length || 0
    }));

    // Get user data if userId exists
    let userData = null;
    if (pageData?.userId) {
      try {
        const userRef = db.collection(getCollectionName('users')).doc(pageData.userId);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          userData = userDoc.data();
        }
      } catch (userError) {
        console.warn('Failed to fetch user data:', userError);
      }
    }

    const debugInfo = {
      pageId,
      exists: true,
      pageData: {
        id: pageData?.id,
        title: pageData?.title || 'MISSING_TITLE',
        userId: pageData?.userId || 'MISSING_USER_ID',
        username: pageData?.username || 'MISSING_USERNAME',
        hasContent: !!pageData?.content,
        contentType: typeof pageData?.content,
        contentLength: pageData?.content?.length || 0,
        currentVersion: pageData?.currentVersion || 'MISSING_CURRENT_VERSION',
        lastModified: pageData?.lastModified,
        createdAt: pageData?.createdAt,
        isPublic: pageData?.isPublic,
        deleted: pageData?.deleted
      },
      userData: userData ? {
        username: userData.username || 'MISSING_USERNAME',
        displayName: userData.displayName,
        email: userData.email
      } : 'USER_NOT_FOUND',
      versions: {
        count: versions.length,
        latest: versions[0] ? {
          id: versions[0].id,
          title: versions[0].title,
          username: versions[0].username,
          createdAt: versions[0].createdAt,
          hasContent: !!versions[0].content,
          contentLength: versions[0].contentLength
        } : 'NO_VERSIONS',
        all: versions
      },
      issues: []
    };

    // Identify potential issues
    if (!pageData?.title || pageData.title === 'Untitled') {
      debugInfo.issues.push('MISSING_OR_DEFAULT_TITLE');
    }
    
    if (!pageData?.username || pageData.username === 'Anonymous') {
      debugInfo.issues.push('MISSING_OR_DEFAULT_USERNAME');
    }
    
    if (!pageData?.content && versions.length === 0) {
      debugInfo.issues.push('NO_CONTENT_ANYWHERE');
    }
    
    if (!pageData?.currentVersion) {
      debugInfo.issues.push('MISSING_CURRENT_VERSION');
    }
    
    if (pageData?.currentVersion && !versions.find(v => v.id === pageData.currentVersion)) {
      debugInfo.issues.push('CURRENT_VERSION_NOT_FOUND');
    }

    return NextResponse.json(debugInfo);

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      error: 'Debug analysis failed',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
