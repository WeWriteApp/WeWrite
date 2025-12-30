# Payout System V2 - Complete Implementation Guide

**Last Updated:** December 29, 2024
**Status:** Production Ready (Pre-Launch)
**Version:** 2.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Payout Webhook Handlers](#2-payout-webhook-handlers)
3. [Refund & Dispute Handling](#3-refund--dispute-handling)
4. [Webhook Idempotency Layer](#4-webhook-idempotency-layer)
5. [Platform Balance Monitoring](#5-platform-balance-monitoring)
6. [Payout Limits & Fraud Protection](#6-payout-limits--fraud-protection)
7. [Admin Approval Workflow](#7-admin-approval-workflow)
8. [Testing Recommendations](#8-testing-recommendations)
9. [Stripe Dashboard Configuration](#9-stripe-dashboard-configuration)
10. [Monitoring & Alerting](#10-monitoring--alerting)
11. [Files Changed/Created Summary](#11-files-changedcreated-summary)

---

## 1. Overview

### What Was Implemented

The Payout System V2 is a comprehensive overhaul that adds enterprise-grade reliability, fraud protection, and monitoring to the WeWrite payout infrastructure. This system ensures:

- **Reliability**: Webhook idempotency prevents duplicate processing
- **Safety**: Platform balance monitoring prevents fund depletion
- **Security**: Multi-level fraud protection with configurable limits
- **Visibility**: Real-time monitoring and alerting for critical issues
- **Compliance**: Comprehensive audit trails and admin controls

### Key Features

✅ **Webhook Handlers** - Real-time processing of transfer and payout events
✅ **Idempotency Layer** - Prevents duplicate event processing
✅ **Balance Monitoring** - Automated platform balance health checks
✅ **Fraud Protection** - Velocity limits, transaction limits, suspicious pattern detection
✅ **Admin Approval** - Manual review workflow for high-risk payouts
✅ **Refund/Dispute Handling** - Automatic allocation freezing and recovery
✅ **Audit Trails** - Complete event logging for compliance

### Pre-Launch Readiness Checklist

- [ ] **Stripe Webhook Endpoints Configured** (See Section 9)
- [ ] **Environment Variables Set** (STRIPE_WEBHOOK_SECRET_PAYOUTS, CRON_SECRET)
- [ ] **Cron Job Scheduled** (platform-balance-check at 6am UTC daily)
- [ ] **Admin Email Configured** (For critical balance alerts)
- [ ] **Test Webhooks with Stripe CLI** (See Section 8)
- [ ] **Review Payout Limits** (Adjust if needed in `payoutLimits.ts`)
- [ ] **Set Up Admin Approval Dashboard** (Ensure admins can access approval queue)
- [ ] **Monitor First 24 Hours** (Watch for any unexpected alerts)

---

## 2. Payout Webhook Handlers

### File Location

**Primary Handler:** `/app/api/webhooks/stripe-payouts/route.ts`

### Events Handled

The webhook endpoint processes the following Stripe events:

#### Core Transfer Events

1. **transfer.created** - Transfer initiated to Connect account
2. **transfer.paid** - Transfer successfully completed
3. **transfer.failed** - Transfer failed (triggers retry logic)
4. **transfer.reversed** - Transfer reversed by Stripe

#### Bank Payout Events

5. **payout.paid** - Funds arrived in user's bank account
6. **payout.failed** - Bank-level payout failure

#### Account Status Events

7. **account.updated** - Connect account status changes

### Key Functions

#### `handleTransferPaid()`

Marks payout as completed and sends user notification.

```typescript
// Updates payout status
await payoutRef.update({
  status: 'completed',
  stripePayoutId: transfer.id,
  completedAt: serverTimestamp(),
  webhookProcessedAt: serverTimestamp()
});

// Sends notification to user
await sendUserNotification(userId, {
  type: 'payout_completed',
  title: 'Payout completed',
  body: `Your payout of $${amount} has been sent to your bank account.`
});
```

#### `handleTransferFailed()`

Implements intelligent retry logic with exponential backoff:

- **Retryable Errors**: `account_closed`, `insufficient_funds`, `debit_not_authorized`, `generic_decline`, `processing_error`, `rate_limit`
- **Retry Schedule**: 5, 10, 20 minutes (exponential backoff)
- **Max Retries**: 3 attempts
- **Permanent Failure**: After max retries or non-retryable error

```typescript
if (isRetryable && currentRetryCount < maxRetries) {
  const retryDelayMinutes = Math.pow(2, currentRetryCount) * 5;
  const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

  await payoutRef.update({
    status: 'pending',
    retryCount: increment(1),
    nextRetryAt: nextRetryAt
  });
} else {
  await payoutRef.update({ status: 'failed' });
}
```

#### `handleAccountUpdated()`

Monitors Connect account verification status and notifies users if payouts become disabled:

```typescript
// Updates user's account status
await userDoc.ref.update({
  stripeAccountStatus: {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirementsCurrentlyDue: account.requirements?.currently_due || []
  }
});

// Alerts user if payouts disabled
if (!account.payouts_enabled) {
  await sendUserNotification(userId, {
    type: 'payout_account_disabled',
    title: 'Bank account verification needed'
  });
}
```

### Audit Logging

All webhook events are logged to `payoutAuditLogs` collection:

```typescript
await db.collection('payoutAuditLogs').add({
  payoutId,
  eventType: 'transfer_paid',
  transferId: transfer.id,
  amount: transfer.amount / 100,
  timestamp: serverTimestamp(),
  statusChange: { from: 'pending', to: 'completed' }
});
```

### How to Test with Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to your account
stripe login

# Forward events to local webhook
stripe listen --forward-to localhost:3000/api/webhooks/stripe-payouts

# Trigger test events
stripe trigger transfer.created
stripe trigger transfer.paid
stripe trigger transfer.failed
stripe trigger account.updated
```

**Production Testing:**

```bash
# Forward to production endpoint
stripe listen --forward-to https://www.getwewrite.app/api/webhooks/stripe-payouts

# Verify webhook is receiving events
curl https://www.getwewrite.app/api/webhooks/stripe-payouts
# Expected: {"status":"ok","service":"stripe-payouts-webhook","timestamp":"..."}
```

---

## 3. Refund & Dispute Handling

### File Location

**Handler:** `/app/api/webhooks/stripe-subscription/route.ts`
*Note: Refund/dispute handlers are in the subscription webhook because they relate to subscription charges*

### Events Handled

1. **charge.refunded** - Subscription payment refunded
2. **charge.dispute.created** - Customer filed a dispute/chargeback
3. **charge.dispute.closed** - Dispute resolved (won or lost)

### How Allocations Are Frozen/Unfrozen

#### Refund Processing (`handleChargeRefunded`)

When a subscription charge is refunded:

1. **Calculate Impact**: Determines refund percentage (partial vs full)
2. **Reduce Allocations**: Proportionally reduces all active allocations
3. **Mark Status**: Updates allocations to `refunded` or `at_risk`
4. **Update Balance**: Reduces user's USD balance

```typescript
// Calculate refund impact
const refundPercentage = refundedAmount / originalAmount;
const refundReductionCents = Math.round(currentAllocatedCents * refundPercentage);

// Proportionally reduce each allocation
for (const allocation of allocations) {
  const reductionAmount = Math.round(allocation.usdCents * refundPercentage);

  batch.update(allocationRef, {
    status: isFullRefund ? 'refunded' : 'at_risk',
    usdCents: allocation.usdCents - reductionAmount,
    refundedAmount: reductionAmount,
    refundedAt: new Date().toISOString()
  });
}
```

#### Dispute Creation (`handleDisputeCreated`)

When a customer files a dispute:

1. **Immediate Freeze**: All allocations marked as `disputed`
2. **Prevent Payouts**: Frozen allocations cannot be paid out
3. **Admin Alert**: Critical alert sent to admin team
4. **User Notification**: User informed of freeze

```typescript
// Freeze all allocations
for (const allocation of allocations) {
  batch.update(allocationRef, {
    status: 'disputed',
    disputedAt: new Date().toISOString(),
    disputeId: dispute.id,
    frozenAmount: allocation.usdCents
  });
}

// Create critical alert
await createCriticalAlert({
  type: 'dispute_created',
  title: 'Payment Dispute Created',
  message: `CRITICAL: Dispute filed for $${disputedAmount}. All allocations frozen.`,
  urgency: 'critical'
});
```

#### Dispute Resolution (`handleDisputeClosed`)

**Dispute Won:**
- Allocations unfrozen and restored to `active` status
- User can request payouts again

```typescript
batch.update(doc.ref, {
  status: 'active',
  disputeResolvedAt: new Date().toISOString(),
  disputeOutcome: 'won'
});
```

**Dispute Lost:**
- Allocations marked as `refunded`
- Amounts reduced to $0
- User's USD balance reset

```typescript
batch.update(doc.ref, {
  status: 'refunded',
  usdCents: 0,
  disputeOutcome: 'lost',
  refundedAmount: data.frozenAmount
});

// Update balance to 0
await UsdService.updateMonthlyUsdAllocation(userId, 0);
```

### Admin Alert System

All refunds and disputes trigger critical alerts in the `criticalAlerts` collection:

```typescript
await addDoc(collection(db, 'criticalAlerts'), {
  type: 'dispute_created', // or 'dispute_closed'
  severity: 'critical',
  title: 'Payment Dispute Created',
  message: 'Detailed message with amounts and impact',
  requiresAttention: true,
  resolved: false,
  timestamp: serverTimestamp(),
  metadata: {
    affectedUserId,
    disputeId,
    disputedAmount,
    allocationsAffected: count
  }
});
```

Admins can view these alerts in the Admin Dashboard under "Critical Alerts" or "Financial Alerts" section.

---

## 4. Webhook Idempotency Layer

### Service Location

**File:** `/app/services/webhookIdempotencyService.ts`

### Purpose

Prevents duplicate webhook processing when Stripe retries events (which happens automatically for failed webhooks). Without this, a single event could be processed multiple times, leading to:

- Duplicate payout attempts
- Incorrect balance calculations
- Multiple user notifications
- Audit log pollution

### Firestore Collection Structure

**Collection:** `processedWebhookEvents`

**Document Structure:**

```typescript
{
  eventId: "evt_1ABC2DEF3GHI4JKL",       // Stripe event ID (unique)
  eventType: "transfer.paid",             // Event type
  processedAt: Timestamp,                 // First processing timestamp
  status: "completed",                    // processing | completed | failed
  webhookEndpoint: "stripe-payouts",      // Which endpoint received it
  metadata: {
    apiVersion: "2024-12-18.acacia",
    created: 1703865600
  },
  completedAt: Timestamp,                 // When processing finished
  failedAt?: Timestamp,                   // If processing failed
  error?: string                          // Error message if failed
}
```

### How Duplicate Events Are Prevented

#### Atomic Check-and-Mark Flow

```typescript
// 1. Check if event already processed
const isProcessed = await webhookIdempotencyService.isEventProcessed(event.id);
if (isProcessed) {
  return { received: true, duplicate: true };
}

// 2. Atomically mark as processing
const marked = await webhookIdempotencyService.markEventProcessing(
  event.id,
  event.type,
  'stripe-payouts'
);

if (!marked) {
  // Another instance is already processing this event
  return { received: true, duplicate: true };
}

// 3. Process the event
try {
  await handleWebhookEvent(event);
  await webhookIdempotencyService.markEventCompleted(event.id);
} catch (error) {
  await webhookIdempotencyService.markEventFailed(event.id, error.message);
}
```

#### Race Condition Protection

The service uses Firestore's atomic operations to prevent race conditions:

```typescript
// Check if document exists before creating
const existingDoc = await getDoc(eventRef);
if (existingDoc.exists()) {
  return false; // Already being processed
}

// Create document atomically
await setDoc(eventRef, {
  eventId,
  eventType,
  status: 'processing',
  processedAt: Timestamp.now()
});
```

### TTL and Cleanup

**Retention Period:** 30 days

Events older than 30 days are automatically cleaned up to prevent unbounded growth:

```typescript
async cleanupOldEvents() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const oldEventsQuery = query(
    collection(db, 'processedWebhookEvents'),
    where('processedAt', '<', cutoffDate)
  );

  // Delete in batches of 100
  // Returns: { deleted: number, errors: number }
}
```

**Cleanup Scheduling:** Should be run weekly via cron job (not yet implemented - add to TODO).

### Statistics & Debugging

Get webhook processing statistics:

```typescript
const stats = await webhookIdempotencyService.getStatistics();
// Returns: { total, processing, completed, failed }

const recent = await webhookIdempotencyService.getRecentEvents(50);
// Returns last 50 events with full details
```

---

## 5. Platform Balance Monitoring

### Service Location

**Service:** `/app/services/platformBalanceMonitoringService.ts`
**Cron Endpoint:** `/app/api/cron/platform-balance-check/route.ts`

### Purpose

Monitors the Stripe platform balance in real-time to ensure there are sufficient funds to cover pending payout obligations. Prevents situations where the platform runs out of money before paying users.

### Cron Job Schedule and Configuration

**Schedule:** `0 6 * * *` (Daily at 6am UTC)

**Vercel Configuration** (`vercel.json`):

```json
{
  "crons": [{
    "path": "/api/cron/platform-balance-check",
    "schedule": "0 6 * * *"
  }]
}
```

**Authentication:**

The cron endpoint requires either:
- `CRON_SECRET` (Vercel's built-in, set automatically)
- `CRON_API_KEY` (Custom key for manual triggers)

```bash
# Manual trigger example
curl -X GET https://www.getwewrite.app/api/cron/platform-balance-check \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### Alert Thresholds

**Balance Thresholds (in cents):**

```typescript
export const BALANCE_THRESHOLDS = {
  CRITICAL: 1000_00,    // $1,000 - immediate action required
  WARNING: 5000_00,     // $5,000 - add funds soon
  HEALTHY: 10000_00,    // $10,000 - healthy buffer
};

const RESERVE_MULTIPLIER = 1.2; // Keep 120% of obligations as reserve
```

**Threshold Logic:**

| Balance Status | Condition | Action |
|---------------|-----------|--------|
| **Depleted** | Balance ≤ $0 | CRITICAL alert, immediate fund transfer |
| **Critical** | Balance < $1,000 OR < 50% of required reserve | CRITICAL alert, transfer within 24 hours |
| **Warning** | Balance < $5,000 OR < 80% of required reserve | WARNING alert, plan transfer within 48 hours |
| **Healthy** | Balance ≥ $10,000 AND ≥ 100% of required reserve | No alerts, continue normal operations |

### How to Respond to Alerts

#### Critical Balance Alert

**Email Subject:** `[CRITICAL] Critical: Platform Balance Below Minimum Threshold`

**Immediate Actions:**

1. **Transfer Funds to Stripe Account**
   ```bash
   # Log into Stripe Dashboard
   # Go to Balance → Add funds to balance
   # Transfer enough to bring above $10,000 + pending obligations
   ```

2. **Review Pending Payouts**
   - Check `/admin/payouts` for pending payout queue
   - Consider delaying non-urgent payouts if needed

3. **Check for Unusual Activity**
   - Review recent refunds/chargebacks in Stripe
   - Check for suspicious payout requests

4. **Notify Finance Team**
   - Alert stakeholders about low balance situation
   - Request emergency fund transfer if needed

#### Warning Balance Alert

**Email Subject:** `[WARNING] Warning: Platform Balance Below Recommended Level`

**Planned Actions:**

1. **Schedule Fund Transfer** (within 48 hours)
2. **Monitor Daily** until balance returns to healthy
3. **Review Upcoming Payout Schedule**
4. **Prepare Contingency Plans**

#### Depletion Risk Alert

**Email Subject:** `Risk: Platform Balance May Deplete in X Days`

**Actions:**

1. **Calculate Required Amount**: Check email for shortfall details
2. **Plan Transfer**: Schedule before depletion date
3. **Monitor Closely**: Check balance every 4-8 hours
4. **Consider Payout Holds**: For non-urgent cases if situation critical

### Balance Status Response

The cron job returns detailed status information:

```json
{
  "success": true,
  "data": {
    "balanceStatus": {
      "thresholdStatus": "healthy",
      "availableBalance": 2500000,        // $25,000 in cents
      "pendingObligations": 1500000,      // $15,000 in cents
      "requiredReserve": 1800000,         // $18,000 (120% of obligations)
      "availableForPayouts": 700000,      // $7,000 available after reserve
      "daysOfCoverage": 45,               // Estimated days until depletion
      "isHealthy": true,
      "isWarning": false,
      "isCritical": false
    },
    "alerts": [],
    "alertsCreated": 0,
    "trend": {
      "direction": "stable",
      "averageChange": 15000              // +$150/day average
    }
  }
}
```

### Balance Snapshots

The system records daily snapshots in `platformBalanceSnapshots` collection for trend analysis:

```typescript
{
  id: "snapshot_1703865600000",
  timestamp: Timestamp,
  availableBalance: 2500000,
  pendingBalance: 500000,
  totalBalance: 3000000,
  pendingObligations: 1500000,
  requiredReserve: 1800000,
  thresholdStatus: "healthy",
  metadata: {
    usersWithUnpaidEarnings: 42,
    usersWithoutBankAccounts: 8,
    daysSinceLastSnapshot: 1
  }
}
```

**Trend Analysis:**

The system analyzes the last 7 days of snapshots to detect:

- **Increasing**: Balance growing by >$1,000/day
- **Stable**: Balance change <±$1,000/day
- **Decreasing**: Balance declining by >$1,000/day

Negative trends trigger additional alerts if declining by >$1,000/day.

---

## 6. Payout Limits & Fraud Protection

### Config File with All Limits

**File:** `/app/config/payoutLimits.ts`

**SINGLE SOURCE OF TRUTH** for all payout limits and fraud protection thresholds.

```typescript
export const PAYOUT_LIMITS = {
  // Per-Transaction Limits
  MAX_SINGLE_PAYOUT: 10000_00,         // $10,000 max per transaction

  // Velocity Limits (Fraud Protection)
  MAX_PAYOUTS_PER_DAY: 3,              // Max 3 payout requests per 24 hours
  MAX_DAILY_AMOUNT: 25000_00,          // $25,000 max per rolling 24-hour period
  MAX_MONTHLY_AMOUNT: 100000_00,       // $100,000 max per calendar month

  // New Account Limits
  NEW_ACCOUNT_MAX_PAYOUT: 1000_00,     // $1,000 max for new accounts
  NEW_ACCOUNT_DAYS: 30,                 // Account age threshold (days)

  // Admin Approval Thresholds
  REQUIRE_APPROVAL_AMOUNT: 5000_00,    // Require admin approval > $5,000

  // Rate Limiting
  MIN_TIME_BETWEEN_PAYOUTS: 300,       // 5 minutes minimum between requests

  // Suspicious Activity Thresholds
  SUSPICIOUS_PATTERN_THRESHOLD: 5,      // Flag if 5+ payouts in 24 hours
  SUSPICIOUS_AMOUNT_RATIO: 0.8,         // Flag if single payout > 80% of lifetime earnings
};
```

### Validation Flow

**Service:** `/app/services/payoutLimitService.ts`

#### Complete Validation Sequence

```typescript
const validation = await PayoutLimitService.validatePayoutLimits(userId, amountCents);

if (!validation.allowed) {
  return { error: validation.reason };
}

if (validation.requiresApproval) {
  // Create approval request and hold payout
  await PayoutLimitService.createApprovalRequest(
    payoutId,
    userId,
    amountCents,
    validation.flags,
    validation.metadata
  );
}
```

#### Validation Checks (In Order)

1. **Single Transaction Limit**
   - Reject if amount > $10,000
   - Hard limit, no exceptions

2. **Admin Approval Threshold**
   - Flag if amount > $5,000
   - Requires manual approval before processing

3. **New Account Restrictions**
   - Check account age < 30 days
   - Limit to $1,000 per transaction
   - Helps prevent fraud on fresh accounts

4. **Daily Payout Count Limit**
   - Count payouts in last 24 hours
   - Reject if ≥ 3 payouts already
   - Prevents rapid-fire withdrawal attempts

5. **Daily Amount Limit**
   - Sum payouts in last 24 hours
   - Reject if total would exceed $25,000
   - Rolling 24-hour window

6. **Monthly Amount Limit**
   - Sum payouts in current calendar month
   - Reject if total would exceed $100,000
   - Resets on 1st of each month

7. **Suspicious Pattern Detection**
   - Excessive frequency (5+ payouts in 24h)
   - Large percentage of lifetime earnings (>80%)
   - First payout unusually large (>$2,000)
   - Auto-flags for admin approval

#### Validation Result Structure

```typescript
{
  allowed: true,                    // Can proceed with payout
  requiresApproval: true,           // Needs admin review
  flags: [
    'REQUIRES_ADMIN_APPROVAL',
    'NEW_ACCOUNT'
  ],
  metadata: {
    isNewAccount: true,
    accountAgeDays: 15,
    dailyPayoutCount: 1,
    dailyPayoutAmount: 500000,      // $5,000 in cents
    monthlyPayoutAmount: 800000     // $8,000 in cents
  }
}
```

### Admin Approval Workflow

See [Section 7: Admin Approval Workflow](#7-admin-approval-workflow) for detailed information.

---

## 7. Admin Approval Workflow

### When Payouts Require Approval

Payouts are automatically flagged for admin approval when:

1. **Amount-Based**
   - Amount > $5,000 (configurable in `PAYOUT_LIMITS.REQUIRE_APPROVAL_AMOUNT`)

2. **Pattern-Based**
   - 5+ payout requests in 24 hours
   - Single payout > 80% of user's lifetime earnings
   - First payout > $2,000 for new users

3. **Account-Based**
   - New accounts (<30 days) requesting large payouts
   - Accounts with recent refunds/disputes

### Approval Queue Collection

**Firestore Collection:** `payoutApprovalQueue`

**Document Structure:**

```typescript
{
  id: "approval_payout_ABC123",
  payoutId: "payout_ABC123",
  userId: "user123",
  amountCents: 750000,                    // $7,500
  requestedAt: Timestamp,
  status: "pending",                      // pending | approved | rejected
  reason: "Amount exceeds $5,000; New account (15 days old)",
  flags: [
    "REQUIRES_ADMIN_APPROVAL",
    "NEW_ACCOUNT"
  ],
  metadata: {
    isNewAccount: true,
    accountAgeDays: 15,
    dailyPayoutCount: 1,
    dailyPayoutAmount: 750000
  },
  reviewedAt?: Timestamp,
  reviewedBy?: "adminUserId",
  reviewNotes?: "Verified user's identity and earnings source",
  createdAt: Timestamp
}
```

### Admin Notification

When an approval request is created, all admin users receive notifications:

```typescript
await createNotification({
  userId: adminId,
  type: 'payout_approval_required',
  title: 'Payout Approval Required',
  message: 'A payout of $7,500 requires your review. Reason: Amount exceeds $5,000',
  metadata: {
    approvalId: 'approval_payout_ABC123',
    payoutId: 'payout_ABC123',
    amountCents: 750000,
    flags: ['REQUIRES_ADMIN_APPROVAL']
  },
  criticality: 'high'
});
```

### API Endpoints for Approving/Rejecting

#### Approve/Reject Endpoint

**File:** `/app/api/admin/payout-approval/route.ts`

**Method:** POST

**Authentication:** Requires admin JWT token with `admin: true` claim

**Request Body:**

```typescript
{
  approvalId: "approval_payout_ABC123",
  action: "approve" | "reject",
  notes?: "Optional admin notes"
}
```

**Approve Example:**

```bash
curl -X POST https://www.getwewrite.app/api/admin/payout-approval \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "approvalId": "approval_payout_ABC123",
    "action": "approve",
    "notes": "Verified user identity and earnings source"
  }'
```

**Response (Approve):**

```json
{
  "success": true,
  "message": "Payout approved and processed successfully",
  "transferId": "tr_1ABC2DEF3GHI4JKL"
}
```

**Reject Example:**

```bash
curl -X POST https://www.getwewrite.app/api/admin/payout-approval \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "approvalId": "approval_payout_ABC123",
    "action": "reject",
    "notes": "Suspicious activity detected - requires further verification"
  }'
```

**Response (Reject):**

```json
{
  "success": true,
  "message": "Payout rejected successfully"
}
```

### Approval Workflow

#### When Admin Approves:

1. **Update Approval Record**
   ```typescript
   status: 'approved',
   reviewedAt: serverTimestamp(),
   reviewedBy: adminUserId,
   reviewNotes: "Admin notes here"
   ```

2. **Update Payout Record**
   ```typescript
   status: 'pending',
   approvalRequired: false
   ```

3. **Process Payout Immediately**
   ```typescript
   const result = await PayoutService.processPayout(payoutId);
   ```

4. **Notify User**
   ```typescript
   await sendUserNotification(userId, {
     type: 'payout_approved',
     title: 'Payout Approved',
     body: 'Your payout of $7,500 has been approved and is being processed.'
   });
   ```

#### When Admin Rejects:

1. **Update Approval Record**
   ```typescript
   status: 'rejected',
   reviewedAt: serverTimestamp(),
   reviewedBy: adminUserId,
   reviewNotes: "Rejection reason"
   ```

2. **Mark Payout as Failed**
   ```typescript
   status: 'failed',
   failureReason: 'Rejected by admin: [reason]',
   completedAt: serverTimestamp()
   ```

3. **Notify User**
   ```typescript
   await sendUserNotification(userId, {
     type: 'payout_rejected',
     title: 'Payout Rejected',
     body: 'Your payout of $7,500 has been rejected. Reason: [admin notes]'
   });
   ```

### Admin Dashboard Integration

**Recommended UI Components:**

1. **Approval Queue Table**
   - Show pending approvals with user info, amount, flags
   - Sort by request date (oldest first)
   - Filter by amount, flags, status

2. **User Context Panel**
   - User's account age
   - Lifetime earnings
   - Payout history
   - Recent refunds/disputes

3. **Quick Actions**
   - Approve button (green)
   - Reject button (red)
   - View user profile link
   - View payout details link

4. **Notes Field**
   - Required for rejections
   - Optional for approvals
   - Stored in approval record

**Query for Pending Approvals:**

```typescript
const approvals = await getDocs(
  query(
    collection(db, 'payoutApprovalQueue'),
    where('status', '==', 'pending'),
    orderBy('requestedAt', 'asc')
  )
);
```

---

## 8. Testing Recommendations

### How to Test Each Component

#### 1. Webhook Handlers

**Using Stripe CLI (Local Development):**

```bash
# Terminal 1: Start your dev server
npm run dev

# Terminal 2: Forward webhooks to local endpoint
stripe listen --forward-to localhost:3000/api/webhooks/stripe-payouts

# Terminal 3: Trigger test events
stripe trigger transfer.created
stripe trigger transfer.paid
stripe trigger transfer.failed

# Check your terminal for webhook logs
# Check Firestore for audit log entries
```

**Testing Specific Scenarios:**

```bash
# Test successful payout flow
stripe trigger transfer.created
stripe trigger transfer.paid

# Test failed payout with retry
stripe trigger transfer.failed

# Test account status updates
stripe trigger account.updated
```

#### 2. Idempotency Layer

**Test Duplicate Events:**

```bash
# Send same event twice (should be deduplicated)
EVENT_ID="evt_test_123456"

# First request - should process
curl -X POST http://localhost:3000/api/webhooks/stripe-payouts \
  -H "Content-Type: application/json" \
  -d '{"id":"'$EVENT_ID'","type":"transfer.paid","data":{}}'

# Second request - should return duplicate:true
curl -X POST http://localhost:3000/api/webhooks/stripe-payouts \
  -H "Content-Type: application/json" \
  -d '{"id":"'$EVENT_ID'","type":"transfer.paid","data":{}}'
```

**Verify in Firestore:**

```javascript
// Check processedWebhookEvents collection
// Event should exist with status: 'completed'
// Second request should not create duplicate processing
```

#### 3. Balance Monitoring

**Manual Trigger:**

```bash
# Trigger balance check manually
curl -X POST https://www.getwewrite.app/api/cron/platform-balance-check \
  -H "Authorization: Bearer ${CRON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "createSnapshot": true,
    "checkTrend": true
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "balanceStatus": {
      "thresholdStatus": "healthy",
      "availableBalance": 2500000,
      "daysOfCoverage": 45
    },
    "trend": {
      "direction": "stable",
      "averageChange": 15000
    }
  }
}
```

**Test Alert Scenarios:**

```bash
# Temporarily modify BALANCE_THRESHOLDS to trigger alerts
# Set CRITICAL to a very high value (e.g., $100,000)
# Run balance check
# Verify critical alert created in criticalAlerts collection
# Verify email sent to admin
```

#### 4. Payout Limits

**Test Validation:**

```typescript
// Test in your app or via API
const testCases = [
  { userId: 'user123', amount: 10001_00, expected: 'EXCEEDS_SINGLE_LIMIT' },
  { userId: 'user123', amount: 6000_00, expected: 'REQUIRES_ADMIN_APPROVAL' },
  { userId: 'newUser', amount: 1500_00, expected: 'EXCEEDS_NEW_ACCOUNT_LIMIT' },
];

for (const test of testCases) {
  const result = await PayoutLimitService.validatePayoutLimits(
    test.userId,
    test.amount
  );
  console.log(`Amount: $${test.amount/100}, Result:`, result);
}
```

#### 5. Refund/Dispute Handling

**Test Refund Flow:**

```bash
# Create a test subscription payment
# Process refund through Stripe Dashboard
# Trigger webhook
stripe trigger charge.refunded

# Verify:
# - User's allocations reduced proportionally
# - USD balance updated
# - Audit log created
# - Critical alert created
```

**Test Dispute Flow:**

```bash
# Create dispute
stripe trigger charge.dispute.created

# Verify:
# - All allocations marked as 'disputed'
# - Frozen amounts recorded
# - Critical alert created
# - Admin notified

# Resolve dispute (won)
stripe trigger charge.dispute.closed --override status=won

# Verify:
# - Allocations unfrozen
# - Status changed to 'active'
# - User notified

# Or resolve dispute (lost) - different override
stripe trigger charge.dispute.closed --override status=lost

# Verify:
# - Allocations marked as 'refunded'
# - Amounts set to 0
# - Balance reset
```

### Test Scenarios

#### Scenario 1: Normal Payout Flow

1. User requests payout ($1,000)
2. Passes all validation checks
3. Transfer created in Stripe
4. `transfer.created` webhook received
5. Audit log created
6. Transfer processes successfully
7. `transfer.paid` webhook received
8. Payout marked as completed
9. User receives notification

**Expected Time:** 2-3 business days for bank arrival

#### Scenario 2: Failed Payout with Retry

1. User requests payout ($500)
2. Transfer created
3. Transfer fails (insufficient_funds)
4. `transfer.failed` webhook received
5. System schedules retry (5 minutes)
6. Retry attempt 1 (5 min delay)
7. Still fails, schedules retry 2 (10 min delay)
8. Retry attempt 2 succeeds
9. `transfer.paid` webhook received
10. Payout completed

**Expected Time:** 15-20 minutes total

#### Scenario 3: High-Value Payout Requiring Approval

1. User requests payout ($7,500)
2. Validation flags for admin approval
3. Approval request created
4. Payout status set to `pending_approval`
5. Admin receives notification
6. Admin reviews and approves
7. Payout immediately processed
8. `transfer.paid` webhook
9. User notified of approval + completion

**Expected Time:** Depends on admin response time

#### Scenario 4: Dispute Freezes Allocations

1. User has $500 in active allocations
2. Customer files dispute for $20 subscription payment
3. `charge.dispute.created` webhook received
4. All allocations frozen (status: 'disputed')
5. Admin receives critical alert
6. User receives notification
7. After investigation, dispute won
8. `charge.dispute.closed` webhook received
9. Allocations unfrozen
10. User can request payouts again

**Expected Time:** 1-2 weeks for dispute resolution

---

## 9. Stripe Dashboard Configuration

### Webhook Endpoints to Configure

You need to configure TWO separate webhook endpoints in Stripe:

#### 1. Payout Webhook

**URL:** `https://www.getwewrite.app/api/webhooks/stripe-payouts`

**Description:** WeWrite Payout Webhook - Transfer and Account Events

**Events to Enable:**

```
transfer.created
transfer.paid
transfer.failed
transfer.reversed
payout.created
payout.paid
payout.failed
account.updated
```

**Configuration Steps:**

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter endpoint URL
4. Select events listed above
5. Click "Add endpoint"
6. **Copy the webhook signing secret** (starts with `whsec_`)
7. Add to environment variables as `STRIPE_WEBHOOK_SECRET_PAYOUTS`

#### 2. Subscription Webhook (Refund/Dispute Events)

**URL:** `https://www.getwewrite.app/api/webhooks/stripe-subscription`

**Description:** WeWrite Subscription Webhook - Payment and Subscription Events

**Events to Enable:**

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
charge.refunded
charge.dispute.created
charge.dispute.closed
```

**Configuration Steps:**

Same as above, but use `STRIPE_WEBHOOK_SECRET` for the environment variable.

### Automated Setup Script

**File:** `/scripts/setup-payout-webhooks.js`

This Node.js script automates webhook endpoint creation:

```bash
# Set environment variables
export STRIPE_SECRET_KEY=sk_test_...
export NEXT_PUBLIC_APP_URL=https://www.getwewrite.app

# Run setup script
node scripts/setup-payout-webhooks.js
```

**Script Output:**

```
🎯 WeWrite Payout Webhook Setup
================================

📍 Base URL: https://www.getwewrite.app
🔑 Stripe Key: sk_test_51ABC...

🏥 Testing webhook endpoint health...
✅ https://www.getwewrite.app/api/webhooks/stripe-payouts is healthy!
✅ https://www.getwewrite.app/api/webhooks/stripe-subscription is healthy!

📋 Listing existing webhook endpoints...

🚀 Creating payout webhook endpoint...
✅ Payout webhook created successfully!
   ID: we_1ABC2DEF3GHI4JKL
   URL: https://www.getwewrite.app/api/webhooks/stripe-payouts
   Secret: whsec_ABC123DEF456...
   Events: 8 events configured

🔑 ENVIRONMENT VARIABLES NEEDED:
================================

Add this to your .env.local file:
STRIPE_WEBHOOK_SECRET_PAYOUTS=whsec_ABC123DEF456...

🎉 Webhook setup complete!
```

### Environment Variables Needed

Add these to your `.env.local` (development) and Vercel environment variables (production):

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_live_...              # Your Stripe secret key
STRIPE_PUBLISHABLE_KEY=pk_live_...         # Your Stripe publishable key

# Webhook Secrets (from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...            # Subscription webhook secret
STRIPE_WEBHOOK_SECRET_PAYOUTS=whsec_...    # Payout webhook secret

# Cron Job Authentication
CRON_SECRET=...                             # Vercel sets this automatically
CRON_API_KEY=...                            # Optional custom key for manual triggers

# App Configuration
NEXT_PUBLIC_APP_URL=https://www.getwewrite.app
```

**Vercel Environment Variable Setup:**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable with appropriate scope (Production, Preview, Development)
3. Redeploy to apply changes

### Testing Webhook Endpoints

**Health Check:**

```bash
# Both endpoints have GET health check
curl https://www.getwewrite.app/api/webhooks/stripe-payouts
# Expected: {"status":"ok","service":"stripe-payouts-webhook","timestamp":"..."}

curl https://www.getwewrite.app/api/webhooks/stripe-subscription
# Expected: {"status":"ok","service":"stripe-subscription-webhook","timestamp":"..."}
```

**Webhook Event Testing:**

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click on your webhook endpoint
3. Click "Send test webhook"
4. Select event type (e.g., `transfer.paid`)
5. Click "Send test webhook"
6. Verify in your logs that event was received and processed

---

## 10. Monitoring & Alerting

### What to Monitor

#### 1. Webhook Processing

**Metrics to Track:**

- Total webhooks received (by type)
- Processing success rate
- Processing failures and errors
- Duplicate events detected
- Average processing time

**Firestore Collections:**

- `processedWebhookEvents` - All webhook events
- `payoutAuditLogs` - Payout-specific audit trail

**Queries:**

```typescript
// Get webhook processing statistics
const stats = await webhookIdempotencyService.getStatistics();
console.log('Webhook Stats:', stats);
// { total: 150, processing: 2, completed: 145, failed: 3 }

// Get recent failed events
const failedEvents = await getDocs(
  query(
    collection(db, 'processedWebhookEvents'),
    where('status', '==', 'failed'),
    orderBy('processedAt', 'desc'),
    limit(20)
  )
);
```

#### 2. Platform Balance

**Metrics to Track:**

- Current available balance
- Pending obligations
- Days of coverage
- Threshold status
- Balance trend (increasing/decreasing)

**Firestore Collections:**

- `platformBalanceSnapshots` - Daily balance snapshots
- `criticalAlerts` - Balance alerts

**Daily Monitoring:**

The cron job runs daily at 6am UTC and:
- Records balance snapshot
- Checks threshold status
- Creates alerts if needed
- Sends email for critical issues

**Manual Check:**

```bash
curl -X POST https://www.getwewrite.app/api/cron/platform-balance-check \
  -H "Authorization: Bearer ${CRON_API_KEY}"
```

#### 3. Payout Approvals

**Metrics to Track:**

- Pending approval count
- Average approval time
- Approval/rejection ratio
- Flags distribution

**Firestore Collection:**

- `payoutApprovalQueue`

**Query:**

```typescript
// Get pending approvals
const pending = await getDocs(
  query(
    collection(db, 'payoutApprovalQueue'),
    where('status', '==', 'pending'),
    orderBy('requestedAt', 'asc')
  )
);

console.log(`${pending.size} payouts awaiting approval`);
```

#### 4. Refunds & Disputes

**Metrics to Track:**

- Refund count and total amount
- Dispute count and status
- Allocations frozen/unfrozen
- Dispute win/loss ratio

**Firestore Collection:**

- `criticalAlerts` (filtered by type)

**Query:**

```typescript
// Get recent refund/dispute alerts
const alerts = await getDocs(
  query(
    collection(db, 'criticalAlerts'),
    where('type', 'in', ['dispute_created', 'dispute_closed', 'refund_processed']),
    orderBy('timestamp', 'desc'),
    limit(50)
  )
);
```

### Where Alerts Appear

#### 1. Email Notifications

**Critical balance alerts** are sent to admin email:

- To: `Emails.support` (configured in `urlConfig.ts`)
- Subject: `[CRITICAL] Critical: Platform Balance Below Minimum Threshold`
- Body: Detailed balance info + recommended actions
- CTA: Link to admin dashboard

**Configuration:**

```typescript
// In platformBalanceMonitoringService.ts
await sendNotificationEmail({
  to: Emails.support,
  subject: `[CRITICAL] ${alert.title}`,
  heading: alert.title,
  body: alert.description + '\n\n' + actions,
  ctaText: 'View Admin Dashboard',
  ctaUrl: 'https://www.getwewrite.app/admin/balance'
});
```

#### 2. Firestore Collections

**Critical Alerts Collection:**

```typescript
// criticalAlerts collection structure
{
  id: "balance_alert_1703865600000",
  type: "critical_balance",
  severity: "critical",
  title: "Critical: Platform Balance Below Minimum Threshold",
  description: "Platform balance ($950) is critically low...",
  data: {
    thresholdStatus: "critical",
    currentBalance: 95000,
    requiredReserve: 120000,
    shortfall: 25000,
    recommendedActions: [...]
  },
  createdAt: Timestamp,
  status: "active",
  acknowledgedAt: null,
  resolvedAt: null
}
```

#### 3. Admin Dashboard

**Recommended Sections:**

1. **Critical Alerts Panel** (homepage)
   - Red banner for critical alerts
   - Count of unresolved alerts
   - Quick link to alert details

2. **Balance Monitor Page** (`/admin/balance`)
   - Current balance status
   - Threshold indicator (green/yellow/red)
   - Days of coverage
   - Recent snapshots (chart)
   - Trend analysis

3. **Payout Approvals Page** (`/admin/payout-approvals`)
   - Pending approval queue
   - User context panel
   - Approve/reject actions

4. **Webhook Status Page** (`/admin/webhooks`)
   - Recent webhook events
   - Processing statistics
   - Failed events with retry option

#### 4. In-App Notifications

**Admin users** receive notifications for:

- Payout approvals required
- Critical balance alerts
- Disputes created/resolved
- Large refunds processed

**User notifications** for:

- Payout completed
- Payout failed
- Payout approved/rejected
- Account verification needed
- Dispute created/resolved

### Escalation Procedures

#### Level 1: Automated Response

**Triggers:**
- Warning balance alerts
- Non-critical payout failures
- Suspicious activity flags

**Actions:**
- Create alert in Firestore
- Log to audit trail
- Monitor for 24-48 hours

#### Level 2: Admin Notification

**Triggers:**
- Critical balance alerts
- Multiple payout failures
- Disputes created
- Large refunds (>$100)

**Actions:**
- Send email to admin team
- Create critical alert
- Block affected payouts if needed

#### Level 3: Immediate Intervention

**Triggers:**
- Balance depleted
- Platform unable to process payouts
- Multiple disputes in short period
- Potential fraud detected

**Actions:**
- Send urgent email/SMS to stakeholders
- Halt all automated payouts
- Manual review required
- Emergency fund transfer needed

**Escalation Contact:**

```
Level 1: Automated → Logged
Level 2: Admin Team (Emails.support)
Level 3: Finance + Engineering Leads
```

---

## 11. Files Changed/Created Summary

### New Files Created

#### Services

1. `/app/services/webhookIdempotencyService.ts`
   - Webhook deduplication service
   - 328 lines
   - Firestore-based idempotency checking

2. `/app/services/balanceMonitoringService.ts`
   - Real-time balance monitoring (DEPRECATED - use platformBalanceMonitoringService)
   - 382 lines
   - Stripe balance vs obligations

3. `/app/services/platformBalanceMonitoringService.ts`
   - Enhanced balance monitoring service
   - 500 lines
   - Alert creation, snapshot recording, trend analysis

4. `/app/services/payoutLimitService.ts`
   - Payout validation and fraud protection
   - 606 lines
   - Multi-level limit checking

#### Configuration

5. `/app/config/payoutLimits.ts`
   - Centralized payout limit configuration
   - 125 lines
   - Single source of truth for all limits

#### API Routes

6. `/app/api/webhooks/stripe-payouts/route.ts`
   - Payout webhook handler
   - 625 lines
   - Handles 7 different event types

7. `/app/api/cron/platform-balance-check/route.ts`
   - Daily balance monitoring cron job
   - 312 lines
   - Automated alert creation

8. `/app/api/admin/payout-approval/route.ts`
   - Admin approval/rejection endpoint
   - 184 lines
   - Secure admin-only access

#### Scripts

9. `/scripts/setup-payout-webhooks.js`
   - Automated webhook setup script
   - 309 lines
   - Node.js CLI tool

#### Types

10. `/app/types/payout.ts`
    - TypeScript type definitions
    - Payout-related interfaces

#### Tests

11. `/app/tests/payout-system.test.ts`
    - Payout system test suite
    - Unit and integration tests

12. `/app/tests/payoutSystem.test.ts`
    - Additional payout tests
    - Edge case coverage

### Modified Files

#### Webhook Handlers

13. `/app/api/webhooks/stripe-subscription/route.ts`
    - Added refund handler (`handleChargeRefunded`)
    - Added dispute handlers (`handleDisputeCreated`, `handleDisputeClosed`)
    - Integrated webhookIdempotencyService
    - ~200 lines added

#### Payout Services

14. `/app/services/payoutService.ts`
    - Integrated payout limit validation
    - Added approval workflow support
    - Enhanced error handling

15. `/app/services/payoutNotificationService.ts`
    - New notification types (approval, rejection, retry)

16. `/app/services/payoutMonitoringService.ts`
    - Enhanced monitoring capabilities
    - Integration with balance service

17. `/app/services/payoutErrorLogger.ts`
    - More detailed error logging
    - Integration with audit trails

18. `/app/services/payoutSchedulerService.ts`
    - Retry scheduling logic
    - Exponential backoff implementation

19. `/app/services/payoutRetryService.ts`
    - Enhanced retry logic
    - Integration with webhook events

20. `/app/services/payoutStatusService.ts`
    - Additional status types (pending_approval, disputed)
    - Status transition validation

### File Statistics

**Total New Files:** 12
**Total Modified Files:** 8
**Total Lines of Code Added:** ~4,500

**Language Breakdown:**
- TypeScript: ~4,200 lines
- JavaScript: ~300 lines (setup script)

**Code Organization:**
- Services: 6 new files
- API Routes: 3 new files
- Configuration: 1 new file
- Scripts: 1 new file
- Types: 1 new file

### Firestore Collections Added

1. `processedWebhookEvents` - Webhook idempotency tracking
2. `payoutApprovalQueue` - Pending approval requests
3. `platformBalanceSnapshots` - Daily balance snapshots
4. `criticalAlerts` - System-wide alerts (already existed, enhanced)
5. `payoutBlockedAttempts` - Fraud prevention audit log

### Firestore Collections Modified

1. `usdPayouts` - Added new fields:
   - `approvalRequired: boolean`
   - `retryCount: number`
   - `nextRetryAt: Timestamp`
   - `failureCode: string`
   - `webhookProcessedAt: Timestamp`

2. `usdAllocations` - Added dispute-related fields:
   - `status: 'disputed' | 'refunded'`
   - `disputeId: string`
   - `disputedAt: string`
   - `frozenAmount: number`
   - `disputeResolvedAt: string`
   - `disputeOutcome: 'won' | 'lost'`

3. `payoutAuditLogs` - Enhanced with more event types

4. `users` - Added Stripe account status tracking:
   - `stripeAccountStatus: object`

---

## Appendix

### Quick Reference Commands

```bash
# Test webhook locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe-payouts

# Trigger test events
stripe trigger transfer.paid
stripe trigger transfer.failed

# Check balance status
curl -X POST https://www.getwewrite.app/api/cron/platform-balance-check \
  -H "Authorization: Bearer ${CRON_API_KEY}"

# Approve a payout (admin)
curl -X POST https://www.getwewrite.app/api/admin/payout-approval \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"approvalId":"approval_XXX","action":"approve"}'

# Setup webhooks
node scripts/setup-payout-webhooks.js
```

### Environment Variables Checklist

```bash
# Required for production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_WEBHOOK_SECRET_PAYOUTS=whsec_...
CRON_SECRET=... # Set by Vercel
NEXT_PUBLIC_APP_URL=https://www.getwewrite.app

# Optional
CRON_API_KEY=... # For manual cron triggers
```

### Useful Firestore Queries

```typescript
// Get pending approvals
const approvals = await getDocs(
  query(
    collection(db, 'payoutApprovalQueue'),
    where('status', '==', 'pending')
  )
);

// Get recent balance snapshots
const snapshots = await getDocs(
  query(
    collection(db, 'platformBalanceSnapshots'),
    orderBy('timestamp', 'desc'),
    limit(30)
  )
);

// Get failed webhooks
const failed = await getDocs(
  query(
    collection(db, 'processedWebhookEvents'),
    where('status', '==', 'failed')
  )
);

// Get active disputes
const disputes = await getDocs(
  query(
    collection(db, 'criticalAlerts'),
    where('type', '==', 'dispute_created'),
    where('status', '==', 'active')
  )
);
```

### Troubleshooting

**Webhook not receiving events:**
1. Check Stripe Dashboard → Webhooks → Event logs
2. Verify endpoint URL is correct
3. Check webhook signing secret matches env var
4. Test with `stripe trigger` command

**Balance alerts not triggering:**
1. Verify cron job is scheduled in Vercel
2. Check `CRON_SECRET` is set
3. Manually trigger: POST to `/api/cron/platform-balance-check`
4. Check Firestore for balance snapshots

**Payouts stuck in pending_approval:**
1. Check `payoutApprovalQueue` for the approval record
2. Verify admin was notified
3. Use admin approval endpoint to approve/reject
4. Check admin token has `admin: true` claim

**Idempotency not working (duplicates):**
1. Check `processedWebhookEvents` collection exists
2. Verify Firestore indexes are created
3. Check event IDs are being passed correctly
4. Review logs for atomic operation failures

---

**Document Prepared By:** Claude (Anthropic AI)
**Review Status:** Ready for Technical Review
**Next Steps:**
1. Technical review by engineering team
2. Security review of admin endpoints
3. Load testing of webhook handlers
4. Finalize monitoring dashboards
5. Production deployment checklist

---

*This document serves as the master reference for the Payout System V2 implementation. Keep it updated as the system evolves.*
