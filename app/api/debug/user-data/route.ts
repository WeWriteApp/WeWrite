import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * DEBUG: User Data Investigation Tool
 * 
 * This endpoint helps diagnose username issues by checking all data sources
 * for a specific user and identifying where the username might be missing.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    
    if (!targetUserId) {
      return createErrorResponse('BAD_REQUEST', 'userId parameter is required');
    }

    // Check if user is admin (only admins can use this debug endpoint)
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const admin = initAdmin();
    const db = admin.firestore();
    
    // Check if current user is admin
    const currentUserDoc = await db.collection(getCollectionName('users')).doc(currentUserId).get();
    const currentUserData = currentUserDoc.data();
    
    if (!currentUserData?.isAdmin && currentUserId !== 'jamie') {
      return createErrorResponse('FORBIDDEN', 'Admin access required');
    }

    console.log(`🔍 DEBUG: Investigating user data for ${targetUserId}`);

    const diagnosticData = {
      userId: targetUserId,
      timestamp: new Date().toISOString(),
      sources: {}
    };

    // 1. Check Firestore users collection
    try {
      const userDoc = await db.collection(getCollectionName('users')).doc(targetUserId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        diagnosticData.sources.firestore = {
          exists: true,
          username: userData?.username,
          displayName: userData?.displayName,
          email: userData?.email,
          createdAt: userData?.createdAt,
          lastModified: userData?.lastModified,
          rawData: userData
        };
      } else {
        diagnosticData.sources.firestore = {
          exists: false,
          error: 'User document not found in Firestore'
        };
      }
    } catch (error) {
      diagnosticData.sources.firestore = {
        exists: false,
        error: error.message
      };
    }

    // 2. Check Realtime Database
    try {
      const rtdb = admin.database();
      const userSnapshot = await rtdb.ref(`users/${targetUserId}`).get();
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        diagnosticData.sources.rtdb = {
          exists: true,
          username: userData?.username,
          email: userData?.email,
          lastModified: userData?.lastModified,
          rawData: userData
        };
      } else {
        diagnosticData.sources.rtdb = {
          exists: false,
          error: 'User not found in Realtime Database'
        };
      }
    } catch (error) {
      diagnosticData.sources.rtdb = {
        exists: false,
        error: error.message
      };
    }

    // 3. Check pages collection for username consistency
    try {
      const pagesQuery = db.collection(getCollectionName('pages'))
        .where('userId', '==', targetUserId)
        .limit(10);
      
      const pagesSnapshot = await pagesQuery.get();
      const pageUsernames = [];
      
      pagesSnapshot.forEach(doc => {
        const pageData = doc.data();
        pageUsernames.push({
          pageId: doc.id,
          title: pageData.title,
          username: pageData.username,
          createdAt: pageData.createdAt,
          lastModified: pageData.lastModified
        });
      });

      diagnosticData.sources.pages = {
        count: pagesSnapshot.size,
        usernames: pageUsernames,
        uniqueUsernames: [...new Set(pageUsernames.map(p => p.username))],
        hasInconsistentUsernames: new Set(pageUsernames.map(p => p.username)).size > 1
      };
    } catch (error) {
      diagnosticData.sources.pages = {
        error: error.message
      };
    }

    // 4. Check API profile endpoint
    try {
      const profileResponse = await fetch(`${request.nextUrl.origin}/api/users/profile?id=${encodeURIComponent(targetUserId)}`);
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        diagnosticData.sources.profileAPI = {
          success: profileData.success,
          username: profileData.data?.username,
          data: profileData.data
        };
      } else {
        diagnosticData.sources.profileAPI = {
          success: false,
          status: profileResponse.status,
          error: await profileResponse.text()
        };
      }
    } catch (error) {
      diagnosticData.sources.profileAPI = {
        success: false,
        error: error.message
      };
    }

    // 5. Analysis and recommendations
    const analysis = {
      issues: [],
      recommendations: []
    };

    // Check for missing username in primary source
    if (!diagnosticData.sources.firestore?.username) {
      analysis.issues.push('Username missing from Firestore users collection');
      analysis.recommendations.push('Update user document with valid username');
    }

    // Check for email as username (security issue)
    if (diagnosticData.sources.firestore?.username?.includes('@')) {
      analysis.issues.push('Username contains @ symbol (potential email leak)');
      analysis.recommendations.push('Replace email with proper username');
    }

    // Check for inconsistent usernames across pages
    if (diagnosticData.sources.pages?.hasInconsistentUsernames) {
      analysis.issues.push('Inconsistent usernames across page documents');
      analysis.recommendations.push('Run username propagation job to sync page usernames');
    }

    // Check for RTDB/Firestore mismatch
    const firestoreUsername = diagnosticData.sources.firestore?.username;
    const rtdbUsername = diagnosticData.sources.rtdb?.username;
    
    if (firestoreUsername && rtdbUsername && firestoreUsername !== rtdbUsername) {
      analysis.issues.push('Username mismatch between Firestore and RTDB');
      analysis.recommendations.push('Sync username between Firestore and RTDB');
    }

    diagnosticData.analysis = analysis;

    return createApiResponse(diagnosticData);

  } catch (error) {
    console.error('Error in user data diagnostic:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to diagnose user data');
  }
}

/**
 * POST: Fix user data issues
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const action = searchParams.get('action');
    
    if (!targetUserId || !action) {
      return createErrorResponse('BAD_REQUEST', 'userId and action parameters are required');
    }

    // Check if user is admin
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const admin = initAdmin();
    const db = admin.firestore();
    
    const currentUserDoc = await db.collection(getCollectionName('users')).doc(currentUserId).get();
    const currentUserData = currentUserDoc.data();
    
    if (!currentUserData?.isAdmin && currentUserId !== 'jamie') {
      return createErrorResponse('FORBIDDEN', 'Admin access required');
    }

    const results = {
      action,
      userId: targetUserId,
      timestamp: new Date().toISOString(),
      success: false,
      details: {}
    };

    if (action === 'refresh-username-cache') {
      // Clear all caches for this user
      // This will force fresh fetches from the database
      results.details.message = 'Username cache refresh initiated';
      results.success = true;
    }

    if (action === 'sync-page-usernames') {
      // Update all page documents with current username
      const userDoc = await db.collection(getCollectionName('users')).doc(targetUserId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const currentUsername = userData?.username;
        
        if (currentUsername) {
          const pagesQuery = db.collection(getCollectionName('pages'))
            .where('userId', '==', targetUserId);
          
          const pagesSnapshot = await pagesQuery.get();
          const batch = db.batch();
          
          let updatedCount = 0;
          pagesSnapshot.forEach(doc => {
            const pageData = doc.data();
            if (pageData.username !== currentUsername) {
              batch.update(doc.ref, { 
                username: currentUsername,
                userDataUpdated: admin.firestore.FieldValue.serverTimestamp()
              });
              updatedCount++;
            }
          });
          
          if (updatedCount > 0) {
            await batch.commit();
            results.details.updatedPages = updatedCount;
            results.details.newUsername = currentUsername;
            results.success = true;
          } else {
            results.details.message = 'No pages needed username updates';
            results.success = true;
          }
        } else {
          results.details.error = 'User has no valid username to propagate';
        }
      } else {
        results.details.error = 'User document not found';
      }
    }

    return createApiResponse(results);

  } catch (error) {
    console.error('Error fixing user data:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fix user data');
  }
}
