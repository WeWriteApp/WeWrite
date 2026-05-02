import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../../utils/environmentConfig';
import { withAdminContext } from '../../../../utils/adminRequestContext';

type WriterSummary = {
  userId: string;
  username: string;
  totalEarnedCents: number;
  unfundedAllocationsCents: number;
  availableCents: number;
  paidOutCents: number;
  lastMonth: string;
  allocationRawCents: number;
  allocationFundedCents: number;
  allocationEntries: number;
  recordsMissingAllocationDetails: number;
};

export async function GET(request: NextRequest) {
  return withAdminContext(request, async () => {
    try {
      const adminCheck = await checkAdminPermissions(request);
      if (!adminCheck.success) {
        return NextResponse.json({ error: adminCheck.error || 'Unauthorized' }, { status: 401 });
      }

      const admin = getFirebaseAdmin();
      const db = admin.firestore();
      const { searchParams } = new URL(request.url);
      const limit = Math.max(1, Math.min(Number(searchParams.get('limit') || '100'), 500));

      const earningsCollection = getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS);
      const payoutsCollection = getCollectionName(USD_COLLECTIONS.USD_PAYOUTS);
      const usersCollection = getCollectionName('users');

      const [earningsSnapshot, payoutsSnapshot] = await Promise.all([
        db.collection(earningsCollection).get(),
        db.collection(payoutsCollection).orderBy('requestedAt', 'desc').limit(limit).get(),
      ]);

      const earningsStatusCounts = {
        pending: 0,
        available: 0,
        paid_out: 0,
      };

      const earningsStatusAmountsCents = {
        pending: 0,
        available: 0,
        paid_out: 0,
      };

      const writerMap = new Map<string, WriterSummary>();
      const userIds = new Set<string>();
      let earningsWithAllocationDetails = 0;
      let earningsMissingAllocationDetails = 0;
      let allocationRawCentsTotal = 0;
      let allocationFundedCentsTotal = 0;
      const toSafeCents = (value: unknown) => {
        const cents = Number(value);
        return Number.isFinite(cents) ? cents : 0;
      };

      earningsSnapshot.docs.forEach((doc) => {
        const earnings = doc.data();
        const userId = earnings.userId;
        if (!userId) return;

        userIds.add(userId);
        const status = (earnings.status || 'pending') as 'pending' | 'available' | 'paid_out';
        const cents = toSafeCents(earnings.totalUsdCentsReceived);
        const month = String(earnings.month || '');

        if (status in earningsStatusCounts) {
          earningsStatusCounts[status] += 1;
          earningsStatusAmountsCents[status] += cents;
        }

        const existing = writerMap.get(userId) || {
          userId,
          username: 'Unknown',
          totalEarnedCents: 0,
          unfundedAllocationsCents: 0,
          availableCents: 0,
          paidOutCents: 0,
          lastMonth: '',
          allocationRawCents: 0,
          allocationFundedCents: 0,
          allocationEntries: 0,
          recordsMissingAllocationDetails: 0,
        };

        if (status === 'available') {
          existing.availableCents += cents;
          existing.totalEarnedCents += cents;
        }
        if (status === 'paid_out') {
          existing.paidOutCents += cents;
          existing.totalEarnedCents += cents;
        }
        if (month && month > existing.lastMonth) existing.lastMonth = month;

        const allocations = Array.isArray(earnings.allocations) ? earnings.allocations : [];
        if (allocations.length > 0) {
          earningsWithAllocationDetails += 1;
          for (const allocation of allocations) {
            const fundedCents = toSafeCents(allocation?.usdCents);
            const rawCents = toSafeCents(allocation?.originalUsdCents ?? allocation?.usdCents ?? 0);
            existing.allocationFundedCents += fundedCents;
            existing.allocationRawCents += rawCents;
            existing.allocationEntries += 1;
            allocationFundedCentsTotal += fundedCents;
            allocationRawCentsTotal += rawCents;
          }
        } else {
          earningsMissingAllocationDetails += 1;
          existing.recordsMissingAllocationDetails += 1;
        }

        writerMap.set(userId, existing);
      });

      // Unfunded allocations are represented by the delta between raw and funded allocation values.
      writerMap.forEach((writer, userId) => {
        const raw = toSafeCents(writer.allocationRawCents);
        const funded = toSafeCents(writer.allocationFundedCents);
        writer.unfundedAllocationsCents = Math.max(0, raw - funded);
        writerMap.set(userId, writer);
      });

      const userDocs = await Promise.all(
        Array.from(userIds).map(async (userId) => {
          try {
            const userDoc = await db.collection(usersCollection).doc(userId).get();
            return {
              userId,
              username: userDoc.exists ? String(userDoc.data()?.username || 'Unknown') : 'Unknown',
            };
          } catch {
            return { userId, username: 'Unknown' };
          }
        })
      );

      userDocs.forEach(({ userId, username }) => {
        const existing = writerMap.get(userId);
        if (existing) {
          existing.username = username;
          writerMap.set(userId, existing);
        }
      });

      const payoutStatusCounts = {
        pending: 0,
        pending_approval: 0,
        completed: 0,
        failed: 0,
      };

      const payoutStatusAmountsCents = {
        pending: 0,
        pending_approval: 0,
        completed: 0,
        failed: 0,
      };

      const payouts = payoutsSnapshot.docs.map((doc) => {
        const payout = doc.data();
        const status = String(payout.status || 'pending') as keyof typeof payoutStatusCounts;
        const amountCents = Number(payout.amountCents || 0);

        if (status in payoutStatusCounts) {
          payoutStatusCounts[status] += 1;
          payoutStatusAmountsCents[status] += amountCents;
        }

        return {
          id: doc.id,
          userId: String(payout.userId || ''),
          amountCents,
          status,
          requestedAt: payout.requestedAt?.toDate?.()?.toISOString?.() || null,
          completedAt: payout.completedAt?.toDate?.()?.toISOString?.() || null,
          failureReason: payout.failureReason || null,
        };
      });

      const totalWriters = writerMap.size;
      const totalPayouts = payoutStatusCounts.pending
        + payoutStatusCounts.pending_approval
        + payoutStatusCounts.completed
        + payoutStatusCounts.failed;

      const writers = Array.from(writerMap.values())
        .sort((a, b) => b.totalEarnedCents - a.totalEarnedCents)
        .slice(0, limit);

      return NextResponse.json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          totals: {
            writers: totalWriters,
            writersReturned: writers.length,
            earningsRecords: earningsSnapshot.size,
            payouts: totalPayouts,
            payoutsReturned: payouts.length,
          },
          earningsStatusCounts,
          earningsStatusAmountsCents,
          payoutStatusCounts,
          payoutStatusAmountsCents,
          allocationAudit: {
            rawCents: allocationRawCentsTotal,
            fundedCents: allocationFundedCentsTotal,
            deltaCents: allocationRawCentsTotal - allocationFundedCentsTotal,
            earningsWithAllocationDetails,
            earningsMissingAllocationDetails,
          },
          writers,
          payouts,
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch writer payouts status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
