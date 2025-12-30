# Payout Limits and Fraud Protection System

**Status:** ✅ Implemented
**Last Updated:** 2025-12-29

## Overview

WeWrite's payout limits system provides comprehensive fraud protection and risk management for writer payouts. The system enforces multiple layers of limits, detects suspicious activity patterns, and implements an admin approval workflow for high-risk transactions.

## Architecture

### Core Components

1. **Configuration** (`/app/config/payoutLimits.ts`)
   - Single source of truth for all payout limits
   - Fraud protection thresholds
   - Error messages and helper functions

2. **Validation Service** (`/app/services/payoutLimitService.ts`)
   - Validates payout requests against all limits
   - Detects suspicious activity patterns
   - Creates admin approval requests
   - Logs blocked attempts

3. **Payout Service Integration** (`/app/services/payoutService.ts`)
   - Integrates limit validation into payout flow
   - Handles approval workflow
   - Updates payout status based on validation

4. **Admin API Routes**
   - `/api/admin/payout-approvals` - List pending approvals (GET)
   - `/api/admin/payout-approval` - Approve/reject payouts (POST)

### Database Collections

- `payoutApprovalQueue` - Pending admin approval requests
- `payoutBlockedAttempts` - Audit log of blocked payout attempts
- `usdPayouts` - Enhanced with approval fields

## Limit Types

### 1. Per-Transaction Limits

```typescript
MAX_SINGLE_PAYOUT: $10,000
```

**Purpose:** Prevent single large fraudulent payouts
**Enforcement:** Hard limit, request is rejected immediately

### 2. Velocity Limits

```typescript
MAX_PAYOUTS_PER_DAY: 3 payouts
MAX_DAILY_AMOUNT: $25,000 (rolling 24-hour period)
MAX_MONTHLY_AMOUNT: $100,000 (calendar month)
```

**Purpose:** Detect suspicious rapid payout patterns
**Enforcement:** Hard limits, requests are rejected if exceeded

### 3. New Account Restrictions

```typescript
NEW_ACCOUNT_MAX_PAYOUT: $1,000
NEW_ACCOUNT_DAYS: 30 days
```

**Purpose:** Limit exposure on unverified accounts
**Enforcement:** Applied to accounts less than 30 days old

### 4. Admin Approval Threshold

```typescript
REQUIRE_APPROVAL_AMOUNT: $5,000
```

**Purpose:** Manual review for high-value transactions
**Enforcement:** Payout status set to 'pending_approval', requires admin action

### 5. Suspicious Activity Detection

```typescript
SUSPICIOUS_PATTERN_THRESHOLD: 5 payouts in 24 hours
SUSPICIOUS_AMOUNT_RATIO: 80% of lifetime earnings
```

**Purpose:** Automatic flagging for potential fraud
**Enforcement:** Triggers admin approval requirement

## Validation Flow

```
User requests payout
        ↓
Check single transaction limit
        ↓
Check admin approval threshold
        ↓
Check new account restrictions
        ↓
Check daily payout count
        ↓
Check daily amount limit
        ↓
Check monthly amount limit
        ↓
Detect suspicious patterns
        ↓
    [Decision]
        ↓
   ┌────┴────┐
   ↓         ↓
Blocked   Allowed
   ↓         ↓
   ↓    Requires approval?
   ↓         ↓
   ↓    ┌────┴────┐
   ↓    ↓         ↓
   ↓   Yes       No
   ↓    ↓         ↓
   ↓  Pending  Process
   ↓  Approval Immediately
   ↓    ↓         ↓
   ↓  Admin    Complete
   ↓  Review
   ↓    ↓
   ↓ Approve/
   ↓  Reject
   ↓
 Log blocked
   attempt
```

## Admin Approval Workflow

### When Approval is Required

1. Payout amount > $5,000
2. Suspicious activity patterns detected
3. Combined threshold triggers

### Approval Process

1. **Payout Request Created**
   - Status: `pending_approval`
   - Approval record created in `payoutApprovalQueue`

