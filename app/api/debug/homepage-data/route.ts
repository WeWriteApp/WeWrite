/**
 * Homepage Data Debug Endpoint
 * 
 * Shows what data is available for homepage sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getEnvironmentType, getCollectionName } from '../../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({
        error: 'Firebase Admin not initialized',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const db = admin.firestore();
    const envType = getEnvironmentType();

    console.log('🏠 [DEBUG] Checking homepage data availability...');

    // Check pages collection
    const pagesSnapshot = await db.collection(getCollectionName('pages'))
      .orderBy('lastModified', 'desc')
      .limit(10)
      .get();

    const pages = pagesSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      isPublic: doc.data().isPublic,
      deleted: doc.data().deleted,
      views: doc.data().views || 0,
      userId: doc.data().userId,
      lastModified: doc.data().lastModified,
      createdAt: doc.data().createdAt
    }));

    // Check public pages specifically
    const publicPagesSnapshot = await db.collection(getCollectionName('pages'))
      .where('isPublic', '==', true)
      .orderBy('lastModified', 'desc')
      .limit(5)
      .get();

    const publicPages = publicPagesSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      views: doc.data().views || 0,
      deleted: doc.data().deleted
    }));

    // Check pages with views
    const pagesWithViewsSnapshot = await db.collection(getCollectionName('pages'))
      .where('views', '>', 0)
      .limit(5)
      .get();

    const pagesWithViews = pagesWithViewsSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      views: doc.data().views,
      isPublic: doc.data().isPublic
    }));

    // Check pageViews collection for trending data
    let pageViewsData = [];
    try {
      const pageViewsSnapshot = await db.collection(getCollectionName('pageViews'))
        .limit(5)
        .get();
      
      pageViewsData = pageViewsSnapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
    } catch (error) {
      console.warn('Could not fetch pageViews:', error.message);
    }

    // Check users collection
    const usersSnapshot = await db.collection(getCollectionName('users'))
      .limit(3)
      .get();

    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      username: doc.data().username,
      email: doc.data().email
    }));

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        type: envType,
        collections: {
          pages: getCollectionName('pages'),
          pageViews: getCollectionName('pageViews'),
          users: getCollectionName('users')
        }
      },
      data: {
        totalPages: pagesSnapshot.size,
        publicPages: publicPagesSnapshot.size,
        pagesWithViews: pagesWithViewsSnapshot.size,
        pageViewsEntries: pageViewsData.length,
        users: usersSnapshot.size
      },
      samples: {
        recentPages: pages,
        publicPages: publicPages,
        pagesWithViews: pagesWithViews,
        pageViewsData: pageViewsData.slice(0, 2),
        users: users
      },
      issues: {
        noPublicPages: publicPagesSnapshot.size === 0,
        noPagesWithViews: pagesWithViewsSnapshot.size === 0,
        noPageViewsData: pageViewsData.length === 0,
        allPagesDeleted: pages.every(page => page.deleted === true)
      },
      recommendations: {
        forTrending: 'Create public pages with views > 0',
        forRecentlyViewed: 'Visit some pages to generate recent activity',
        forRecentEdits: 'Edit some pages to generate edit activity',
        general: 'Development environment may need test data'
      }
    };

    return NextResponse.json(debugInfo, { status: 200 });

  } catch (error) {
    console.error('Homepage data debug error:', error);
    return NextResponse.json({
      error: 'Failed to check homepage data',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
