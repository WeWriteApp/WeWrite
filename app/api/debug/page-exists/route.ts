import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Debug endpoint to check if a specific page exists
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Page Exists Debug] Starting page existence check...');
    
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({
        error: 'Admin access required',
        details: adminCheck.error
      }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('id');
    
    if (!pageId) {
      return NextResponse.json({
        error: 'Page ID is required',
        usage: 'Add ?id=PAGE_ID to check if a page exists'
      }, { status: 400 });
    }
    
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    
    const debugResults = {
      pageId,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        pagesCollection: getCollectionName('pages')
      },
      checks: []
    };
    
    // 1. Check if page exists in Firestore
    try {
      const pagesCollection = getCollectionName('pages');
      const pageDoc = await db.collection(pagesCollection).doc(pageId).get();
      
      if (pageDoc.exists) {
        const pageData = pageDoc.data();
        debugResults.checks.push({
          name: 'Firestore Pages Collection',
          exists: true,
          data: {
            id: pageDoc.id,
            title: pageData?.title,
            userId: pageData?.userId,
            deleted: pageData?.deleted,
            isPublic: pageData?.isPublic,
            createdAt: pageData?.createdAt,
            hasContent: !!pageData?.content
          },
          status: 'SUCCESS'
        });
      } else {
        debugResults.checks.push({
          name: 'Firestore Pages Collection',
          exists: false,
          status: 'NOT_FOUND'
        });
      }
    } catch (error) {
      debugResults.checks.push({
        name: 'Firestore Pages Collection',
        exists: false,
        error: error.message,
        status: 'ERROR'
      });
    }
    
    // 2. Check if it's a user ID
    try {
      const usersCollection = getCollectionName('users');
      const userDoc = await db.collection(usersCollection).doc(pageId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        debugResults.checks.push({
          name: 'Users Collection (checking if ID is a user)',
          exists: true,
          data: {
            id: userDoc.id,
            username: userData?.username,
            email: userData?.email ? '[REDACTED]' : null
          },
          status: 'SUCCESS - This is a user ID, not a page ID'
        });
      } else {
        debugResults.checks.push({
          name: 'Users Collection (checking if ID is a user)',
          exists: false,
          status: 'NOT_FOUND'
        });
      }
    } catch (error) {
      debugResults.checks.push({
        name: 'Users Collection (checking if ID is a user)',
        exists: false,
        error: error.message,
        status: 'ERROR'
      });
    }
    
    // 3. Try RTDB as fallback
    try {
      const rtdb = admin.database();
      const pageSnapshot = await rtdb.ref(`pages/${pageId}`).get();
      
      if (pageSnapshot.exists()) {
        const pageData = pageSnapshot.val();
        debugResults.checks.push({
          name: 'RTDB Pages',
          exists: true,
          data: {
            id: pageId,
            title: pageData?.title,
            userId: pageData?.userId,
            hasContent: !!pageData?.content
          },
          status: 'SUCCESS - Found in RTDB'
        });
      } else {
        debugResults.checks.push({
          name: 'RTDB Pages',
          exists: false,
          status: 'NOT_FOUND'
        });
      }
    } catch (error) {
      debugResults.checks.push({
        name: 'RTDB Pages',
        exists: false,
        error: error.message,
        status: 'ERROR'
      });
    }
    
    // 4. Check RTDB users
    try {
      const rtdb = admin.database();
      const userSnapshot = await rtdb.ref(`users/${pageId}`).get();
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        debugResults.checks.push({
          name: 'RTDB Users (checking if ID is a user)',
          exists: true,
          data: {
            id: pageId,
            username: userData?.username,
            email: userData?.email ? '[REDACTED]' : null
          },
          status: 'SUCCESS - This is a user ID in RTDB'
        });
      } else {
        debugResults.checks.push({
          name: 'RTDB Users (checking if ID is a user)',
          exists: false,
          status: 'NOT_FOUND'
        });
      }
    } catch (error) {
      debugResults.checks.push({
        name: 'RTDB Users (checking if ID is a user)',
        exists: false,
        error: error.message,
        status: 'ERROR'
      });
    }
    
    // Summary
    const pageExists = debugResults.checks.some(check => 
      check.name.includes('Pages') && check.exists
    );
    const isUser = debugResults.checks.some(check => 
      check.name.includes('Users') && check.exists
    );
    
    debugResults.summary = {
      pageExists,
      isUser,
      recommendation: pageExists ? 'Show page' : isUser ? 'Redirect to /user/' + pageId : 'Show 404'
    };
    
    return NextResponse.json(debugResults, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('[Page Exists Debug] Error:', error);
    
    return NextResponse.json({
      error: 'Page existence check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
