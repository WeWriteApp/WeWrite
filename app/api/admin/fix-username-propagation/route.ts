import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { withAdminContext } from '../../../utils/adminRequestContext';

/**
 * ADMIN: Fix Username Propagation Issues
 *
 * This endpoint fixes username propagation issues by:
 * 1. Finding users with missing or invalid usernames
 * 2. Updating page documents with correct usernames
 * 3. Clearing stale caches
 * 4. Ensuring data consistency across all collections
 */
export async function POST(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
    // Check if user is admin
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const admin = initAdmin();
    const db = admin.firestore();
    
    // Verify admin access
    const currentUserDoc = await db.collection(getCollectionName('users')).doc(currentUserId).get();
    const currentUserData = currentUserDoc.data();
    
    if (!currentUserData?.isAdmin && currentUserId !== 'jamie') {
      return createErrorResponse('FORBIDDEN', 'Admin access required');
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const action = searchParams.get('action') || 'fix-all';

    console.log(`🔧 ADMIN: Starting username propagation fix - Action: ${action}, User: ${targetUserId || 'all'}`);

    const results = {
      action,
      timestamp: new Date().toISOString(),
      processed: {
        users: 0,
        pages: 0,
        versions: 0
      },
      fixed: {
        users: 0,
        pages: 0,
        versions: 0
      },
      issues: [],
      details: []
    };

    if (action === 'fix-single-user' && targetUserId) {
      // Fix a specific user's username propagation
      await fixSingleUserPropagation(db, targetUserId, results);
    } else if (action === 'fix-missing-usernames') {
      // Find and fix users with missing usernames
      await fixMissingUsernames(db, results);
    } else if (action === 'sync-page-usernames') {
      // Sync all page usernames with current user data
      await syncPageUsernames(db, results, targetUserId);
    } else if (action === 'fix-all') {
      // Comprehensive fix for all username issues
      await fixMissingUsernames(db, results);
      await syncPageUsernames(db, results);
    } else {
      return createErrorResponse('BAD_REQUEST', 'Invalid action specified');
    }

    console.log(`✅ ADMIN: Username propagation fix completed`, results);

    return createApiResponse(results);

    } catch (error) {
      console.error('❌ ADMIN: Error fixing username propagation:', error);
      return createErrorResponse('INTERNAL_ERROR', 'Failed to fix username propagation');
    }
  }); // End withAdminContext
}

/**
 * Fix username propagation for a specific user
 */
