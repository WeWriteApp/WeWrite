# Storage Balance System Audit - Complete Fund Flow Analysis

## Fund Flow Model: Monthly Bulk Processing

**IMPORTANT**: This document has been updated to accurately reflect the ACTUAL implementation of the fund flow system.

---

## How Funds Actually Flow

### The Monthly Bulk Processing Model

WeWrite uses a **monthly bulk processing model** rather than immediate transfers. Here's how it works:

1. **Throughout the Month (Days 1-31)**:
   - Subscription payments land in **Stripe Payments Balance**
   - User allocations are tracked in **Firebase** (not immediately moved to Storage Balance)
   - Users can change their allocations as much as they want during the month

2. **Month-End Processing (1st of Next Month at 9 AM UTC)**:
   - Allocations are "locked" - no more changes allowed for the previous month
   - Bulk transfer: Allocated funds move to **Storage Balance**
   - Creator payouts are processed from Storage Balance
   - Unallocated funds remain in Payments Balance as **platform revenue**

### Why Monthly Bulk vs. Immediate Transfer?

| Factor | Monthly Bulk | Immediate Transfer |
|--------|--------------|-------------------|
| Allocation Changes | Allows throughout month | Requires complex reversals |
| Stripe API Calls | Once per month | Every allocation change |
| Cost | Lower | Higher |
| Complexity | Lower | Higher |
| User Experience | Flexible | Restrictive |

**WeWrite chose Monthly Bulk because**:
- Users can freely change allocations without triggering transfers
- Subscription funding model means users have the whole month to decide
- "Use it or lose it" naturally fits month-end processing
- Simpler architecture with lower operational costs

---

## Complete Fund Flow Diagram

```
THROUGHOUT MONTH:
==================
User Subscription ($50) --> Stripe Payments Balance ($50)

User allocates $30 to Creator A --> Firebase: allocatedUsdCents += 3000
User allocates $10 to Creator B --> Firebase: allocatedUsdCents += 1000
User changes mind, removes $5 from Creator A --> Firebase: allocatedUsdCents -= 500

End of month status (in Firebase):
- User total subscription: $50
- Allocated to creators: $35
- Available (unallocated): $15


MONTH-END PROCESSING (1st of next month):
==========================================
Step 1: Lock allocations (no more changes for previous month)

Step 2: Aggregate all user allocations from Firebase
        Total allocated: $10,000
        Total unallocated: $3,000

Step 3: Move allocated funds to Storage Balance
        Payments Balance: $13,000 --> $3,000 (-$10,000)
        Storage Balance: $0 --> $10,000

Step 4: Process creator payouts from Storage Balance
        - Platform fee (7%): $700 --> Payments Balance
        - Creator payouts: $9,300 --> Creator bank accounts

Step 5: "Use it or lose it"
        Unallocated $3,000 stays in Payments Balance (platform revenue)

Final state:
- Storage Balance: $0 (emptied after payouts)
- Payments Balance: $3,700 (unallocated + platform fees)
```

---

## Firebase vs Stripe: What's Tracked Where?

### Firebase (Real-time tracking)
```typescript
// usdBalances collection - per user
{
  userId: "user123",
  totalUsdCents: 5000,           // Subscription amount for this month
  allocatedUsdCents: 3500,       // How much they've allocated to creators
  availableUsdCents: 1500,       // totalUsdCents - allocatedUsdCents
  monthlyAllocationCents: 5000,  // Monthly subscription amount
  month: "2024-12"
}

// usdAllocations collection - per allocation
{
  userId: "user123",
  pageId: "page456",
  authorId: "author789",
  amountCents: 2000,
  month: "2024-12"
}
```

### Stripe (Actual money)
- **Payments Balance**: Where subscription payments land, where platform revenue accumulates
- **Storage Balance**: Used only during month-end processing as temporary escrow for payouts

---

## WeWrite Revenue Model

### Revenue Sources

