/**
 * Database Statistics API
 * Provides simplified database statistics for admin users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../../auth-helper';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

interface DatabaseStats {
  totalUsers: number;
  totalPages: number;
  totalPublicPages: number;
  totalDeletedPages: number;
  recentActivity: number;
  lastUpdated: string;
}

// GET endpoint - Get database statistics
export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return createErrorResponse(adminCheck.error === 'Unauthorized - no user ID' ? 'UNAUTHORIZED' : 'FORBIDDEN');
    }

    const admin = getFirebaseAdmin();
    const db = admin!.firestore();

    console.log('Fetching database statistics...');

    // Get basic counts in parallel for better performance
    const [usersSnapshot, pagesSnapshot] = await Promise.all([
      db.collection(getCollectionName('users')).count().get(),
      db.collection(getCollectionName('pages')).count().get()
    ]);

    const totalUsers = usersSnapshot.data().count;
    const totalPages = pagesSnapshot.data().count;

    // Get more detailed page statistics
    const [publicPagesSnapshot, deletedPagesSnapshot] = await Promise.all([
      db.collection(getCollectionName('pages')).where('isPublic', '==', true).count().get(),
      db.collection(getCollectionName('pages')).where('deleted', '==', true).count().get()
    ]);

    const totalPublicPages = publicPagesSnapshot.data().count;
    const totalDeletedPages = deletedPagesSnapshot.data().count;

    // Get recent activity (pages modified in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivitySnapshot = await db.collection(getCollectionName('pages'))
      .where('lastModified', '>=', sevenDaysAgo.toISOString())
      .count()
      .get();

    const recentActivity = recentActivitySnapshot.data().count;

    const stats: DatabaseStats = {
      totalUsers,
      totalPages,
      totalPublicPages,
      totalDeletedPages,
      recentActivity,
      lastUpdated: new Date().toISOString()
    };

    console.log('Database statistics:', stats);

    return createApiResponse({
      stats,
      message: 'Database statistics retrieved successfully'
    }, null, 200);

  } catch (error) {
    console.error('Error fetching database statistics:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch database statistics');
  }
}

// POST endpoint - Refresh/recalculate statistics
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return createErrorResponse(adminCheck.error === 'Unauthorized - no user ID' ? 'UNAUTHORIZED' : 'FORBIDDEN');
    }

    const admin = getFirebaseAdmin();
    const db = admin!.firestore();

    console.log('Recalculating database statistics...');

    // Force recalculation by calling GET endpoint logic
    const getResponse = await GET(request);
    const getResult = await getResponse.json();

    if (!getResult.success) {
      throw new Error(getResult.error || 'Failed to recalculate statistics');
    }

    // Store the statistics for future reference
    await db.collection('admin_stats').doc('database').set({
      ...getResult.data.stats,
      calculatedBy: adminCheck.userEmail,
      calculatedAt: admin!.firestore.FieldValue.serverTimestamp()
    });

    return createApiResponse({
      stats: getResult.data.stats,
      message: 'Database statistics recalculated and stored successfully'
    }, null, 200);

  } catch (error) {
    console.error('Error recalculating database statistics:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to recalculate database statistics');
  }
}