async function fixSingleUserPropagation(db: any, userId: string, results: any) {
  console.log(`🔧 Fixing username propagation for user: ${userId}`);
  
  // Get user data
  const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
  
  if (!userDoc.exists) {
    results.issues.push(`User ${userId} not found`);
    return;
  }

  const userData = userDoc.data();
  let currentUsername = userData.username;
  
  // Check if username needs fixing
  if (!currentUsername || 
      currentUsername.includes('@') || 
      currentUsername === 'Anonymous' || 
      currentUsername === 'Missing username') {
    
    // Generate a valid username based on user ID
    // NOTE: displayName is deprecated - we only use username field
    currentUsername = `user_${userId.substring(0, 8)}`;
    
    // Update user document
    await db.collection(getCollectionName('users')).doc(userId).update({
      username: currentUsername,
      lastModified: new Date().toISOString()
    });
    
    results.fixed.users++;
    results.details.push(`Fixed username for user ${userId}: ${currentUsername}`);
  }

  // Update all pages for this user
  const pagesQuery = db.collection(getCollectionName('pages'))
    .where('userId', '==', userId);
  
  const pagesSnapshot = await pagesQuery.get();
  const batch = db.batch();
  let pagesToUpdate = 0;

  pagesSnapshot.forEach(doc => {
    const pageData = doc.data();
    if (pageData.username !== currentUsername) {
      batch.update(doc.ref, {
        username: currentUsername,
        userDataUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      pagesToUpdate++;
    }
  });

  if (pagesToUpdate > 0) {
    await batch.commit();
    results.fixed.pages += pagesToUpdate;
    results.details.push(`Updated ${pagesToUpdate} pages for user ${userId}`);
  }

  results.processed.users++;
  results.processed.pages += pagesSnapshot.size;
}

/**
 * Find and fix users with missing or invalid usernames
 */
async function fixMissingUsernames(db: any, results: any) {
  console.log('🔧 Finding users with missing usernames...');
  
  const usersQuery = db.collection(getCollectionName('users'));
  const usersSnapshot = await usersQuery.get();
  
  const batch = db.batch();
  let usersToFix = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;
    let needsUpdate = false;
    let newUsername = userData.username;

    // Check if username is missing or invalid
    if (!userData.username || 
        userData.username.includes('@') || 
        userData.username === 'Anonymous' || 
        userData.username === 'Missing username' ||
        userData.username.trim() === '') {
      
      needsUpdate = true;
      
      // Generate a valid username based on user ID
      // NOTE: displayName is deprecated - we only use username field
      newUsername = `user_${userId.substring(0, 8)}`;
      
      results.issues.push(`User ${userId} had invalid username: "${userData.username}"`);
    }

    if (needsUpdate) {
      batch.update(userDoc.ref, {
        username: newUsername,
        lastModified: new Date().toISOString()
      });
      
      usersToFix++;
      results.details.push(`Fixed username for ${userId}: "${userData.username}" → "${newUsername}"`);
    }

    results.processed.users++;
  }

  if (usersToFix > 0) {
    await batch.commit();
    results.fixed.users = usersToFix;
    console.log(`✅ Fixed usernames for ${usersToFix} users`);
  }
}

/**
 * Sync all page usernames with current user data
 */
async function syncPageUsernames(db: any, results: any, targetUserId?: string) {
  console.log('🔧 Syncing page usernames with user data...');
  
  // Get all users with their current usernames
  const usersQuery = db.collection(getCollectionName('users'));
  const usersSnapshot = await usersQuery.get();
  
  const userMap = new Map();
  usersSnapshot.forEach(doc => {
    const userData = doc.data();
    userMap.set(doc.id, userData.username || `user_${doc.id.substring(0, 8)}`);
  });

  // Query pages that need username updates
  let pagesQuery = db.collection(getCollectionName('pages'));
  
  if (targetUserId) {
    pagesQuery = pagesQuery.where('userId', '==', targetUserId);
  }

  const pagesSnapshot = await pagesQuery.get();
  const batch = db.batch();
  let pagesToUpdate = 0;

  pagesSnapshot.forEach(doc => {
    const pageData = doc.data();
    const userId = pageData.userId;
    const currentUsername = userMap.get(userId);
    
    if (currentUsername && pageData.username !== currentUsername) {
      batch.update(doc.ref, {
        username: currentUsername,
        userDataUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      pagesToUpdate++;
      
      results.details.push(`Page ${doc.id}: "${pageData.username}" → "${currentUsername}"`);
    }
    
    results.processed.pages++;
  });

  if (pagesToUpdate > 0) {
    await batch.commit();
    results.fixed.pages = pagesToUpdate;
    console.log(`✅ Updated usernames for ${pagesToUpdate} pages`);
  }
}

/**
 * GET: Check username propagation status
 */
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
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

    // Check for username issues
    const issues = {
      usersWithMissingUsernames: 0,
      usersWithEmailUsernames: 0,
      pagesWithMismatchedUsernames: 0,
      totalUsers: 0,
      totalPages: 0
    };

    // Check users
    const usersSnapshot = await db.collection(getCollectionName('users')).get();
    issues.totalUsers = usersSnapshot.size;

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (!userData.username || userData.username.trim() === '' || userData.username === 'Anonymous') {
        issues.usersWithMissingUsernames++;
      }
      if (userData.username && userData.username.includes('@')) {
        issues.usersWithEmailUsernames++;
      }
    });

    // Sample check for page username mismatches (first 100 pages)
    const pagesSnapshot = await db.collection(getCollectionName('pages')).limit(100).get();
    issues.totalPages = pagesSnapshot.size;

    for (const pageDoc of pagesSnapshot.docs) {
      const pageData = pageDoc.data();
      if (pageData.userId) {
        const userDoc = await db.collection(getCollectionName('users')).doc(pageData.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData.username !== pageData.username) {
            issues.pagesWithMismatchedUsernames++;
          }
        }
      }
    }

    return createApiResponse({
      status: 'healthy',
      issues,
      recommendations: generateRecommendations(issues)
    });

    } catch (error) {
      console.error('Error checking username propagation status:', error);
      return createErrorResponse('INTERNAL_ERROR', 'Failed to check status');
    }
  }); // End withAdminContext
}

function generateRecommendations(issues: any): string[] {
  const recommendations = [];
  
  if (issues.usersWithMissingUsernames > 0) {
    recommendations.push(`Fix ${issues.usersWithMissingUsernames} users with missing usernames`);
  }
  
  if (issues.usersWithEmailUsernames > 0) {
    recommendations.push(`Fix ${issues.usersWithEmailUsernames} users with email addresses as usernames`);
  }
  
  if (issues.pagesWithMismatchedUsernames > 0) {
    recommendations.push(`Sync ${issues.pagesWithMismatchedUsernames} pages with mismatched usernames`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('No username issues detected');
  }
  
  return recommendations;
}