2. **Admin Notification**
   - All admin users receive in-app notification
   - Notification includes amount, reason, and flags

3. **Admin Review**
   - Admin reviews payout details
   - Checks user history, flags, and metadata
   - Makes approve/reject decision

4. **Approval Actions**

   **If Approved:**
   - Payout status changed to `pending`
   - Payout processed immediately
   - User notified of approval
   - Funds transferred to bank

   **If Rejected:**
   - Payout status changed to `failed`
   - User notified with reason
   - Funds remain in user's balance

### API Endpoints

#### GET /api/admin/payout-approvals

Get list of payout approval requests.

**Query Parameters:**
- `status` - Filter by status ('pending', 'approved', 'rejected', 'all')
- `limit` - Max results to return (default: 50)

**Response:**
```json
{
  "approvals": [
    {
      "id": "approval_payout_123",
      "payoutId": "payout_123",
      "userId": "user_456",
      "user": {
        "username": "writer123",
        "email": "writer@example.com"
      },
      "amountCents": 600000,
      "status": "pending",
      "reason": "Amount exceeds $5,000; New account (15 days old)",
      "flags": ["REQUIRES_ADMIN_APPROVAL", "NEW_ACCOUNT"],
      "metadata": {
        "isNewAccount": true,
        "accountAgeDays": 15,
        "dailyPayoutCount": 1
      },
      "requestedAt": "2025-12-29T10:30:00Z"
    }
  ],
  "count": 1,
  "pendingCount": 5
}
```

#### POST /api/admin/payout-approval

Approve or reject a payout.

**Request Body:**
```json
{
  "approvalId": "approval_payout_123",
  "action": "approve",
  "notes": "Verified user identity and transaction legitimacy"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payout approved and processed successfully",
  "transferId": "tr_1234567890"
}
```

## Payout Record Schema

### Enhanced Fields

```typescript
interface PayoutRecord {
  id: string;
  userId: string;
  amountCents: number;
  status: 'pending' | 'completed' | 'failed' | 'pending_approval';

  // Approval fields (new)
  approvalRequired?: boolean;
  approvalId?: string;
  approvalFlags?: string[];

  // Existing fields
  stripePayoutId?: string;
  requestedAt: Timestamp;
  completedAt?: Timestamp;
  failureReason?: string;
}
```

### Approval Record Schema

```typescript
interface PayoutApprovalRecord {
  id: string;
  payoutId: string;
  userId: string;
  amountCents: number;
  status: 'pending' | 'approved' | 'rejected';

  reason: string;          // Human-readable reason
  flags: string[];         // Machine-readable flags

  metadata?: {
    isNewAccount?: boolean;
    accountAgeDays?: number;
    dailyPayoutCount?: number;
    dailyPayoutAmount?: number;
    monthlyPayoutAmount?: number;
    suspiciousPatterns?: string[];
  };

  requestedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;     // Admin user ID
  reviewNotes?: string;    // Admin notes
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

## Notification Types

### User Notifications

1. **payout_pending_approval**
   - Sent when payout requires admin review
   - User informed of pending status

2. **payout_approved**
   - Sent when admin approves payout
   - User informed payout is processing

3. **payout_rejected**
   - Sent when admin rejects payout
   - Includes rejection reason

### Admin Notifications

1. **payout_approval_required**
   - Sent to all admin users
   - Includes amount, reason, and flags
   - Criticality: HIGH

## Fraud Detection

### Suspicious Patterns

1. **Excessive Frequency**
   - 5+ payouts in 24 hours
   - Flag: `EXCESSIVE_PAYOUT_FREQUENCY`

2. **Large Percentage of Lifetime Earnings**
   - Single payout > 80% of lifetime earnings
   - Flag: `LARGE_PERCENTAGE_OF_LIFETIME_EARNINGS`

3. **First Payout Unusually Large**
   - First payout > $2,000
   - Flag: `FIRST_PAYOUT_UNUSUALLY_LARGE`

### Audit Logging

All blocked attempts are logged to `payoutBlockedAttempts`:

```typescript
{
  userId: string;
  amountCents: number;
  reason: string;
  flags: string[];
  timestamp: Timestamp;
}
```

## Error Messages

All error messages are user-friendly and informative:

- "Maximum payout amount is $10,000"
- "You can only request 3 payouts per day"
- "Daily payout limit of $25,000 exceeded"
- "Monthly payout limit of $100,000 exceeded"
- "New accounts (< 30 days) are limited to $1,000 per payout"
- "Payouts over $5,000 require admin approval"

## Configuration Management

### Updating Limits

All limits are centralized in `/app/config/payoutLimits.ts`. To update:

1. Modify the `PAYOUT_LIMITS` constant
2. Update corresponding error messages in `PAYOUT_LIMIT_ERRORS`
3. No code changes needed - limits apply immediately

### Helper Functions

```typescript
// Check if amount requires approval
requiresAdminApproval(amountCents: number): boolean

