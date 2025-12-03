# WeWrite Monthly Payout Process

## Overview

This document describes the automated monthly payout process that runs on the 1st of each month to process writer earnings and payouts.

## Monthly Timeline

| Time (UTC) | What Happens |
|------------|--------------|
| 8:00 AM | **Step 1:** Process writer earnings - moves `pending` → `available` |
| 9:00 AM | **Step 2:** Automated payouts - processes available balances |

## Cron Job Configuration

Located in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/usd/process-writer-earnings",
      "schedule": "0 8 1 * *"
    },
    {
      "path": "/api/cron/automated-payouts",
      "schedule": "0 9 1 * *"
    }
  ]
}
```

## Step 1: Process Writer Earnings

**Endpoint:** `/api/usd/process-writer-earnings`  
**Schedule:** 8:00 AM UTC on the 1st of each month

### What It Does
1. Queries all `writerUsdEarnings` records where `status = 'pending'` for the previous month
2. Updates status from `pending` → `available`
3. Recalculates each writer's `writerUsdBalances` document

### Collections Affected
- `writerUsdEarnings` - status field updated
- `writerUsdBalances` - `availableUsdCents` recalculated

### Code Path
```
/api/usd/process-writer-earnings (GET)
  → ServerUsdEarningsService.processMonthlyDistribution(previousMonth)
    → Query pending earnings
    → Batch update status to 'available'
    → updateWriterBalance() for each affected writer
```

## Step 2: Automated Payouts

**Endpoint:** `/api/cron/automated-payouts`  
**Schedule:** 9:00 AM UTC on the 1st of each month

### What It Does
1. Initializes the payout scheduler
2. Queries all `payouts` records where `status = 'pending'` and `amount >= $25`
3. Processes each payout via Stripe Connect transfers

### Note on Payout Requests
Writers must **manually request payouts** through the UI. The automated payout job processes any pending payout requests that were made but not yet fulfilled.

For automatic payouts, writers need to have:
1. Connected a Stripe account
2. Available balance ≥ $25
3. Requested a payout through the dashboard

## Platform Fee

The platform fee (10%) is deducted **at payout time only**, not when earnings are calculated.

**Configuration:** `app/config/platformFee.ts` (single source of truth)

```typescript
export const PLATFORM_FEE_CONFIG = {
  PERCENTAGE: 0.10,           // 10%
  MINIMUM_PAYOUT_CENTS: 2500, // $25
};
```

## Earnings Lifecycle

```
1. User subscribes
   └── Funds go to Stripe Payments Balance

2. User allocates to writers (during month)
   └── Creates usdAllocations records
   └── Creates writerUsdEarnings with status='pending'
   └── Updates writerUsdBalances.pendingUsdCents

3. Month-end (1st of next month, 8 AM UTC)
   └── /api/usd/process-writer-earnings runs
   └── Changes writerUsdEarnings status to 'available'
   └── Updates writerUsdBalances.availableUsdCents

4. Writer requests payout (anytime after step 3)
   └── Creates usdPayouts record with status='pending'
   └── Immediately processes via Stripe (10% fee deducted)
   └── Writer receives funds in their bank

5. Automated payout processing (1st of month, 9 AM UTC)
   └── Picks up any pending payout requests
   └── Processes them via Stripe
```

## Environment Variables

Required for cron jobs to work:

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Automatically set by Vercel for cron requests |
| `CRON_API_KEY` | Custom key for manual API calls |

## Troubleshooting

### Writers Not Getting Paid

1. **Check earnings status:**
   ```
   db.collection('writerUsdEarnings').where('userId', '==', WRITER_ID).get()
   ```
   - If status is `pending`, Step 1 hasn't run yet
   - If status is `available`, the writer needs to request a payout

2. **Check writer balance:**
   ```
   db.collection('writerUsdBalances').doc(WRITER_ID).get()
   ```
   - `pendingUsdCents` = not yet available
   - `availableUsdCents` = can be paid out
   - Must be ≥ 2500 ($25) for payout

3. **Check payout requests:**
   ```
   db.collection('usdPayouts').where('userId', '==', WRITER_ID).get()
   ```

### Manually Triggering Cron Jobs

For testing or recovery:

```bash
# Process earnings for a specific month
curl -X POST https://wewrite.app/api/usd/process-writer-earnings \
  -H "Authorization: Bearer $CRON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"period": "2025-11"}'

# Force automated payouts
curl -X POST https://wewrite.app/api/cron/automated-payouts \
  -H "Authorization: Bearer $CRON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"forceRun": true}'
```

### Fix Stuck Pending Earnings

If earnings are stuck in `pending` status from months ago:

```bash
node scripts/fix-stuck-pending-earnings.js --dry-run  # Preview
node scripts/fix-stuck-pending-earnings.js            # Apply fix
```

## Monitoring

### Vercel Dashboard
- Go to Project → Logs
- Filter by "CRON" to see cron job execution logs

### Expected Log Output

**Successful earnings processing:**
```
[CRON] Processing writer USD earnings for period: 2025-11
[ServerUsdEarningsService] Processing monthly USD distribution for 2025-11
[ServerUsdEarningsService] Monthly distribution complete: { processedCount: 150, affectedWriters: 45 }
```

**Successful payout processing:**
```
[CRON] Starting automated payout processing via GET [corr-123]
[CRON] Automated payout processing completed [corr-123] { totalPayouts: 12, successful: 12, failed: 0 }
```

## Related Documentation

- [Payout System Audit](./PAYOUT_SYSTEM_AUDIT.md)
- [Storage Balance Guide](./STORAGE_BALANCE_GUIDE.md)
- [Platform Fee Management](./PLATFORM_FEE_MANAGEMENT_SYSTEM.md)

## Related Documentation

- [Payout Troubleshooting Guide](./PAYOUT_TROUBLESHOOTING_GUIDE.md) - Common issues
- [Payout System Audit](./PAYOUT_SYSTEM_AUDIT.md) - Audit findings
- [Payment System Guide](./PAYMENT_SYSTEM_GUIDE.md) - Money flow overview
- [Financial Data Architecture](./FINANCIAL_DATA_ARCHITECTURE.md) - Data structure
- [Cron Job Setup](./CRON_JOB_SETUP.md) - Scheduled jobs
