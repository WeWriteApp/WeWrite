# WeWrite Payout System Audit Report

**Date:** December 2025  
**Auditor:** AI Assistant  
**Scope:** Full payment flow from allocation to payout
**Status:** FIXES APPLIED

---

## 🚨 CRITICAL FINDINGS (FIXED)

### Issue #1: Missing USD Earnings Processing Cron Job ✅ FIXED

**Severity:** CRITICAL  
**Impact:** Writers cannot receive payouts - earnings remain permanently "pending"

**Problem:**
The `vercel.json` cron configuration was missing the USD processing endpoint.

**Fix Applied:**
Added `/api/usd/process-writer-earnings` cron job to run at 8am UTC on the 1st of each month.

---

### Issue #2: Platform Fee Scattered Across Multiple Files ✅ FIXED

**Severity:** HIGH  
**Impact:** Inconsistent fee calculations, hard to maintain

**Problem:**
Platform fee was defined in 8+ different places with different values (7%, 10%, 0%).

**Fix Applied:**
Created centralized `app/config/platformFee.ts` as single source of truth.
All services now import from this file.

**Current Fee:** 10% (taken at payout time only)

---

## 💰 Platform Fee - How It Works

### Single Source of Truth
```typescript
// app/config/platformFee.ts
export const PLATFORM_FEE_CONFIG = {
  PERCENTAGE: 0.10,           // 10%
  PERCENTAGE_DISPLAY: 10,     // For UI
  MINIMUM_PAYOUT_CENTS: 2500, // $25
  MINIMUM_PAYOUT_DOLLARS: 25,
};
```

### When Is The Fee Applied?
**ONLY at payout time.** The fee is NOT deducted when:
- Users subscribe
- Users allocate to writers
- Month-end processing moves funds to storage

The fee IS deducted when:
- Writers request a payout from their available balance

### Revenue Streams for WeWrite
1. **Platform Fee (10%)** - Taken from writer payouts
2. **Unallocated Funds** - "Use it or lose it" - funds users didn't allocate stay with WeWrite

---

### Issue #3: Duplicate Earnings Calculation Paths

**Severity:** MEDIUM  
**Impact:** Potential for double-counting or inconsistent totals

**Path A - Real-time Processing:**
```
usdService.ts (createAllocation)
  → usdEarningsService.server.ts (processUsdAllocation)
    → Creates writerUsdEarnings with status='pending'
    → Updates writerUsdBalances (pendingUsdCents)
```

**Path B - Month-end Batch Processing:**
```
monthEndCronService.ts (runMonthEnd)
  → monthlyAllocationLockService.ts (lockAllocations)
    → Creates userAllocationSnapshots
  → earningsCalculationEngine.ts (calculateMonthlyEarnings)
    → Reads from userAllocationSnapshots
    → Calculates with 7% fee
```

**Problem:**
It's unclear if both paths are intended to run, or if they're alternatives. The real-time path creates earnings records immediately, while the batch path uses locked snapshots. They may both be updating balances.

---

## 📊 System Flow Analysis

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION LAYER                           │
│  User subscribes → usdBalances doc updated (monthly amount)     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ALLOCATION LAYER                             │
│  User allocates → usdAllocations doc created                    │
│  (amount, writerId, pageId, month)                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌──────────────────────────────┐  ┌────────────────────────────────┐
│   REAL-TIME PATH             │  │   MONTH-END PATH               │
│   usdEarningsService.server  │  │   monthlyAllocationLockService │
│                              │  │   earningsCalculationEngine    │
│   Creates:                   │  │                                │
│   - writerUsdEarnings        │  │   Creates:                     │
│     (status: 'pending')      │  │   - userAllocationSnapshots    │
│   - writerUsdBalances        │  │                                │
│     (pendingUsdCents)        │  │   MISSING: Updates to make     │
│                              │  │   earnings 'available'         │
└──────────────────────────────┘  └────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STATUS TRANSITION (BROKEN)                   │
│  processMonthlyDistribution() should be called by cron:         │
│  - Query writerUsdEarnings where status='pending' AND month=X   │
│  - Update status to 'available'                                 │
│  - Recalculate writerUsdBalances (move pending → available)     │
│                                                                 │
│  ❌ NO CRON JOB TRIGGERS THIS!                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼ (never reached)
┌─────────────────────────────────────────────────────────────────┐
│                    PAYOUT LAYER                                 │
│  PayoutService.requestPayout()                                  │
│  - Checks writerUsdBalances.availableCents (always 0!)          │
│  - Requires minimum $25 available                               │
│  - Creates usdPayouts record                                    │
│  - Transfers via Stripe Connect                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 RECOMMENDED FIXES

