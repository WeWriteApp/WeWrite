import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getQuotaStatus, RESEND_LIMITS, DAILY_QUOTAS, EmailPriority } from '@/services/emailRateLimitService';
import { withAdminContext } from '@/utils/adminRequestContext';
import { getFirebaseAdmin } from '@/firebase/firebaseAdmin';
import { getCollectionName, getEnvironmentType } from '@/utils/environmentConfig';

/**
 * Email Quota Status API for Admin
 *
 * GET /api/admin/email-quota - Get current email quota usage and scheduled batches
 *
 * Returns:
 *   - today: Daily usage stats (sent, remaining, by priority)
 *   - thisMonth: Monthly usage stats
 *   - limits: Resend free tier limits (100/day, 3000/month)
 *   - quotas: Per-priority daily allocation
 *   - scheduledBatches: Emails scheduled for future delivery
 */
export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      // Verify admin access using session cookie
      const adminCheck = await checkAdminPermissions(request);
      if (!adminCheck.success) {
        return NextResponse.json(
          { success: false, error: adminCheck.error || 'Admin access required' },
          { status: 403 }
        );
      }

      // Get environment info for better error messages
      const envType = getEnvironmentType();
      const isDevData = envType === 'development';

      // Get quota status from rate limit service
      // In dev mode with dev data, the collection may not exist - handle gracefully
      let quotaStatus;
      try {
        quotaStatus = await getQuotaStatus();
      } catch (quotaError) {
        console.warn('[Email Quota API] Error getting quota status (may be empty in dev):', quotaError);
        // Return default/empty quota status for dev mode
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.slice(0, 7);
        quotaStatus = {
          today: {
            date: today,
            p0Sent: 0,
            p1Sent: 0,
            p2Sent: 0,
            p3Sent: 0,
            totalSent: 0,
            lastUpdatedAt: new Date(),
            remaining: RESEND_LIMITS.DAILY,
            percentUsed: 0,
          },
          thisMonth: {
            month: thisMonth,
            totalSent: 0,
            byDay: {},
            lastUpdatedAt: new Date(),
            remaining: RESEND_LIMITS.MONTHLY,
            percentUsed: 0,
          },
          limits: RESEND_LIMITS,
          quotas: DAILY_QUOTAS,
          isDevData, // Flag to indicate this is dev/empty data
        };
      }

      // Get scheduled emails from Firestore (emails with scheduledAt in the future)
      const admin = getFirebaseAdmin();
      const scheduledBatches: Array<{
        scheduledFor: string;
        count: number;
        templateBreakdown: Record<string, number>;
      }> = [];

      if (admin) {
        try {
          const db = admin.firestore();

          // Query email logs that are scheduled for the future
          const scheduledSnapshot = await db.collection(getCollectionName('emailLogs'))
            .where('status', '==', 'scheduled')
            .orderBy('metadata.scheduledAt', 'asc')
            .limit(500)
            .get();

          // Group by scheduled date
          const batchMap = new Map<string, { count: number; templateBreakdown: Record<string, number> }>();

          for (const doc of scheduledSnapshot.docs) {
            const data = doc.data();
            const scheduledAt = data.metadata?.scheduledAt;

            if (!scheduledAt) continue;

            // Group by date (YYYY-MM-DD)
            const scheduledDate = new Date(scheduledAt).toISOString().split('T')[0];

            if (!batchMap.has(scheduledDate)) {
              batchMap.set(scheduledDate, { count: 0, templateBreakdown: {} });
            }

            const batch = batchMap.get(scheduledDate)!;
            batch.count++;

            const templateId = data.templateId || 'unknown';
            batch.templateBreakdown[templateId] = (batch.templateBreakdown[templateId] || 0) + 1;
          }

          // Convert map to sorted array
          for (const [scheduledFor, data] of batchMap) {
            scheduledBatches.push({
              scheduledFor,
              ...data,
            });
          }

          // Sort by date
          scheduledBatches.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
        } catch (scheduledError) {
          // Collection may not exist in dev, or missing index - just log and continue with empty batches
          console.warn('[Email Quota API] Error getting scheduled emails (may be empty in dev):', scheduledError);
        }
      }

      // Calculate projected usage for next 7 days
      const projectedDays: Array<{
        date: string;
        projected: number;
        isOverLimit: boolean;
      }> = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const batch = scheduledBatches.find(b => b.scheduledFor === dateStr);
        const projected = batch?.count || 0;

        projectedDays.push({
          date: dateStr,
          projected,
          isOverLimit: projected > RESEND_LIMITS.DAILY,
        });
      }

      return NextResponse.json({
        success: true,
        ...quotaStatus,
        scheduledBatches,
        projectedDays,
        priorityLabels: {
          [EmailPriority.P0_CRITICAL]: 'Critical (password reset, verification)',
          [EmailPriority.P1_TIME_SENSITIVE]: 'Time-Sensitive (welcome, notifications)',
          [EmailPriority.P2_ENGAGEMENT]: 'Engagement (reminders, digests)',
          [EmailPriority.P3_WINBACK]: 'Win-back (reactivation)',
        },
      });
    } catch (error) {
      console.error('[Email Quota API] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get email quota status',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}