1. **Platform Fee (7%)**: Deducted from allocated funds at payout time
2. **Unallocated Funds (100%)**: "Use it or lose it" - if users don't allocate, it becomes platform revenue

### Example Month
```
Total Subscriptions:     $10,000 (100%)
├── Allocated to Creators: $7,000 (70%)
│   ├── Platform Fee (7%):   $490 --> Platform Revenue
│   └── Creator Payouts:   $6,510 --> Creator Bank Accounts
└── Unallocated:           $3,000 (30%) --> Platform Revenue

Total Creator Payouts:   $6,510 (65.1% of subscriptions)
Total Platform Revenue:  $3,490 (34.9% of subscriptions)
  - From Platform Fees:    $490
  - From Unallocated:    $3,000
```

---

## Code Implementation Details

### Allocation API (`app/api/usd/allocate/route.ts`)
- Updates Firebase only
- Does NOT trigger Stripe transfers
- Updates `allocatedUsdCents` and `availableUsdCents` in real-time

### USD Service (`app/services/usdService.server.ts`)
- `allocateUsdToPage()`: Updates Firebase allocation records
- `getMonthlyAllocationSummary()`: Aggregates all allocations for the month
- Does NOT call stripeStorageBalanceService during allocations

### Storage Balance Cron (`app/api/cron/storage-balance-processing/route.ts`)
- Runs at month-end (1st of next month at 9 AM UTC)
- Aggregates allocations from Firebase
- Calls `stripeStorageBalanceService.processMonthlyStorageBalance()`
- This is the ONLY place where Stripe Storage Balance transfers occur

### Storage Balance Service (`app/services/stripeStorageBalanceService.ts`)
- `moveAllocatedFundsToStorage()`: Bulk transfer at month-end
- `moveUnallocatedFundsToPayments()`: "Use it or lose it" processing
- `processPayoutFromStorage()`: Individual creator payouts

---

## Monthly Financials Admin Page

The `/admin/monthly-financials` page provides visibility into:

1. **Current Month Status**:
   - Total subscriptions (from Firebase)
   - Total allocated to creators (from Firebase)
   - Total unallocated (calculated)
   - Days remaining until processing

2. **Stripe Balance**:
   - Available balance
   - Pending balance
   - Total balance

3. **Historical Monthly Data**:
   - Table of all processed months
   - Allocation rates over time
   - Platform revenue trends

---

## Key Insights

### Creator Obligation Tracking

**Question**: "How do we know what we owe creators?"

**Answer**:
- During the month: Sum all `allocatedUsdCents` from Firebase
- After processing: These funds are in Storage Balance until paid out
- After payouts: Storage Balance returns to $0

### Fund Segregation

**Question**: "Are creator funds separated from platform funds?"

**Answer**:
- **During month**: No physical separation (all in Payments Balance)
- **Obligation tracking**: Firebase maintains allocation records
- **At month-end**: Allocated funds move to Storage Balance for payouts
- **Software safeguards**: Firebase tracking prevents over-allocation

### Best Practice Recommendation

The monthly bulk model was chosen because:
1. WeWrite's subscription model allows allocation changes throughout the month
2. Immediate transfer would require complex reversal logic
3. Monthly processing aligns with subscription billing cycles
4. Lower Stripe API costs and simpler architecture

**Enhanced safeguards implemented**:
- Firebase tracking of all allocations
- Monthly Financials admin page for visibility
- Clear documentation of fund flow
- Automated month-end processing cron job

---

## Summary

| What | Where | When |
|------|-------|------|
| Subscriptions | Stripe Payments Balance | On payment |
| Allocation tracking | Firebase | Real-time |
| Allocated funds transfer | Stripe Storage Balance | Month-end |
| Creator payouts | From Storage Balance | Month-end |
| Platform fees | Stripe Payments Balance | At payout |
| Unallocated funds | Stripe Payments Balance | Month-end |

**The system is designed for flexibility (monthly allocation changes) with clear tracking (Firebase) and proper processing (month-end batch).**
