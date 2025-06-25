/**
 * Subscription Monitoring API
 * 
 * This endpoint provides monitoring capabilities to detect and alert on
 * multiple subscription scenarios for proactive management.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initAdmin } from '../../../firebase/admin';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../../api/auth-helper';

// Initialize Firebase Admin and Stripe
const adminApp = initAdmin();
const adminDb = adminApp.firestore();
const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia',
});

interface CustomerIssue {
  customerId: string;
  userId?: string;
  email?: string;
  issueType: 'multiple_active' | 'multiple_total' | 'orphaned_subscription';
  subscriptionCount: number;
  activeSubscriptionCount: number;
  subscriptions: {
    id: string;
    status: string;
    created: string;
    amount: number;
  }[];
}

interface MonitoringReport {
  timestamp: string;
  totalCustomersScanned: number;
  customersWithIssues: number;
  issueBreakdown: {
    multipleActive: number;
    multipleTotal: number;
    orphanedSubscriptions: number;
  };
  issues: CustomerIssue[];
  recommendations: string[];
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user and verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    
    if (!userData?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    const maxCustomers = parseInt(url.searchParams.get('maxCustomers') || '100');
    const includeMinorIssues = url.searchParams.get('includeMinorIssues') === 'true';

    console.log(`[SUBSCRIPTION MONITOR] Starting monitoring scan - MaxCustomers: ${maxCustomers}`);

    const report = await generateMonitoringReport(maxCustomers, includeMinorIssues);

    return NextResponse.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('[SUBSCRIPTION MONITOR] Error:', error);
    return NextResponse.json(
      { 
        error: 'Monitoring failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

async function generateMonitoringReport(maxCustomers: number, includeMinorIssues: boolean): Promise<MonitoringReport> {
  const report: MonitoringReport = {
    timestamp: new Date().toISOString(),
    totalCustomersScanned: 0,
    customersWithIssues: 0,
    issueBreakdown: {
      multipleActive: 0,
      multipleTotal: 0,
      orphanedSubscriptions: 0
    },
    issues: [],
    recommendations: []
  };

  let hasMore = true;
  let startingAfter: string | undefined;
  let scannedCount = 0;

  while (hasMore && scannedCount < maxCustomers) {
    const customers = await stripe.customers.list({
      limit: Math.min(100, maxCustomers - scannedCount),
      starting_after: startingAfter,
    });

    for (const customer of customers.data) {
      scannedCount++;
      
      const issue = await analyzeCustomerSubscriptions(customer);
      if (issue && (includeMinorIssues || isSignificantIssue(issue))) {
        report.issues.push(issue);
        report.customersWithIssues++;
        
        // Update breakdown counters
        switch (issue.issueType) {
          case 'multiple_active':
            report.issueBreakdown.multipleActive++;
            break;
          case 'multiple_total':
            report.issueBreakdown.multipleTotal++;
            break;
          case 'orphaned_subscription':
            report.issueBreakdown.orphanedSubscriptions++;
            break;
        }
      }
    }

    hasMore = customers.has_more && scannedCount < maxCustomers;
    if (customers.data.length > 0) {
      startingAfter = customers.data[customers.data.length - 1].id;
    }
  }

  report.totalCustomersScanned = scannedCount;
  report.recommendations = generateRecommendations(report);

  return report;
}

async function analyzeCustomerSubscriptions(customer: Stripe.Customer): Promise<CustomerIssue | null> {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 100,
    });

    const activeSubscriptions = subscriptions.data.filter(sub => sub.status === 'active');
    
    // Check for Firebase user association
    let userId: string | undefined;
    try {
      const usersSnapshot = await adminDb.collection('users')
        .where('stripeCustomerId', '==', customer.id)
        .limit(1)
        .get();
      
      if (!usersSnapshot.empty) {
        userId = usersSnapshot.docs[0].id;
      }
    } catch (error) {
      console.warn(`[MONITOR] Could not check Firebase user for customer ${customer.id}:`, error);
    }

    // Determine issue type
    let issueType: CustomerIssue['issueType'] | null = null;
    
    if (activeSubscriptions.length > 1) {
      issueType = 'multiple_active';
    } else if (subscriptions.data.length > 3) { // More than 3 total subscriptions might indicate cleanup needed
      issueType = 'multiple_total';
    } else if (subscriptions.data.length > 0 && !userId) {
      issueType = 'orphaned_subscription';
    }

    if (!issueType) {
      return null; // No issues found
    }

    return {
      customerId: customer.id,
      userId,
      email: customer.email || undefined,
      issueType,
      subscriptionCount: subscriptions.data.length,
      activeSubscriptionCount: activeSubscriptions.length,
      subscriptions: subscriptions.data.map(sub => ({
        id: sub.id,
        status: sub.status,
        created: new Date(sub.created * 1000).toISOString(),
        amount: sub.items.data[0]?.price?.unit_amount || 0
      }))
    };

  } catch (error) {
    console.error(`[MONITOR] Error analyzing customer ${customer.id}:`, error);
    return null;
  }
}

function isSignificantIssue(issue: CustomerIssue): boolean {
  // Define what constitutes a "significant" issue that requires immediate attention
  switch (issue.issueType) {
    case 'multiple_active':
      return true; // Always significant
    case 'multiple_total':
      return issue.subscriptionCount > 5; // Only if more than 5 total subscriptions
    case 'orphaned_subscription':
      return issue.activeSubscriptionCount > 0; // Only if there are active orphaned subscriptions
    default:
      return false;
  }
}

function generateRecommendations(report: MonitoringReport): string[] {
  const recommendations: string[] = [];

  if (report.issueBreakdown.multipleActive > 0) {
    recommendations.push(
      `🚨 URGENT: ${report.issueBreakdown.multipleActive} customers have multiple active subscriptions. Run cleanup immediately to prevent billing issues.`
    );
  }

  if (report.issueBreakdown.multipleTotal > 10) {
    recommendations.push(
      `🧹 CLEANUP: ${report.issueBreakdown.multipleTotal} customers have excessive historical subscriptions. Consider running cleanup to improve portal experience.`
    );
  }

  if (report.issueBreakdown.orphanedSubscriptions > 0) {
    recommendations.push(
      `🔗 ORPHANED: ${report.issueBreakdown.orphanedSubscriptions} subscriptions are not linked to Firebase users. Investigate data integrity.`
    );
  }

  if (report.customersWithIssues === 0) {
    recommendations.push('✅ No significant subscription issues detected. System is healthy.');
  }

  // Add general recommendations
  if (report.customersWithIssues > 0) {
    recommendations.push(
      '💡 Run the subscription cleanup utility: `node scripts/subscription-cleanup.js --dry-run` to see what would be cleaned up.'
    );
    recommendations.push(
      '📊 Schedule regular monitoring to catch issues early: consider running this check weekly.'
    );
  }

  return recommendations;
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to run monitoring.' },
    { status: 405 }
  );
}
