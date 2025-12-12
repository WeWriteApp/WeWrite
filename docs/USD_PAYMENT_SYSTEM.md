# WeWrite USD Payment System

## Overview

WeWrite uses a subscription-based USD payment system where subscribers allocate their monthly funds to creators, and creators can withdraw their earnings (minus a 10% platform fee) via Stripe Connect.

## Core Concepts

### The Simple Model

```
SUBSCRIBER                           CREATOR
    |                                   |
    | Subscribes ($5-$100/month)        |
    v                                   |
+----------------+                      |
| subscriptions  | (Stripe-managed)     |
+----------------+                      |
    |                                   |
    | Allocates to pages/users          |
    v                                   |
+----------------+                      |
| usdAllocations | ------------------>  | Earns from allocations
+----------------+                      |
                                        v
                                +------------------+
                                | writerUsdEarnings| (monthly records)
                                +------------------+
                                        |
                                        | Requests payout
                                        v
                                +------------------+
                                | usdPayouts       | (10% fee applied)
                                +------------------+
```

### Key Rules

1. **Subscription = Monthly Budget**: Your subscription tier ($5, $10, $25, $50, $100) is your monthly allocation budget
2. **Allocations Are Intentions**: You can allocate more than your subscription (overspend), but only funded portions are earned by creators
3. **Funded = Earned**: Writers only earn from the funded portion of allocations (subscription amount / total allocated)
4. **Platform Fee on Payout**: 10% fee is deducted when creators withdraw, not when allocations happen

### Funding Ratio Example

If you subscribe for $10/month but allocate $20 total:
- Your **funding ratio** = $10 / $20 = 50%
- Creator allocated $5 → earns $2.50 (50% funded)
- Creator allocated $15 → earns $7.50 (50% funded)
- Total earnings to creators = $10.00 (matches subscription)

## Firestore Collections

### Primary Collections

| Collection | Purpose | Key Fields |
|-----------|---------|-----------|
| `subscriptions` | Stripe subscription data | userId, status, amount, stripeSubscriptionId |
| `usdAllocations` | Monthly allocation records | userId, recipientUserId, resourceType, resourceId, usdCents, month, status |
| `writerUsdEarnings` | Creator earnings per month | userId, month, totalUsdCentsReceived, status, allocations[] |
| `usdPayouts` | Payout request records | userId, amountCents, status, stripePayoutId |

### Derived/Cache Collections (Can Be Recalculated)

| Collection | Purpose | Source of Truth |
|-----------|---------|-----------------|
| `usdBalances` | Subscriber's current balance | Calculated from subscription amount and sum of active allocations |
| ~~`writerUsdBalances`~~ | ~~Creator's balance summary~~ | **DEPRECATED (Phase 2)** - Now calculated on-demand from `writerUsdEarnings` |

## Data Flow

### 1. Subscription Created
```
Stripe Webhook → /api/account-subscription
  → Create/update subscriptions record
  → usdBalances.totalUsdCents = subscription amount
  → usdBalances.availableUsdCents = subscription - allocated
```

### 2. Allocation Made
```
User Action → /api/usd/allocate or /api/usd/allocate-user
  → Create/update usdAllocations record (month-specific)
  → Calculate funding ratio (subscription / totalAllocated)
  → Create writerUsdEarnings entry with FUNDED amount
  → allocatedUsdCents is calculated on-demand from SUM(active allocations)
```

### 3. Month End Processing
```
Cron Job → /api/usd/process-writer-earnings
  → Previous month's pending earnings → available
  → Copy active allocations to new month
  → (Balance calculated on-demand from earnings)
```

### 4. Payout Requested
```
Creator Action → /api/earnings/request-payout
  → Validate available balance >= minimum ($10)
  → Create usdPayouts record (status: pending)
  → Initiate Stripe Connect transfer
  → Deduct 10% platform fee
  → Update writerUsdEarnings status → paid_out
```

## API Endpoints

### Core Endpoints
- `GET /api/usd/balance` - Get subscriber's balance
- `POST /api/usd/allocate` - Allocate to a page
- `POST /api/usd/allocate-user` - Allocate to a user
- `GET /api/usd/allocations` - Get user's allocations
- `GET /api/usd/earnings` - Get creator's earnings
- `POST /api/earnings/request-payout` - Request payout

