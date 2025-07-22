import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Analytics Counters API Route
 * 
 * GET: Get global analytics counters
 * POST: Update global analytics counters
 * 
 * This route replaces direct Firebase calls for analytics counter operations
 * and ensures environment-aware collection naming.
 */

interface GlobalCounters {
  totalPagesEverCreated: number;
  totalActivePages: number;
  totalDeletedPages: number;
  totalPublicPages: number;
  totalPrivatePages: number;
  lastUpdated: any;
}

// GET /api/analytics/counters
export async function GET(request: NextRequest) {
  try {
    const admin = initAdmin();
    const db = admin.firestore();

    const counterDoc = await db.collection(getCollectionName('analytics_counters')).doc('global').get();

    if (counterDoc.exists()) {
      const data = counterDoc.data() as GlobalCounters;
      return createApiResponse({
        counters: data,
        lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated
      });
    }

    // Return default counters if none exist
    const defaultCounters: GlobalCounters = {
      totalPagesEverCreated: 0,
      totalActivePages: 0,
      totalDeletedPages: 0,
      totalPublicPages: 0,
      totalPrivatePages: 0,
      lastUpdated: new Date()
    };

    return createApiResponse({
      counters: defaultCounters,
      lastUpdated: defaultCounters.lastUpdated,
      note: 'Default counters returned - no data found'
    });

  } catch (error) {
    console.error('Error fetching analytics counters:', error);
    return createErrorResponse('Failed to fetch analytics counters', 'INTERNAL_ERROR');
  }
}

// POST /api/analytics/counters
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { counters, operation = 'set' } = body;

    if (!counters || typeof counters !== 'object') {
      return createErrorResponse('Counters object is required', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    const counterRef = db.collection(getCollectionName('analytics_counters')).doc('global');

    if (operation === 'increment') {
      // Increment existing counters
      const updateData: any = {
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      Object.entries(counters).forEach(([key, value]) => {
        if (typeof value === 'number') {
          updateData[key] = admin.firestore.FieldValue.increment(value);
        }
      });

      await counterRef.update(updateData);

    } else {
      // Set counters directly
      const updateData = {
        ...counters,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      await counterRef.set(updateData, { merge: true });
    }

    return createApiResponse({
      success: true,
      message: `Analytics counters ${operation}ed successfully`,
      operation
    });

  } catch (error) {
    console.error('Error updating analytics counters:', error);
    return createErrorResponse('Failed to update analytics counters', 'INTERNAL_ERROR');
  }
}
