import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { db } from '../../../../firebase/config';
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { PayoutErrorCategory, PayoutErrorSeverity } from '../../../../services/payoutErrorLogger';

// Admin user check
async function isAdmin(userId: string): Promise<boolean> {
  // TODO: Implement proper admin check
  return true;
}

/**
 * GET /api/admin/payouts/errors
 * Get paginated list of payout error logs with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as PayoutErrorCategory | null;
    const severity = searchParams.get('severity') as PayoutErrorSeverity | null;
    const correlationId = searchParams.get('correlationId');
    const payoutId = searchParams.get('payoutId');
    const search = searchParams.get('search');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const lastErrorId = searchParams.get('lastErrorId');
    const timeRange = searchParams.get('timeRange') || '24h'; // 24h, 7d, 30d

    // Calculate time filter
    const now = new Date();
    let timeFilter: Date;
    switch (timeRange) {
      case '1h':
        timeFilter = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Build query
    let errorsQuery = collection(db, getCollectionName('payoutErrorLogs'));
    const constraints: any[] = [];

    // Time filter
    constraints.push(where('metadata.timestamp', '>=', Timestamp.fromDate(timeFilter)));

    // Category filter
    if (category) {
      constraints.push(where('category', '==', category));
    }

    // Severity filter
    if (severity) {
      constraints.push(where('severity', '==', severity));
    }

    // Correlation ID filter
    if (correlationId) {
      constraints.push(where('correlationId', '==', correlationId));
    }

    // Payout ID filter
    if (payoutId) {
      constraints.push(where('context.payoutId', '==', payoutId));
    }

    // Search filter (using searchableText field)
    if (search) {
      constraints.push(where('searchableText', '>=', search.toLowerCase()));
      constraints.push(where('searchableText', '<=', search.toLowerCase() + '\uf8ff'));
    }

    // Ordering and pagination
    constraints.push(orderBy('metadata.timestamp', 'desc'));
    constraints.push(limit(pageSize));

    if (lastErrorId) {
      const lastDoc = await getDoc(doc(db, getCollectionName('payoutErrorLogs'), lastErrorId));
      if (lastDoc.exists()) {
        constraints.push(startAfter(lastDoc));
      }
    }

    errorsQuery = query(errorsQuery, ...constraints);
    const errorsSnapshot = await getDocs(errorsQuery);

    const errors = errorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      metadata: {
        ...doc.data().metadata,
        timestamp: doc.data().metadata.timestamp?.toDate()?.toISOString()
      }
    }));

    // Get summary statistics
    const statsQuery = query(
      collection(db, getCollectionName('payoutErrorLogs')),
      where('metadata.timestamp', '>=', Timestamp.fromDate(timeFilter)),
      orderBy('metadata.timestamp', 'desc'),
      limit(1000)
    );
    const statsSnapshot = await getDocs(statsQuery);
    const allErrors = statsSnapshot.docs.map(doc => doc.data());

    const stats = {
      total: allErrors.length,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byResolutionStatus: {} as Record<string, number>
    };

    allErrors.forEach(error => {
      // Count by category
      const category = error.category || 'unknown';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // Count by severity
      const severity = error.severity || 'unknown';
      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;

      // Count by resolution status
      const status = error.resolution?.status || 'pending';
      stats.byResolutionStatus[status] = (stats.byResolutionStatus[status] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        errors,
        stats,
        filters: {
          category,
          severity,
          correlationId,
          payoutId,
          search,
          timeRange
        },
        pagination: {
          hasMore: errorsSnapshot.docs.length === pageSize,
          lastErrorId: errorsSnapshot.docs.length > 0 ? 
            errorsSnapshot.docs[errorsSnapshot.docs.length - 1].id : null
        }
      }
    });

  } catch (error: unknown) {
    console.error('Error getting error logs:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/admin/payouts/errors
 * Update error resolution status
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { errorId, resolution } = body;

    if (!errorId || !resolution) {
      return NextResponse.json({
        error: 'errorId and resolution are required'
      }, { status: 400 });
    }

    const { status, assignedTo, notes } = resolution;

    if (!['pending', 'investigating', 'resolved', 'ignored'].includes(status)) {
      return NextResponse.json({
        error: 'Invalid resolution status'
      }, { status: 400 });
    }

    // Update error resolution
    const updateData: any = {
      'resolution.status': status,
      'resolution.assignedTo': assignedTo || null,
      'resolution.notes': notes || null,
      updatedAt: new Date().toISOString()
    };

    if (status === 'resolved') {
      updateData['resolution.resolvedAt'] = new Date().toISOString();
    }

    await updateDoc(doc(db, getCollectionName('payoutErrorLogs'), errorId), updateData);

    return NextResponse.json({
      success: true,
      message: 'Error resolution updated'
    });

  } catch (error: unknown) {
    console.error('Error updating error resolution:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/payouts/errors
 * Bulk operations on error logs
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, errorIds, resolution } = body;

    if (!action || !errorIds || !Array.isArray(errorIds)) {
      return NextResponse.json({
        error: 'action and errorIds array are required'
      }, { status: 400 });
    }

    const results: any[] = [];

    switch (action) {
      case 'bulk_resolve':
        for (const errorId of errorIds) {
          try {
            await updateDoc(doc(db, getCollectionName('payoutErrorLogs'), errorId), {
              'resolution.status': 'resolved',
              'resolution.resolvedAt': new Date().toISOString(),
              'resolution.notes': resolution?.notes || 'Bulk resolved',
              updatedAt: new Date().toISOString()
            });
            results.push({ errorId, success: true });
          } catch (error: unknown) {
            results.push({ errorId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }
        break;

      case 'bulk_ignore':
        for (const errorId of errorIds) {
          try {
            await updateDoc(doc(db, getCollectionName('payoutErrorLogs'), errorId), {
              'resolution.status': 'ignored',
              'resolution.notes': resolution?.notes || 'Bulk ignored',
              updatedAt: new Date().toISOString()
            });
            results.push({ errorId, success: true });
          } catch (error: unknown) {
            results.push({ errorId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }
        break;

      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: bulk_resolve, bulk_ignore'
        }, { status: 400 });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      message: `Bulk operation completed: ${successCount} successful, ${failureCount} failed`,
      data: {
        results,
        summary: { successCount, failureCount, total: errorIds.length }
      }
    });

  } catch (error: unknown) {
    console.error('Error processing bulk error operation:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
