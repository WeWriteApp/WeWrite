import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Debug API to create a test page with recent timestamp to verify recent edits system
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testUserId = searchParams.get('userId') || 'test-user-recent-edits';
    const testUsername = searchParams.get('username') || 'TestUser';

    // Initialize Firebase Admin
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    console.log('🔍 CREATE TEST PAGE: Starting test page creation');
    console.log('🔍 Collection name:', getCollectionName('pages'));
    console.log('🔍 Test user ID:', testUserId);

    const now = new Date().toISOString();
    
    // Create test page data
    const testPageData = {
      title: `Test Recent Edit - ${new Date().toLocaleString()}`,
      content: JSON.stringify([
        {
          type: "paragraph",
          children: [
            { text: `This is a test page created at ${new Date().toLocaleString()} to verify the recent edits system is working correctly.` }
          ]
        }
      ]),
      userId: testUserId,
      username: testUsername,
      displayName: testUsername,
      isPublic: true,
      createdAt: now,
      lastModified: now,
      deleted: false,
      // Add lastDiff to ensure it shows up in recent edits
      lastDiff: {
        added: 50,
        removed: 0,
        hasChanges: true,
        preview: "This is a test page created to verify recent edits..."
      }
    };

    console.log('🔍 Creating test page with data:', {
      title: testPageData.title,
      userId: testPageData.userId,
      lastModified: testPageData.lastModified,
      hasLastDiff: !!testPageData.lastDiff
    });

    // Create the page
    const pageRef = await db.collection(getCollectionName('pages')).add(testPageData);
    console.log('✅ Created test page with ID:', pageRef.id);

    // Also create a version for the page
    const versionData = {
      content: testPageData.content,
      createdAt: now,
      userId: testUserId,
      username: testUsername,
      previousVersionId: null
    };

    const versionRef = await pageRef.collection('versions').add(versionData);
    console.log('✅ Created version with ID:', versionRef.id);

    // Update page with current version
    await pageRef.update({
      currentVersion: versionRef.id
    });

    console.log('✅ Updated page with current version');

    // Test the recent edits API to see if our page shows up
    let recentEditsTest = null;
    try {
      const recentEditsUrl = new URL('/api/recent-edits/global', request.url);
      recentEditsUrl.searchParams.set('limit', '10');
      
      const response = await fetch(recentEditsUrl.toString());
      if (response.ok) {
        recentEditsTest = await response.json();
      }
    } catch (apiError) {
      console.error('Error testing recent edits API:', apiError);
    }

    return NextResponse.json({
      success: true,
      message: 'Test page created successfully',
      testPage: {
        id: pageRef.id,
        title: testPageData.title,
        lastModified: testPageData.lastModified,
        userId: testPageData.userId
      },
      versionId: versionRef.id,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      collection: getCollectionName('pages'),
      recentEditsTest: recentEditsTest
    });

  } catch (error) {
    console.error('Error creating test page:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create test page',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check recent pages in database
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    console.log('🔍 CHECK RECENT PAGES: Starting database check');
    console.log('🔍 Collection name:', getCollectionName('pages'));

    // Get recent pages ordered by lastModified
    const pagesQuery = db.collection(getCollectionName('pages'))
      .orderBy('lastModified', 'desc')
      .limit(10);

    const snapshot = await pagesQuery.get();
    const pages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        userId: data.userId,
        username: data.username,
        lastModified: data.lastModified,
        deleted: data.deleted,
        isPublic: data.isPublic,
        hasLastDiff: !!data.lastDiff,
        lastDiffHasChanges: data.lastDiff?.hasChanges
      };
    });

    console.log(`🔍 Found ${pages.length} pages in database`);

    // Calculate days since modification for each page
    const pagesWithTiming = pages.map(page => {
      if (!page.lastModified) return { ...page, daysSinceModified: null };
      
      const lastModifiedDate = page.lastModified.toDate ? page.lastModified.toDate() : new Date(page.lastModified);
      const daysSinceModified = (new Date().getTime() - lastModifiedDate.getTime()) / (24 * 60 * 60 * 1000);
      
      return {
        ...page,
        lastModifiedFormatted: lastModifiedDate.toISOString(),
        daysSinceModified: daysSinceModified.toFixed(2)
      };
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      collection: getCollectionName('pages'),
      totalPages: pages.length,
      pages: pagesWithTiming
    });

  } catch (error) {
    console.error('Error checking recent pages:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check recent pages',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
