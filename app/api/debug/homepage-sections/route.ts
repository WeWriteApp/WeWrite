/**
 * Homepage Sections Debug Endpoint
 * 
 * Comprehensive debugging for all homepage sections
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
    const userId = request.nextUrl.searchParams.get('userId');

    console.log('🔍 [HOMEPAGE_DEBUG] Starting comprehensive homepage debug...');
    console.log('🔍 [HOMEPAGE_DEBUG] Environment:', envType);
    console.log('🔍 [HOMEPAGE_DEBUG] User ID:', userId);

    // 1. Check Recent Edits Data (Home API simulation)
    console.log('📝 [RECENT_EDITS_DEBUG] Checking recent edits data...');
    
    const recentPagesQuery = db.collection(getCollectionName('pages'))
      .orderBy('lastModified', 'desc')
      .limit(50);
    
    const recentPagesSnapshot = await recentPagesQuery.get();
    const recentPages = recentPagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter for user visibility
    const filteredRecentPages = recentPages
      .filter(page => page.deleted !== true)
      .filter(page => {
        if (!userId) return page.isPublic;
        return page.isPublic || page.userId === userId;
      });

    // Check for pages with diff data
    const pagesWithDiff = filteredRecentPages.filter(page => page.lastDiff && page.lastDiff.hasChanges);
    const pagesWithoutDiff = filteredRecentPages.filter(page => !page.lastDiff);
    const recentPagesWithoutDiff = pagesWithoutDiff.filter(page => {
      const lastModified = new Date(page.lastModified);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return lastModified > oneDayAgo;
    });

    console.log('📝 [RECENT_EDITS_DEBUG] Results:', {
      totalPages: recentPages.length,
      filteredPages: filteredRecentPages.length,
      pagesWithDiff: pagesWithDiff.length,
      pagesWithoutDiff: pagesWithoutDiff.length,
      recentPagesWithoutDiff: recentPagesWithoutDiff.length
    });

    // 2. Check Trending Pages Data
    console.log('🔥 [TRENDING_DEBUG] Checking trending pages data...');
    
    const trendingQuery = db.collection(getCollectionName('pages'))
      .orderBy('views', 'desc')
      .limit(20);
    
    const trendingSnapshot = await trendingQuery.get();
    const allTrendingPages = trendingSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const publicPages = allTrendingPages.filter(page => page.isPublic);
    const nonDeletedPublicPages = publicPages.filter(page => !page.deleted);
    const pagesWithTitle = nonDeletedPublicPages.filter(page => page.title);
    const isDevelopment = process.env.NODE_ENV === 'development';
    const minViews = isDevelopment ? 0 : 1;
    const pagesWithViews = pagesWithTitle.filter(page => (page.views || 0) >= minViews);

    console.log('🔥 [TRENDING_DEBUG] Results:', {
      totalPages: allTrendingPages.length,
      publicPages: publicPages.length,
      nonDeletedPublicPages: nonDeletedPublicPages.length,
      pagesWithTitle: pagesWithTitle.length,
      pagesWithViews: pagesWithViews.length,
      minViews,
      isDevelopment
    });

    // 3. Check Recently Viewed Data (same as recent edits but different perspective)
    console.log('🟠 [RECENTLY_VIEWED_DEBUG] Checking recently viewed data...');
    
    const recentlyViewedPages = filteredRecentPages.slice(0, 20);
    
    console.log('🟠 [RECENTLY_VIEWED_DEBUG] Results:', {
      availablePages: recentlyViewedPages.length,
      sampleTitles: recentlyViewedPages.slice(0, 5).map(p => p.title)
    });

    // 4. Check specific issues
    const issues = [];
    
    if (recentPages.length === 0) {
      issues.push('No pages exist in the database');
    }
    
    if (filteredRecentPages.length === 0) {
      issues.push('No pages visible to user (all private or deleted)');
    }
    
    if (pagesWithDiff.length === 0 && recentPagesWithoutDiff.length === 0) {
      issues.push('No recent activity (no diff data and no recent modifications)');
    }
    
    if (publicPages.length === 0) {
      issues.push('No public pages exist for trending');
    }
    
    if (pagesWithViews.length === 0) {
      issues.push('No pages have sufficient views for trending');
    }

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        type: envType,
        isDevelopment,
        collections: {
          pages: getCollectionName('pages'),
          users: getCollectionName('users')
        }
      },
      userId,
      recentEdits: {
        totalPages: recentPages.length,
        filteredPages: filteredRecentPages.length,
        pagesWithDiff: pagesWithDiff.length,
        recentPagesWithoutDiff: recentPagesWithoutDiff.length,
        finalCount: pagesWithDiff.length + recentPagesWithoutDiff.length,
        samplePages: [...pagesWithDiff, ...recentPagesWithoutDiff].slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          lastModified: p.lastModified,
          hasDiff: !!p.lastDiff,
          diffHasChanges: p.lastDiff?.hasChanges
        }))
      },
      trending: {
        totalPages: allTrendingPages.length,
        publicPages: publicPages.length,
        nonDeletedPublicPages: nonDeletedPublicPages.length,
        pagesWithTitle: pagesWithTitle.length,
        pagesWithViews: pagesWithViews.length,
        minViews,
        samplePages: pagesWithViews.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          views: p.views,
          isPublic: p.isPublic
        }))
      },
      recentlyViewed: {
        availablePages: recentlyViewedPages.length,
        samplePages: recentlyViewedPages.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          lastModified: p.lastModified,
          isPublic: p.isPublic
        }))
      },
      issues,
      recommendations: {
        recentEdits: pagesWithDiff.length === 0 && recentPagesWithoutDiff.length === 0 
          ? 'Edit some pages to generate recent activity' 
          : 'Recent edits should be working',
        trending: pagesWithViews.length === 0 
          ? 'Make some pages public and visit them to generate views' 
          : 'Trending should be working',
        recentlyViewed: recentlyViewedPages.length === 0 
          ? 'Visit some pages to generate recently viewed data' 
          : 'Recently viewed should be working'
      }
    };

    return NextResponse.json(debugInfo, { status: 200 });

  } catch (error) {
    console.error('Homepage sections debug error:', error);
    return NextResponse.json({
      error: 'Failed to debug homepage sections',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