### Admin Endpoints
- `GET /api/admin/financial-overview` - Platform-wide financial summary
- `POST /api/admin/backfill-earnings` - Reconcile allocation/earnings discrepancies

## Earnings States

```
pending      → Current month, not yet withdrawable
available    → Past months, can be withdrawn
paid_out     → Already withdrawn
```

## Error Recovery

### Allocation/Earnings Mismatch
If allocations exist but earnings records are missing:
1. Run backfill endpoint: `POST /api/admin/backfill-earnings`
2. Script recalculates earnings from active allocations
3. Creates/updates writerUsdEarnings to match

### Balance Discrepancy
Balance discrepancies are now self-healing since allocatedUsdCents is always calculated:
- `allocatedUsdCents` = SUM(usdAllocations WHERE status='active' AND month=currentMonth)
- `availableUsdCents` = totalUsdCents - allocatedUsdCents
- No manual intervention needed - values are computed on every API call

## Platform Fee

- **Rate**: 10% of withdrawal amount
- **Applied**: At payout time, not allocation time
- **Example**: Creator has $100 available → Withdraws → Receives $90

## Environment Handling

Collections use environment-aware prefixes:
- **Production (Vercel)**: `usdAllocations`, `writerUsdEarnings`, etc.
- **Development**: `DEV_usdAllocations`, `DEV_writerUsdEarnings`, etc.

Use `getCollectionNameAsync()` for proper collection name resolution in server code.

---

## Simplification Roadmap

### Remaining Complexity Issues

1. **Funding Ratio Applied Late**: Applied at earnings recording, not visible at allocation time
2. **Double Earnings Tracking**: Both allocations[] array and totalUsdCentsReceived in same document
3. **Pre-existing Build Warning**: `FieldValue` import warning in `usdEarningsService.server.ts`

### Completed Simplifications

#### Phase 1: Single Source of Truth for Subscriber Balances ✅ (December 2025)
- Removed stored `allocatedUsdCents` from usdBalances writes
- Always calculate from SUM(active allocations) via `calculateActualAllocatedUsdCents()`
- Trade-off: More queries, but eliminates drift entirely
- API responses still include `allocatedUsdCents` (computed on-demand)

#### Phase 2: Single Source of Truth for Creator Balances ✅ (December 2025)
- Removed stored `writerUsdBalances` collection writes
- Creator balance now calculated on-demand from `writerUsdEarnings` records
- `getWriterUsdBalance()` sums earnings by status (pending/available/paid_out)
- `processUsdAllocation()` only writes to earnings, not balance
- `processMonthlyDistribution()` only updates earnings status
- Deprecated methods kept for backwards compatibility but are no-ops
- Trade-off: More queries per balance request, but eliminates drift entirely

### Proposed Simplifications

#### Phase 3: Upfront Funding Calculation
- Store funding ratio at allocation time
- Show creators "expected earnings" immediately
- Simpler monthly processing

#### Phase 4: Final Cleanup (Optional)
- [x] All API routes now calculate balance from `writerUsdEarnings` records
- [x] `WRITER_USD_BALANCES` collection marked as `@deprecated` in code
- [x] Backfill/migration scripts can still reference collection for historical data
- [ ] Consider removing `writerUsdBalances` type from database types (or keep as legacy)
- [ ] Consider archiving/deleting `writerUsdBalances` collection data (after validation period)

---

**Last Updated**: December 2025
**Status**: Active - Production system (Phase 1, 2 & partial Phase 4 complete)

### Migration Summary

The following files were updated to calculate balance from `writerUsdEarnings` records:
- `app/api/earnings/user/route.ts` - User earnings API
- `app/api/payouts/route.ts` - Payout overview API
- `app/api/payouts/request/route.ts` - Payout eligibility and request
- `app/api/admin/writer-earnings/route.ts` - Admin analytics
- `app/api/admin/users/route.ts` - Admin user panel
- `app/api/debug/earnings-status/route.ts` - Debug endpoint
- `app/api/public/platform-stats/route.ts` - Public stats
- `app/services/payoutServiceUnified.ts` - Payout processing
- `app/services/unifiedEarningsService.ts` - Client-side service
