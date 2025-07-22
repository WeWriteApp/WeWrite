import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * Analytics Aggregations API Route
 * 
 * GET: Get hourly or daily analytics aggregations
 * POST: Create/update analytics aggregations
 * 
 * This route replaces direct Firebase calls for analytics aggregation operations
 * and ensures environment-aware collection naming.
 */

interface HourlyAggregation {
  datetime: string;
  pagesCreated: number;
  pagesDeleted: number;
  publicPagesCreated: number;
  privatePagesCreated: number;
  netChange: number;
  lastUpdated: any;
}

interface DailyAggregation {
  date: string;
  pagesCreated: number;
  pagesDeleted: number;
  publicPagesCreated: number;
  privatePagesCreated: number;
  netChange: number;
  lastUpdated: any;
}

// GET /api/analytics/aggregations?type=hourly|daily&limit=24&startDate=2024-01-01
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'daily';
    const limitParam = searchParams.get('limit');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const limit = limitParam ? parseInt(limitParam, 10) : (type === 'hourly' ? 24 : 30);

    if (limit > 100) {
      return createErrorResponse('Limit cannot exceed 100', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    let collectionName: string;
    let orderField: string;

    if (type === 'hourly') {
      collectionName = getCollectionName('analytics_hourly');
      orderField = 'datetime';
    } else if (type === 'daily') {
      collectionName = getCollectionName('analytics_daily');
      orderField = 'date';
    } else {
      return createErrorResponse('Invalid type. Use "hourly" or "daily"', 'BAD_REQUEST');
    }

    let query = db.collection(collectionName).orderBy(orderField, 'desc');

    // Add date filtering if provided
    if (startDate) {
      query = query.where(orderField, '>=', startDate);
    }
    if (endDate) {
      query = query.where(orderField, '<=', endDate);
    }

    query = query.limit(limit);

    const snapshot = await query.get();

    if (snapshot.empty) {
      return createApiResponse({
        aggregations: [],
        count: 0,
        type,
        note: `No ${type} aggregations found`
      });
    }

    const aggregations = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        lastUpdated: data.lastUpdated?.toDate?.() || data.lastUpdated
      };
    });

    return createApiResponse({
      aggregations,
      count: aggregations.length,
      type
    });

  } catch (error) {
    console.error('Error fetching analytics aggregations:', error);
    return createErrorResponse('Failed to fetch analytics aggregations', 'INTERNAL_ERROR');
  }
}

// POST /api/analytics/aggregations
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { type, data, date } = body;

    if (!type || !data || !date) {
      return createErrorResponse('Type, data, and date are required', 'BAD_REQUEST');
    }

    if (type !== 'hourly' && type !== 'daily') {
      return createErrorResponse('Invalid type. Use "hourly" or "daily"', 'BAD_REQUEST');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    let collectionName: string;
    let docId: string;

    if (type === 'hourly') {
      collectionName = getCollectionName('analytics_hourly');
      docId = date; // Should be in format: 2024-01-01T14:00:00Z
    } else {
      collectionName = getCollectionName('analytics_daily');
      docId = date; // Should be in format: 2024-01-01
    }

    const aggregationData = {
      [type === 'hourly' ? 'datetime' : 'date']: date,
      pagesCreated: data.pagesCreated || 0,
      pagesDeleted: data.pagesDeleted || 0,
      publicPagesCreated: data.publicPagesCreated || 0,
      privatePagesCreated: data.privatePagesCreated || 0,
      netChange: (data.pagesCreated || 0) - (data.pagesDeleted || 0),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      ...data // Include any additional fields
    };

    await db.collection(collectionName).doc(docId).set(aggregationData, { merge: true });

    return createApiResponse({
      success: true,
      message: `${type} aggregation updated successfully`,
      type,
      date,
      docId
    });

  } catch (error) {
    console.error('Error updating analytics aggregation:', error);
    return createErrorResponse('Failed to update analytics aggregation', 'INTERNAL_ERROR');
  }
}
