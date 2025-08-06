import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../../auth-helper';
import { getCollectionName, COLLECTIONS } from '../../../../utils/environmentConfig';

// Initialize Firebase Admin lazily
let admin;

function initializeFirebase() {
  if (admin) return { admin }; // Already initialized

  try {
    admin = getFirebaseAdmin();
    if (!admin) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { admin: null };
    }
    console.log('Firebase Admin initialized successfully in payouts/history/csv');
  } catch (error) {
    console.error('Error initializing Firebase Admin in payouts/history/csv:', error);
    return { admin: null };
  }

  return { admin };
}

// Initialize Stripe
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

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
function formatCurrencyForCsv(amount: number, currency: string = 'usd'): string {
  return (amount / 100).toFixed(2); // Convert from cents to dollars
}

// GET /api/payouts/history/csv - Download payout history as CSV
export async function GET(request: NextRequest) {
  try {
    const { admin } = initializeFirebase();
    if (!admin) {
      console.warn('Firebase Admin not available for payouts/history/csv');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log(`Generating CSV for user: ${userId}`);

    // Get user data to find their connected account ID
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName(COLLECTIONS.USERS)).doc(userId).get();
    const userData = userDoc.data();

    const stripeConnectedAccountId = userData?.stripeConnectedAccountId;

    // Create same sample payout data for CSV export
    const samplePayouts = [
      {
        id: 'payout_sample_1',
        amount: 2500, // $25.00 in cents
        currency: 'usd',
        status: 'completed',
        createdAt: new Date('2025-06-15').toISOString(),
        completedAt: new Date('2025-06-17').toISOString(),
        estimatedArrival: null,
        bankAccount: {
          bankName: 'Chase Bank',
          last4: '1234',
          accountType: 'checking'
        },
        stripePayoutId: 'po_sample_1',
        failureReason: null,
        description: 'Monthly payout for June 2025',
        period: '2025-06'
      },
      {
        id: 'payout_sample_2',
        amount: 1750, // $17.50 in cents
        currency: 'usd',
        status: 'processing',
        createdAt: new Date('2025-07-01').toISOString(),
        completedAt: null,
        estimatedArrival: new Date('2025-07-03').toISOString(),
        bankAccount: {
          bankName: 'Chase Bank',
          last4: '1234',
          accountType: 'checking'
        },
        stripePayoutId: 'po_sample_2',
        failureReason: null,
        description: 'Monthly payout for July 2025',
        period: '2025-07'
      },
      {
        id: 'payout_sample_3',
        amount: 3200, // $32.00 in cents
        currency: 'usd',
        status: 'failed',
        createdAt: new Date('2025-05-15').toISOString(),
        completedAt: null,
        estimatedArrival: null,
        bankAccount: {
          bankName: 'Wells Fargo',
          last4: '5678',
          accountType: 'savings'
        },
        stripePayoutId: 'po_sample_3',
        failureReason: 'Bank account closed or invalid',
        description: 'Monthly payout for May 2025',
        period: '2025-05'
      },
      {
        id: 'payout_sample_4',
        amount: 1850, // $18.50 in cents
        currency: 'usd',
        status: 'failed',
        createdAt: new Date('2025-04-20').toISOString(),
        completedAt: null,
        estimatedArrival: null,
        bankAccount: {
          bankName: 'Bank of America',
          last4: '9012',
          accountType: 'checking'
        },
        stripePayoutId: 'po_sample_4',
        failureReason: 'Invalid routing number',
        description: 'Monthly payout for April 2025',
        period: '2025-04'
      }
    ];

    // Apply filters to sample data
    let filteredSamplePayouts = samplePayouts;

    // Apply status filter if provided
    if (status && status !== 'all') {
      filteredSamplePayouts = filteredSamplePayouts.filter(payout => payout.status === status);
    }

    // Apply date filters if provided
    if (startDate || endDate) {
      filteredSamplePayouts = filteredSamplePayouts.filter(payout => {
        const payoutDate = new Date(payout.createdAt);
        if (startDate && payoutDate < new Date(startDate)) return false;
        if (endDate && payoutDate > new Date(endDate)) return false;
        return true;
      });
    }

    const payouts = filteredSamplePayouts;

    // TODO: Replace with actual database query when index is created
    /*
    for (const doc of payoutsSnapshot.docs) {
      // ... actual database processing code ...
    }
    */

    // Generate CSV content
    const csvHeaders = [
      'Payout ID',
      'Date Created',
      'Date Completed',
      'Amount (USD)',
      'Currency',
      'Status',
      'Bank Name',
      'Account Type',
      'Account Last 4',
      'Period',
      'Description',
      'Estimated Arrival',
      'Stripe Payout ID',
      'Failure Reason'
    ];

    const csvRows = payouts.map(payout => [
      escapeCsvValue(payout.id),
      escapeCsvValue(payout.createdAt ? new Date(payout.createdAt).toLocaleDateString() : ''),
      escapeCsvValue(payout.completedAt ? new Date(payout.completedAt).toLocaleDateString() : ''),
      escapeCsvValue(formatCurrencyForCsv(payout.amount, payout.currency)),
      escapeCsvValue(payout.currency.toUpperCase()),
      escapeCsvValue(payout.status),
      escapeCsvValue(payout.bankAccount?.bankName || ''),
      escapeCsvValue(payout.bankAccount?.accountType || ''),
      escapeCsvValue(payout.bankAccount?.last4 || ''),
      escapeCsvValue(payout.period || ''),
      escapeCsvValue(payout.description || ''),
      escapeCsvValue(payout.estimatedArrival ? new Date(payout.estimatedArrival).toLocaleDateString() : ''),
      escapeCsvValue(payout.stripePayoutId || ''),
      escapeCsvValue(payout.failureReason || '')
    ]);

    // Combine headers and rows
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Add BOM for proper UTF-8 encoding in Excel
    const csvWithBom = '\uFEFF' + csvContent;

    // Return CSV response
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
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({
        error: `Stripe error: ${error.message}`,
        code: error.code
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to generate CSV'
    }, { status: 500 });
  }
}
