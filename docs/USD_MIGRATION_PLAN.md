# WeWrite Token-to-USD Migration Plan

## Overview
This document outlines the comprehensive migration plan from WeWrite's token-based virtual currency system to a direct USD-based payment and allocation system.

## Current System Analysis

### Token Economy Constants
- **Current Rate**: 10 tokens = $1.00 USD
- **Storage**: Tokens stored as integers
- **Conversion**: 100 tokens = $10.00 USD

### Database Collections to Migrate

#### 1. TOKEN_BALANCES → USD_BALANCES
**Current Schema:**
```typescript
interface TokenBalance {
  userId: string;
  totalTokens: number;        // → totalUsdCents: number
  allocatedTokens: number;    // → allocatedUsdCents: number
  availableTokens: number;    // → availableUsdCents: number
  monthlyAllocation: number;  // → monthlyAllocationCents: number
  lastAllocationDate: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}
```

**New Schema:**
```typescript
interface UsdBalance {
  userId: string;
  totalUsdCents: number;        // Total USD in cents (e.g., 1000 = $10.00)
  allocatedUsdCents: number;    // Allocated USD in cents
  availableUsdCents: number;    // Available USD in cents
  monthlyAllocationCents: number; // Monthly allocation in cents
  lastAllocationDate: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}
```

#### 2. TOKEN_ALLOCATIONS → USD_ALLOCATIONS
**Current Schema:**
```typescript
interface TokenAllocation {
  id: string;
  userId: string;
  recipientUserId: string;
  resourceType: 'page' | 'user_bio' | 'user' | 'wewrite';
  resourceId: string;
  tokens: number;             // → usdCents: number
  month: string;
  status: 'active' | 'cancelled';
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}
```

**New Schema:**
```typescript
interface UsdAllocation {
  id: string;
  userId: string;
  recipientUserId: string;
  resourceType: 'page' | 'user_bio' | 'user' | 'wewrite';
  resourceId: string;
  usdCents: number;           // USD amount in cents
  month: string;
  status: 'active' | 'cancelled';
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}
```

#### 3. WRITER_TOKEN_BALANCES → WRITER_USD_BALANCES
**Current Schema:**
```typescript
interface WriterTokenBalance {
  userId: string;
  totalTokensEarned: number;    // → totalUsdCentsEarned: number
  totalUsdEarned: number;       // → REMOVE (redundant)
  pendingTokens: number;        // → pendingUsdCents: number
  pendingUsdValue: number;      // → REMOVE (redundant)
  availableTokens: number;      // → availableUsdCents: number
  availableUsdValue: number;    // → REMOVE (redundant)
  paidOutTokens: number;        // → paidOutUsdCents: number
  paidOutUsdValue: number;      // → REMOVE (redundant)
  lastProcessedMonth: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}
```

**New Schema:**
```typescript
interface WriterUsdBalance {
  userId: string;
  totalUsdCentsEarned: number;  // Total earned in cents
  pendingUsdCents: number;      // Current month earnings (not yet available)
  availableUsdCents: number;    // Previous months earnings (available for payout)
  paidOutUsdCents: number;      // Already paid out in cents
  lastProcessedMonth: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}
```

#### 4. WRITER_TOKEN_EARNINGS → WRITER_USD_EARNINGS
**Current Schema:**
```typescript
interface WriterTokenEarnings {
  id: string;
  userId: string;
  month: string;
  totalTokensReceived: number;  // → totalUsdCentsReceived: number
  totalUsdValue: number;        // → REMOVE (redundant)
  status: 'pending' | 'available' | 'paid_out';
  allocations: {
    allocationId: string;
    fromUserId: string;
    fromUsername?: string;
    resourceType: 'page' | 'user_bio' | 'user';
    resourceId: string;
    resourceTitle?: string;
    tokens: number;             // → usdCents: number
    usdValue: number;           // → REMOVE (redundant)
  }[];
  processedAt?: string | Timestamp;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}
```

#### 5. TOKEN_PAYOUTS → USD_PAYOUTS
**Current Schema:**
```typescript
interface TokenPayout {
  id: string;
  userId: string;
  amount: number;               // Already in USD - keep as is
  tokens: number;               // → REMOVE (no longer needed)
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripePayoutId?: string;
  stripeTransferId?: string;
  earningsIds: string[];
  requestedAt: string | Timestamp;
  processedAt?: string | Timestamp;
  completedAt?: string | Timestamp;
  failureReason?: string;
  minimumThresholdMet: boolean;
}
```

### Collection Name Changes
```typescript
export const COLLECTIONS = {
  // OLD → NEW
  TOKEN_BALANCES: 'tokenBalances' → USD_BALANCES: 'usdBalances',
  TOKEN_ALLOCATIONS: 'tokenAllocations' → USD_ALLOCATIONS: 'usdAllocations',
  PENDING_TOKEN_ALLOCATIONS: 'pendingTokenAllocations' → PENDING_USD_ALLOCATIONS: 'pendingUsdAllocations',
  WRITER_TOKEN_BALANCES: 'writerTokenBalances' → WRITER_USD_BALANCES: 'writerUsdBalances',
  WRITER_TOKEN_EARNINGS: 'writerTokenEarnings' → WRITER_USD_EARNINGS: 'writerUsdEarnings',
  TOKEN_PAYOUTS: 'tokenPayouts' → USD_PAYOUTS: 'usdPayouts',
  TOKEN_EARNINGS: 'tokenEarnings' → USD_EARNINGS: 'usdEarnings',
}
```

## Migration Strategy

### Phase 1: Preparation
1. Create new USD-based utility functions
2. Update database types and interfaces
3. Create migration scripts with audit logging

### Phase 2: Backend Migration
1. Update server-side services to handle USD cents
2. Migrate API endpoints to USD-based logic
3. Update Stripe integration for direct USD purchases

### Phase 3: Frontend Migration
1. Update UI components to display USD amounts
2. Change button text and labels
3. Add USD tooltips and explanations

### Phase 4: Data Migration
1. Run migration script to convert existing data
2. Audit and verify conversion accuracy
3. Update collection names and references

### Phase 5: Cleanup
1. Remove token-related code and references
2. Update documentation and Terms of Service
3. Deploy and monitor system performance

## Conversion Formula
- **Tokens to USD Cents**: `tokens / 10 * 100` (e.g., 100 tokens → 10 USD → 1000 cents)
- **USD Cents to Display**: `cents / 100` (e.g., 1000 cents → $10.00)

## Risk Mitigation
1. **Backward Compatibility**: Maintain dual support during transition
2. **Audit Logging**: Log all conversions for dispute resolution
3. **Rollback Plan**: Ability to revert changes if issues arise
4. **Testing**: Comprehensive testing at each phase
5. **User Communication**: Clear messaging about the change

## Success Criteria
- All monetary values displayed in USD format ($X.XX)
- No references to tokens in UI or backend
- Stripe integration sells direct USD credits
- User balances accurately converted
- Terms of Service updated
- System performance maintained