### Fix #1: Add USD Earnings Processing Cron Job

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/automated-payouts",
      "schedule": "0 9 1 * *"
    },
    {
      "path": "/api/usd/process-writer-earnings",
      "schedule": "0 8 1 * *"
    }
  ]
}
```

**Note:** The USD processing should run BEFORE automated-payouts so earnings become available before payout processing.

---

### Fix #2: Standardize Platform Fee to 7%

Update all files to use consistent 7% platform fee:

1. `app/services/unifiedEarningsService.ts` - change 0.10 to 0.07
2. `app/components/earnings/PayoutFeeBreakdown.tsx` - change 0.10 to 0.07
3. `app/utils/currency.ts` - change default from 10 to 7

---

### Fix #3: Immediate Database Fix for Stuck Earnings

Writers with pending earnings need them converted to available. Run this script:

```javascript
// Fix stuck pending earnings
const pendingEarnings = await db.collection('writerUsdEarnings')
  .where('status', '==', 'pending')
  .get();

const batch = db.batch();
pendingEarnings.docs.forEach(doc => {
  batch.update(doc.ref, {
    status: 'available',
    processedAt: admin.firestore.FieldValue.serverTimestamp()
  });
});
await batch.commit();

// Then recalculate all writer balances
const affectedWriters = new Set(pendingEarnings.docs.map(d => d.data().userId));
for (const writerId of affectedWriters) {
  await ServerUsdEarningsService.updateWriterBalance(writerId);
}
```

---

## 📁 Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `vercel.json` | Cron job configuration | ❌ Missing USD cron |
| `app/api/usd/process-writer-earnings/route.ts` | Endpoint to process monthly distribution | ✅ Exists but never called |
| `app/services/usdEarningsService.server.ts` | Server-side earnings processing | ✅ Functional |
| `app/services/payoutServiceUnified.ts` | Payout request/processing | ✅ Functional (but no available balance) |
| `app/services/earningsCalculationEngine.ts` | Month-end batch calculation | ⚠️ Uses 7% fee |
| `app/services/unifiedEarningsService.ts` | Earnings calculation | ⚠️ Uses 10% fee |

---

## 🧪 Testing Recommendations

### Immediate Tests

1. **Check pending earnings count:**
   ```
   db.collection('writerUsdEarnings').where('status', '==', 'pending').get()
   ```

2. **Check writer balance states:**
   ```
   db.collection('writerUsdBalances').get()
   // Look for pendingUsdCents > 0 AND availableUsdCents == 0
   ```

3. **Manually trigger processing:**
   ```bash
   curl -X POST https://wewrite.com/api/usd/process-writer-earnings \
     -H "Authorization: Bearer $CRON_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"period": "2025-01"}'
   ```

### Post-Fix Validation

1. Verify `writerUsdEarnings` records transition from `pending` to `available`
2. Verify `writerUsdBalances.availableUsdCents` is populated correctly
3. Verify writers can request payouts successfully
4. Verify platform fee is consistent (7%) in UI and processing

---

## 📈 Impact Assessment

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| Writers with stuck pending earnings | All | 0 |
| Successful payout requests | 0 | Expected normal |
| Platform fee consistency | 7%/10% mixed | 7% everywhere |
| Monthly processing automation | Not running | Automated |

---

## 🔄 Next Steps

1. **URGENT:** Apply cron job fix to `vercel.json`
2. **URGENT:** Run database migration for stuck earnings
3. **HIGH:** Fix platform fee inconsistency
4. **MEDIUM:** Add monitoring/alerting for failed cron jobs
5. **MEDIUM:** Add documentation for the earnings lifecycle
6. **LOW:** Consider consolidating duplicate calculation paths
