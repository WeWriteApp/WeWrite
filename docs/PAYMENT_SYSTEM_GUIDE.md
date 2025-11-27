# WeWrite Payment System Guide

## Overview

WeWrite uses a **simplified USD-based payment system** that enables writers to receive real money from supporters. This guide covers the complete payment architecture, from subscriptions to payouts.

## 🏗️ System Architecture

### Core Components

1. **Subscription Management** - Monthly subscriptions ($10, $20, $30)
2. **USD Allocation System** - Direct USD allocations to creators
3. **Earnings Tracking** - Creator earnings in USD
4. **Payout System** - Bank transfers via Stripe Connect

### Data Flow

```
User Subscription → USD Balance → Allocations → Creator Earnings → Payouts
```

## 💰 How Money Flows

### 1. Subscription Payment
- Users pay monthly subscriptions via Stripe
- Subscription amounts: $10, $20, or $30 per month
- Funds go to WeWrite's Stripe account
- **Downgrades**: By default we schedule the lower amount for the next billing cycle (no immediate proration/credit) to avoid surprise card prompts. An optional “apply now” path can be enabled, but defaults to next-cycle.

### 2. USD Allocation
- Users allocate their subscription funds to creators
- Each dollar allocated goes directly to the creator
- Allocations are tracked monthly

### 3. Creator Earnings
- Creators accumulate USD earnings from allocations
- Earnings start as "pending" (current month)
- At month-end, pending earnings become "available"

### 4. Payouts
- Creators can request payouts of available earnings
- Minimum payout: $25.00
- Platform fee: 10%
- Stripe fee: $0.25 per transfer
- Money goes to creator's connected bank account

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
3. **Update Status** - Move earnings from "pending" to "available"
4. **Process Payouts** - Eligible creators receive automatic payouts
5. **Platform Revenue** - Unallocated funds become platform revenue

### Automated Processing

- **Trigger**: Cron job on 1st of each month
- **Endpoint**: `/api/usd/process-writer-earnings`
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
3. Platform fee (10%) calculated and deducted
4. Stripe transfer initiated to creator's bank
5. Status tracked: pending → processing → completed

### Fee Structure

- **Platform Fee**: 10% of gross earnings
- **Stripe Fee**: $0.25 per transfer
- **Example**: $100 earnings → $90 after platform fee → $89.75 after Stripe fee

## 🔧 API Endpoints

### User Balance Management
- `GET /api/usd/balance` - Get user's USD balance
- `POST /api/usd/allocate` - Allocate USD to a page
- `POST /api/usd/allocate-user` - Allocate USD to a user

### Creator Earnings
- `GET /api/earnings/user` - Get creator's earnings data
- `POST /api/earnings/user` - Request payout

### Admin/Cron
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
