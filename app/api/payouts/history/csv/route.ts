import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getCollectionName, COLLECTIONS, USD_COLLECTIONS } from '../../../../utils/environmentConfig';

// Initialize Firebase Admin lazily
let admin: ReturnType<typeof getFirebaseAdmin> | null = null;

function initializeFirebase() {
  if (admin) return { admin };

  try {
    admin = getFirebaseAdmin();
    if (!admin) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { admin: null };
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin in payouts/history/csv:', error);
    return { admin: null };
  }

  return { admin };
}

// Helper function to escape CSV values
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If the value contains comma, quote, or newline, wrap it in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

// Helper function to format currency for CSV
function formatCurrencyForCsv(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

// Helper to convert Firestore timestamp to date string
function formatTimestamp(ts: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('en-US');
}

// GET /api/payouts/history/csv - Download payout history as CSV
export async function GET(request: NextRequest) {
  try {
    const { admin } = initializeFirebase();
    if (!admin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = admin.firestore();

    // --- Fetch real payouts from usdPayouts collection ---
    let payoutsQuery: FirebaseFirestore.Query = db
      .collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
      .where('userId', '==', userId)
      .orderBy('requestedAt', 'desc');

    if (status && status !== 'all') {
      payoutsQuery = payoutsQuery.where('status', '==', status);
    }

    const payoutsSnapshot = await payoutsQuery.get();

    let payoutRows = payoutsSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        requestedAt: d.requestedAt,
        completedAt: d.completedAt,
        amountCents: d.amountCents || 0,
        status: d.status || 'pending',
        stripePayoutId: d.stripePayoutId || '',
        failureReason: d.failureReason || '',
      };
    });

    // Apply date range filtering in memory (avoids composite index requirement)
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      payoutRows = payoutRows.filter(row => {
        const date = row.requestedAt?.toDate ? row.requestedAt.toDate() : null;
        if (!date) return true;
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      });
    }

    // --- Fetch earnings records from writerUsdEarnings collection ---
    const earningsSnapshot = await db
      .collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    let earningsRows = earningsSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        month: d.month || '',
        amountCents: d.totalUsdCentsReceived || 0,
        status: d.status || 'pending',
        createdAt: d.createdAt,
      };
    });

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      earningsRows = earningsRows.filter(row => {
        const date = row.createdAt?.toDate ? row.createdAt.toDate() : null;
        if (!date) return true;
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      });
    }

    // --- Build CSV ---
    const csvLines: string[] = [];

    // Section 1: Payouts
    csvLines.push('--- PAYOUTS ---');
    csvLines.push([
      'Payout ID',
      'Date Requested',
      'Date Completed',
      'Amount (USD)',
      'Status',
      'Stripe Transfer ID',
      'Failure Reason',
    ].join(','));

    for (const row of payoutRows) {
      csvLines.push([
        escapeCsvValue(row.id),
        escapeCsvValue(formatTimestamp(row.requestedAt)),
        escapeCsvValue(formatTimestamp(row.completedAt)),
        escapeCsvValue(formatCurrencyForCsv(row.amountCents)),
        escapeCsvValue(row.status),
        escapeCsvValue(row.stripePayoutId),
        escapeCsvValue(row.failureReason),
      ].join(','));
    }

    // Blank separator
    csvLines.push('');

    // Section 2: Earnings
    csvLines.push('--- EARNINGS ---');
    csvLines.push([
      'Earnings ID',
      'Month',
      'Date Created',
      'Amount (USD)',
      'Status',
    ].join(','));

    for (const row of earningsRows) {
      csvLines.push([
        escapeCsvValue(row.id),
        escapeCsvValue(row.month),
        escapeCsvValue(formatTimestamp(row.createdAt)),
        escapeCsvValue(formatCurrencyForCsv(row.amountCents)),
        escapeCsvValue(row.status),
      ].join(','));
    }

    const csvContent = csvLines.join('\n');

    // Add BOM for proper UTF-8 encoding in Excel
    const csvWithBom = '\uFEFF' + csvContent;

    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payouts-history-${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Error generating CSV:', error);

    return NextResponse.json({
      error: 'Failed to generate CSV'
    }, { status: 500 });
  }
}
