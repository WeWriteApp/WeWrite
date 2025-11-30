# WeWrite Payment System Guide

## Overview

WeWrite uses a **USD-based payment system** with Stripe Payments + Storage Balances to keep platform revenue and creator obligations separated and auditable. This guide covers the complete payment architecture, from subscriptions to payouts.

## 🏗️ System Architecture

### Core Components

1. **Subscription Management** - Monthly subscriptions ($10, $20, $30)
2. **USD Allocation System** - Direct USD allocations to creators
3. **Earnings Tracking** - Creator earnings in USD
4. **Payout System** - Bank transfers via Stripe Connect

### Data Flow

```
Subscription → Monthly allocation ledger (ServerUsdService) → Month-end storage/payments balance transfer → Creator earnings → Payouts (platform fee retained in payments balance)
```

## 💰 How Money Flows

### 1) Subscription Payment
- Users pay monthly subscriptions via Stripe Checkout.
- Subscription amount is recorded as a **monthly allocation balance** in `ServerUsdService`; no immediate transfer between Stripe balances is performed at checkout time.
- **Downgrades**: Lower amount is scheduled for the next billing cycle (no refunds). Upgrades collect the delta on the next billing; existing valid payment method is reused to avoid extra friction.

### 2) Month-End Storage/Payments Transfer
- Cron endpoint: `POST /api/cron/storage-balance-processing` (API key protected; supports `?dryRun=true`).
- At month close, we sum allocations for the month:
  - **Allocated funds** → moved from platform payments to **Stripe Storage Balance** (`processMonthlyStorageBalance`).
  - **Unallocated funds** → stay in / move to **Stripe Payments Balance** as platform revenue.
- Metadata on transfers remains labeled for audit.

### 3) USD Allocation / Creator Earnings
- Users allocate their monthly balance to creators throughout the month; tracked per month (`usdAllocations`).
- Allocated amounts roll into creator earnings for that month.
- Earnings start as "pending" and become "available" after month-end processing.

### 4) Payouts
- Payouts are sourced **from Storage Balance** to the creator’s connected account.
- Platform fee: **7%** retained in Payments Balance; Stripe payout fee: $0.25/transfer.
- Minimum payout: $25.00.
- Status tracked: pending → processing → completed.

## 🗄️ Database Schema

### Core Collections

