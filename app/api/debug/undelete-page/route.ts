import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { requireDevelopmentEnvironment } from '../debugHelper';

export async function POST(request: NextRequest) {
  // SECURITY: Only allow in local development
  const devCheck = requireDevelopmentEnvironment();
  if (devCheck) return devCheck;

  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const db = admin.firestore();
    const { pageId } = await request.json();

    if (!pageId) {
      return NextResponse.json({ error: 'Page ID required' }, { status: 400 });
    }

    console.log(`[DEBUG] Attempting to undelete page: ${pageId}`);

    // Get the page document
    const pageRef = db.collection('pages').doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json({ error: 'Page not found in database' }, { status: 404 });
    }

    const pageData = pageDoc.data();
    console.log(`[DEBUG] Current page data:`, {
      id: pageId,
      title: pageData?.title,
      deleted: pageData?.deleted,
      currentVersion: pageData?.currentVersion,
      userId: pageData?.userId
    });

    // Update the page to undelete it and fix currentVersion if missing
    const updates: any = {
      deleted: false,
      lastModified: new Date().toISOString()
    };

    // If currentVersion is missing, try to find the latest version
    if (!pageData?.currentVersion || pageData.currentVersion === 'MISSING_CURRENT_VERSION') {
      console.log(`[DEBUG] Fixing missing currentVersion for page ${pageId}`);
      
      // Query for versions of this page
      const versionsQuery = db.collection('pages').doc(pageId).collection('versions')
        .orderBy('createdAt', 'desc')
        .limit(1);
      
      const versionsSnapshot = await versionsQuery.get();
      
      if (!versionsSnapshot.empty) {
        const latestVersion = versionsSnapshot.docs[0];
        updates.currentVersion = latestVersion.id;
        console.log(`[DEBUG] Set currentVersion to: ${latestVersion.id}`);
      }
    }

    // Remove deletedAt timestamp
    if (pageData?.deletedAt) {
      updates.deletedAt = null;
    }

    await pageRef.update(updates);

    console.log(`[DEBUG] Successfully undeleted page ${pageId}`);

    return NextResponse.json({
      success: true,
      pageId,
      message: 'Page undeleted successfully',
      updates
    });

  } catch (error) {
    console.error('[DEBUG] Error undeleting page:', error);
    return NextResponse.json({
      error: 'Failed to undelete page',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