// Check if single transaction limit exceeded
exceedsSingleLimit(amountCents: number): boolean

// Get max payout for account type
getMaxPayoutAmount(isNewAccount: boolean): number

// Format amount for display
formatLimitAmount(amountCents: number): string
```

## Integration Points

### PayoutService Integration

The `PayoutService.requestPayout()` method now includes:

1. Limit validation before creating payout record
2. Blocked attempt logging for rejected requests
3. Approval workflow for flagged payouts
4. User notifications for all outcomes

### Admin Dashboard

Recommended admin UI components:

1. **Pending Approvals Widget**
   - Show count of pending approvals
   - Quick link to approval queue

2. **Approval Queue Page**
   - List of all pending approvals
   - User details, amount, flags, metadata
   - Approve/reject actions with notes

3. **Blocked Attempts Monitor**
   - Real-time view of blocked payout attempts
   - Flag patterns for investigation

## Security Considerations

1. **Admin Authorization**
   - All approval endpoints require admin token
   - Verified via Firebase custom claims

2. **Rate Limiting**
   - Existing 5-minute idempotency check
   - Daily/monthly velocity limits

3. **Audit Trail**
   - All approvals logged with reviewer ID
   - All blocked attempts logged
   - Immutable timestamp records

4. **Data Privacy**
   - Admin notifications don't include sensitive data
   - User notifications are informative but secure

## Testing Scenarios

### Test Cases

1. **Normal Payout (< $5,000)**
   - Should process immediately
   - No approval required

2. **Large Payout (> $5,000)**
   - Should create approval request
   - Admin notification sent
   - User notified of pending status

3. **New Account Payout (> $1,000)**
   - Should be rejected
   - Error message displayed

4. **Daily Limit Exceeded**
   - 4th payout in 24 hours should fail
   - Appropriate error message

5. **Suspicious Pattern**
   - 5+ payouts in 24 hours
   - Should require approval even if under $5,000

6. **Admin Approval**
   - Approve action should process payout
   - User notified and funds transferred

7. **Admin Rejection**
   - Reject action should fail payout
   - User notified with reason

## Monitoring and Alerts

### Metrics to Track

1. Number of blocked attempts per day
2. Number of pending approvals
3. Average approval time
4. Rejection rate
5. Most common flags

### Recommended Alerts

1. Alert if pending approvals > 10
2. Alert if blocked attempts spike
3. Alert if same user has multiple blocked attempts

## Future Enhancements

1. **Machine Learning**
   - Train model on historical fraud patterns
   - Adjust thresholds dynamically

2. **Geographic Risk Scoring**
   - Country-specific limits
   - IP address validation

3. **Behavioral Analysis**
   - User activity patterns
   - Writing quality signals

4. **Automated Approval**
   - Auto-approve trusted users
   - Trust score based on history

5. **Real-time Notifications**
   - Email notifications for admins
   - SMS for critical approvals

## Related Documentation

- [Platform Fee Configuration](/app/config/platformFee.ts)
- [Payout Service](/app/services/payoutService.ts)
- [Admin Claims Service](/app/services/adminClaimsService.ts)
- [Notification System](/app/services/notificationsService.ts)
