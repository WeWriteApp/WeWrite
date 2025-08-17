# Financial Data Architecture - Separated Contexts

## Overview

The WeWrite financial data system has been **refactored into separated, focused contexts** that each handle a specific domain of financial data. This eliminates the complexity of a monolithic context and provides clear separation of concerns with dedicated caching and state management.

## Separated Context Architecture

The financial system now consists of **four dedicated contexts**:

### 1. UsdBalanceContext
**Location**: `app/contexts/UsdBalanceContext.tsx`
- **Purpose**: Manages real USD balance data only
- **Scope**: Authenticated users with active subscriptions
- **Data**: `totalUsdCents`, `allocatedUsdCents`, `availableUsdCents`
- **Caching**: 30-minute cache with persistent storage

### 2. SubscriptionContext
**Location**: `app/contexts/SubscriptionContext.tsx`
- **Purpose**: Manages subscription data separately
- **Scope**: All authenticated users
- **Data**: Subscription status, amount, billing info
- **Caching**: 15-minute cache with persistent storage

### 3. EarningsContext
**Location**: `app/contexts/EarningsContext.tsx`
- **Purpose**: Manages creator earnings data
- **Scope**: Users with earnings
- **Data**: Total earnings, available balance, pending balance
- **Caching**: 10-minute cache with persistent storage

### 4. FakeBalanceContext
**Location**: `app/contexts/FakeBalanceContext.tsx`
- **Purpose**: Manages demo/trial balance for non-subscribers
- **Scope**: Logged-out users and users without subscriptions
- **Data**: Simulated balance stored in localStorage
- **Caching**: No server caching (localStorage only)

## Key Benefits of Separation

1. **Single Responsibility**: Each context has one clear purpose
2. **Independent Caching**: Optimized cache duration per data type
3. **Selective Loading**: Components only load data they need
4. **Easier Testing**: Each context can be tested independently
5. **Better Performance**: No unnecessary API calls
6. **Clear Data Flows**: Obvious which context provides what data

