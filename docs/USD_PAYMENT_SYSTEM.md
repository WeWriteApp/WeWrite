# WeWrite USD Payment System

## Overview

WeWrite uses a direct USD payment system that replaced the previous token-based virtual currency. This document provides a comprehensive overview of the USD system architecture, features, and implementation.

## 🎉 System Status

- ✅ **Migration Complete** - All systems now use USD (January 2025)
- ✅ **Production Ready** - USD system is live and operational
- ✅ **Legacy Support** - Token endpoints deprecated with warnings
- ✅ **Data Integrity** - All financial data migrated successfully

## 💰 Core Architecture

### Design Principles

1. **Transparent Pricing** - All amounts displayed in real USD
2. **Direct Payments** - No virtual currency conversion needed
3. **Precision Handling** - USD cents used for accurate calculations
4. **Separation of Concerns** - Dedicated contexts for each data domain
5. **Performance Optimized** - Components only load data they need

### System Components

#### 1. UsdBalanceContext
**Purpose**: Manages user's available spending balance
**File**: `app/contexts/UsdBalanceContext.tsx`
**Features**:
- Real-time balance tracking
- Optimistic updates for allocations
- Automatic refresh on subscription changes
- Caching for performance

#### 2. EarningsContext
**Purpose**: Manages creator earnings and payout data
**File**: `app/contexts/EarningsContext.tsx`
**Features**:
- Storage balance (allocated funds)
- Payments balance (withdrawable funds)
- Payout history and status
- Platform fee calculations (10%)

#### 3. AllocationContext
**Purpose**: Manages fund allocations to pages and users
**File**: `app/contexts/AllocationContext.tsx`
**Features**:
- Page-specific allocations
- User-specific allocations
- Allocation history and analytics
- Batch allocation operations

### Data Flow Architecture

```
Subscription Purchase → UsdBalanceContext (Available Funds)
                    ↓
User Allocations → AllocationContext (Track Allocations)
                    ↓
Monthly Processing → EarningsContext (Creator Earnings)
                    ↓
Payout Requests → Payments Balance (Withdrawable)
```

## 💳 Payment Features

### Subscription System
- **Monthly Subscriptions**: $5, $10, $25, $50, $100 tiers
- **Automatic Renewal**: Stripe-managed recurring payments
- **Instant Activation**: Immediate balance credit
- **Upgrade/Downgrade**: Prorated billing adjustments

### Allocation System
- **Real-time Allocations**: Instant fund allocation to creators
- **Optimistic Updates**: UI updates immediately
- **Batch Processing**: Efficient backend operations
- **Allocation History**: Complete audit trail

### Payout System
- **Storage Balance**: Funds allocated to creators (held until month-end)
- **Payments Balance**: Withdrawable funds after platform fee
- **Platform Fee**: 10% on all payouts
- **Bank Integration**: Stripe Connect for direct deposits

## 🔧 Technical Implementation

### USD Cents Precision
```typescript
// All financial calculations use cents for precision
const usdCents = 1000; // $10.00
const displayAmount = formatCurrency(usdCents); // "$10.00"
```

### Context Architecture
```typescript
// Separated contexts for focused data management
const { balance, allocateUsd } = useUsdBalance();
const { storageBalance, paymentsBalance } = useEarnings();
const { pageAllocations } = useAllocations();
```

### API Integration
```typescript
// Environment-aware API calls
const response = await fetch('/api/usd/balance');
const allocation = await fetch('/api/usd/allocate', {
  method: 'POST',
  body: JSON.stringify({ pageId, amount })
});
```

## 📊 Financial Data Architecture

### Balance Types
1. **Available Balance**: Funds available for allocation
2. **Storage Balance**: Funds allocated to creators (pending)
3. **Payments Balance**: Funds available for withdrawal

### Transaction Types
1. **Subscription**: Monthly payment from user
2. **Allocation**: User allocates funds to creator
3. **Payout**: Creator withdraws earnings
4. **Platform Fee**: 10% fee on payouts

### Data Storage
- **Collections**: `usdBalances`, `usdAllocations`, `usdEarnings`
- **Environment**: Uses `getCollectionName()` for dev/prod separation
- **Caching**: Optimized for performance with TTL caching

## 🎯 User Experience

### For Supporters
1. **Subscribe**: Choose monthly subscription tier
2. **Allocate**: Distribute funds to favorite creators
3. **Track**: Monitor allocation history and impact

### For Creators
1. **Earn**: Receive allocations from supporters
2. **Track**: Monitor earnings in real-time
3. **Withdraw**: Request payouts to bank account

### Financial Transparency
- **Real USD**: No virtual currency confusion
- **Clear Fees**: 10% platform fee clearly displayed
- **Instant Updates**: Real-time balance and earnings
- **Complete History**: Full transaction audit trail

## 🔒 Security & Compliance

### Payment Security
- **Stripe Integration**: PCI-compliant payment processing
- **Secure Storage**: Encrypted financial data
- **Audit Trail**: Complete transaction logging
- **Fraud Protection**: Stripe's built-in fraud detection

### Data Protection
- **Environment Isolation**: Dev/prod data separation
- **Access Controls**: Role-based permissions
- **Encryption**: Sensitive data encrypted at rest
- **Compliance**: GDPR and financial regulations

## 📈 Performance Optimizations

### Caching Strategy
- **Balance Cache**: 5-minute TTL for balance data
- **Allocation Cache**: Real-time with optimistic updates
- **Earnings Cache**: 1-hour TTL for earnings data

### Database Optimization
- **Indexed Queries**: Optimized for common patterns
- **Batch Operations**: Efficient bulk updates
- **Connection Pooling**: Optimized database connections

## 🚀 Future Enhancements

### Planned Features
1. **Multi-currency Support**: International payment options
2. **Advanced Analytics**: Detailed financial reporting
3. **Automated Payouts**: Scheduled automatic withdrawals
4. **Tax Reporting**: Creator tax document generation

### Performance Improvements
1. **Edge Caching**: Global CDN for financial data
2. **Real-time Updates**: WebSocket-based live updates
3. **Predictive Caching**: ML-based cache optimization

## 📚 Related Documentation

- [ALLOCATION_SYSTEM.md](./ALLOCATION_SYSTEM.md) - Allocation mechanics
- [PAYOUT_SYSTEM_INDEX.md](./PAYOUT_SYSTEM_INDEX.md) - Payout processes
- [SUBSCRIPTION_SYSTEM.md](./SUBSCRIPTION_SYSTEM.md) - Subscription management
- [FINANCIAL_DATA_ARCHITECTURE.md](./FINANCIAL_DATA_ARCHITECTURE.md) - Data architecture

---

**Last Updated**: August 2025  
**Status**: Active - Production system with ongoing enhancements