#### `usdBalances` - User Subscription Balances
```typescript
interface UsdBalance {
  userId: string;
  totalUsdCents: number;        // Total subscription amount in cents
  allocatedUsdCents: number;    // Amount allocated to creators
  availableUsdCents: number;    // Amount available to allocate
  monthlyAllocationCents: number; // Monthly subscription amount
  lastAllocationDate: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `usdAllocations` - Monthly Allocations
```typescript
interface UsdAllocation {
  id: string;
  userId: string;              // Who made the allocation
  recipientUserId: string;     // Who receives the allocation
  resourceType: 'page' | 'user';
  resourceId: string;          // Page ID or user ID
  usdCents: number;           // Amount in cents
  month: string;              // YYYY-MM format
  status: 'active' | 'cancelled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `writerUsdBalances` - Creator Earnings Summary
```typescript
interface WriterUsdBalance {
  userId: string;
  totalUsdCentsEarned: number;  // Lifetime earnings
  pendingUsdCents: number;      // Current month (not yet available)
  availableUsdCents: number;    // Available for payout
  paidOutUsdCents: number;      // Already paid out
  lastProcessedMonth: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `writerUsdEarnings` - Detailed Earnings Records
```typescript
interface WriterUsdEarnings {
  id: string;
  userId: string;              // Creator who earned
  month: string;               // YYYY-MM format
  totalUsdCentsReceived: number; // Total earned this month
  status: 'pending' | 'available' | 'paid_out';
  allocations: Array<{
    allocationId: string;
    fromUserId: string;
    resourceType: 'page' | 'user';
    resourceId: string;
    usdCents: number;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 🔄 Monthly Processing

### End-of-Month Workflow

1. **Lock Allocations** - Current month allocations are locked
2. **Calculate Earnings** - Sum allocations per creator
3. **Move Balances** - Month-end storage balance processing moves allocated → Storage Balance and unallocated → Payments Balance (platform revenue)
4. **Update Status** - Move earnings from "pending" to "available"
5. **Process Payouts** - Eligible creators receive automatic payouts

### Automated Processing

- **Triggers**:
  - `/api/cron/storage-balance-processing` (allocated → storage, unallocated → payments; supports `dryRun`)
  - `/api/usd/process-writer-earnings` (earnings availability + payout prep)
- **Authentication**: API key required
- **Dry Run**: Available for testing

## 💳 Payout System

### Eligibility Requirements

- Minimum $25.00 available balance
- Connected Stripe bank account
- Verified identity (Stripe Connect requirements)

### Payout Process

1. Creator requests payout via UI
2. System validates eligibility and amount
3. Platform fee (7%) calculated and retained in Payments Balance
4. Stripe transfer initiated from Storage Balance to creator's bank
5. Status tracked: pending → processing → completed

### Fee Structure

- **Platform Fee**: 7% of gross earnings (retained in Payments Balance)
- **Stripe Fee**: $0.25 per transfer
- **Example**: $100 earnings → $93 after platform fee → $92.75 after Stripe fee

## 🔧 API Endpoints

### User Balance Management
- `GET /api/usd/balance` - Get user's USD balance
- `POST /api/usd/allocate` - Allocate USD to a page
- `POST /api/usd/allocate-user` - Allocate USD to a user

### Creator Earnings
- `GET /api/earnings/user` - Get creator's earnings data
- `POST /api/earnings/user` - Request payout

### Admin/Cron
- `POST /api/cron/storage-balance-processing` - Month-end transfer (allocated → storage, unallocated → payments)
- `POST /api/usd/process-writer-earnings` - Monthly processing
- `GET /api/debug/earnings-status` - Debug earnings status

## 🧪 Testing

### Test Scenarios

1. **Subscription Flow**
   - Create subscription via Stripe Checkout
   - Verify USD balance updates
   - Test allocation to creators

2. **Earnings Flow**
   - Make allocations to test creator
   - Verify earnings appear as "pending"
   - Test monthly processing to move to "available"

3. **Payout Flow**
   - Set up test Stripe Connect account
   - Request payout with sufficient balance
   - Verify bank transfer completion

### Test Data

Use the admin testing infrastructure:
- **PayoutFlowValidator**: `/admin/testing-tools`
- **Test Allocations**: `/api/dev/test-allocation`
- **Debug Endpoints**: `/api/debug/earnings-status`

## 💰 Fund Retention & Storage Balance

### Creator Fund Safety
- **Indefinite Retention**: Creator earnings remain in Storage Balance until bank account is set up
- **No Expiration**: Funds never timeout or move back to platform revenue
- **Accumulation**: Monthly earnings continue to build up in Storage Balance
- **Immediate Access**: All accumulated funds become available once bank account is connected

### Key Distinctions
- **Allocated Funds** (creator earnings) → Stay in Storage Balance forever until paid out
- **Unallocated Funds** (unused subscription) → Move to Payments Balance via "use it or lose it"

## 🚨 Troubleshooting

### Common Issues

1. **Earnings Not Showing**
   - Check field name consistency in API endpoints
   - Verify balance aggregation is running correctly
   - Check for pending vs available status confusion

2. **Payout Failures**
   - Verify Stripe Connect account status
   - Check minimum balance requirements
   - Review platform fee calculations
   - **Note**: Failed payouts due to missing bank accounts leave funds in Storage Balance indefinitely

3. **Allocation Issues**
   - Verify user has sufficient available balance
   - Check for negative balance scenarios
   - Review allocation status (active vs cancelled)

### Debug Tools

- **Earnings Status**: `/api/debug/earnings-status`
- **Admin Dashboard**: Monitor balances and transactions
- **Stripe Dashboard**: Review transfers and account status

## 📚 Related Documentation

- [SUBSCRIPTION_SYSTEM.md](./SUBSCRIPTION_SYSTEM.md) - Detailed subscription architecture
- [PAYOUT_TESTING_INFRASTRUCTURE.md](./PAYOUT_TESTING_INFRASTRUCTURE.md) - Testing procedures
- [WEBHOOK_SETUP_GUIDE.md](./WEBHOOK_SETUP_GUIDE.md) - Stripe webhook configuration
- [PLATFORM_FEE_MANAGEMENT_SYSTEM.md](./PLATFORM_FEE_MANAGEMENT_SYSTEM.md) - Fee configuration

---

**Last Updated**: August 16, 2025  
**Status**: Current - Simplified USD System Active