## Data Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Components    │───▶│ Separated        │───▶│   API Endpoints │
│                 │    │ Contexts         │    │                 │
│ • NavHeader     │    │                  │    │                 │
│ • AllocationBar │    │ UsdBalanceContext│────│ /api/usd/balance│
│ • Settings      │    │ SubscriptionCtx  │────│ /api/account-*  │
│ • Dashboards    │    │ EarningsContext  │────│ /api/earnings/* │
│                 │    │ FakeBalanceCtx   │────│ localStorage    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Simplified Caching Strategy

- **UsdBalance**: 30 minutes (financial data changes less frequently)
- **Subscription**: 15 minutes (moderate change frequency)
- **Earnings**: 10 minutes (more dynamic, needs fresher data)
- **FakeBalance**: No server cache (localStorage only)
- **Unified Cache Utility**: `SimpleCache<T>` with memory + persistent storage

## Usage Patterns

### Separated Context Hooks

```typescript
// For USD balance data only
import { useUsdBalance } from '../contexts/UsdBalanceContext';
const { usdBalance, isLoading, refreshUsdBalance } = useUsdBalance();

// For subscription data only
import { useSubscription } from '../contexts/SubscriptionContext';
const { subscription, hasActiveSubscription, subscriptionAmount } = useSubscription();

// For earnings data only
import { useEarnings } from '../contexts/EarningsContext';
const { earnings, hasEarnings, isLoading } = useEarnings();

// For fake/demo balance (logged-out users)
import { useFakeBalance } from '../contexts/FakeBalanceContext';
const { fakeBalance, isFakeBalance, allocateFakeBalance } = useFakeBalance();

// Utility hook to determine which balance to use
import { useShouldUseFakeBalance } from '../contexts/FakeBalanceContext';
const shouldUseFakeBalance = useShouldUseFakeBalance(hasActiveSubscription);
```

## Component Integration Examples

### Header Financial Displays

**File**: `app/components/layout/NavHeader.tsx`

```typescript
const { usdBalance, isLoading: usdLoading } = useUsdBalance();
const { hasActiveSubscription } = useSubscription();
const { earnings, isLoading: earningsLoading } = useEarnings();
const shouldUseFakeBalance = useShouldUseFakeBalance(hasActiveSubscription);
const { fakeBalance } = useFakeBalance();

// Use appropriate balance based on subscription status
const currentBalance = shouldUseFakeBalance ? fakeBalance : usdBalance;
```

### Settings Pages

Settings pages use specific contexts for their data needs:

- `/settings/spend` - Uses `useUsdBalance()` and `useFakeBalance()` for allocation breakdown
- `/settings/earnings` - Uses `useEarnings()` for payout information
- `/settings/fund-account` - Uses `useSubscription()` for billing details

### Allocation Components

Allocation components determine which balance system to use:

```typescript
// AllocationBar example
const { usdBalance } = useUsdBalance();
const { hasActiveSubscription } = useSubscription();
const shouldUseFakeBalance = useShouldUseFakeBalance(hasActiveSubscription);
const { fakeBalance } = useFakeBalance();

const currentBalance = shouldUseFakeBalance ? fakeBalance : usdBalance;
```

## Benefits of Separated Architecture

### 1. **Single Responsibility Principle**
- Each context has one clear, focused purpose
- Easier to understand and maintain individual contexts
- Reduced complexity in each component

### 2. **Optimized Performance**
- Components only load data they actually need
- Independent caching strategies per data type
- No unnecessary API calls for unused data

### 3. **Better Testing & Debugging**
- Each context can be tested independently
- Clear data flows make debugging easier
- Isolated failures don't affect other data types

### 4. **Flexible Caching**
- Different cache durations based on data volatility
- UsdBalance: 30min (stable financial data)
- Subscription: 15min (moderate changes)
- Earnings: 10min (more dynamic)
- FakeBalance: localStorage only
### 5. **Clear Data Ownership**
- No ambiguity about which context provides what data
- Explicit imports make dependencies obvious
- Easier to track data usage across components

## Migration Guide

### Old Pattern (Monolithic Context)
```typescript
// ❌ OLD - Single context with everything
import { useUsdBalance } from '../contexts/UsdBalanceContext';

const {
  usdBalance,
  subscription,
  earnings,
  hasActiveSubscription,
  earningsLoading,
  isFakeBalance
} = useUsdBalance();
```

### New Pattern (Separated Contexts)
```typescript
// ✅ NEW - Separated, focused contexts
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useEarnings } from '../contexts/EarningsContext';
import { useFakeBalance, useShouldUseFakeBalance } from '../contexts/FakeBalanceContext';

// Only import what you need
const { usdBalance } = useUsdBalance();
const { hasActiveSubscription } = useSubscription();
const { earnings } = useEarnings();
const shouldUseFakeBalance = useShouldUseFakeBalance(hasActiveSubscription);
const { fakeBalance } = useFakeBalance();
```

## Supporting Services

### UsdDataService
**Location**: `app/services/usdDataService.ts`

Centralized service for all USD-related API calls:
- `fetchBalance()` - Gets USD balance data
- `fetchSubscription()` - Gets subscription data
- `fetchEarnings()` - Gets earnings data
- `fetchAllData()` - Parallel fetch of all data types

### SimpleCache Utility
**Location**: `app/utils/simplifiedCache.ts`

Unified caching utility with memory + persistent storage:
- Type-safe cache instances for each data type
- Configurable cache duration per data type
- Automatic cache invalidation and cleanup

## Cache Management

### Manual Refresh
```typescript
// Refresh specific data types
const { refreshUsdBalance } = useUsdBalance();
const { refreshSubscription } = useSubscription();
const { refreshEarnings } = useEarnings();

// Force refresh from API
await refreshUsdBalance();
await refreshSubscription();
await refreshEarnings();
```

### Cache Invalidation
Each context manages its own cache independently:
- **UsdBalance**: Invalidated on allocation changes
- **Subscription**: Invalidated on subscription updates
- **Earnings**: Invalidated on payout events
- **FakeBalance**: Updated in localStorage immediately

## Error Handling

Each context handles errors independently:

- **Isolated Failures**: If one context fails, others continue working
- **Cached Fallbacks**: Uses cached data when API calls fail
- **Graceful Degradation**: UI shows appropriate loading/error states
- **Retry Logic**: Built into each context's fetch logic

## Testing Strategy

### Unit Tests
- Test each context provider independently
- Mock UsdDataService for consistent API responses
- Verify cache behavior and invalidation
- Test fake balance logic separately

### Integration Tests
- Test component integration with multiple contexts
- Verify proper balance selection (real vs fake)
- Test error scenarios and fallback behavior
- Verify cache coordination between contexts

## Architecture Benefits Summary

✅ **Separation of Concerns**: Each context has single responsibility
✅ **Performance**: Only load data components actually need
✅ **Maintainability**: Easier to debug and modify individual contexts
✅ **Testability**: Independent testing of each data domain
✅ **Flexibility**: Different caching strategies per data type
✅ **Clarity**: Obvious data ownership and dependencies

---

**Last Updated**: August 16, 2025
**Version**: 2.0 (Separated Architecture)
**Status**: Production Ready
