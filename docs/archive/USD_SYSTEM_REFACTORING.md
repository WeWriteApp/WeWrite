# USD System Refactoring - Separation of Concerns

## Overview

This document describes the major refactoring of WeWrite's USD financial system from a monolithic `UsdBalanceContext` to a separated, focused architecture with dedicated contexts for each data domain.

## Refactoring Goals

1. **Reduce Complexity**: Break down 566-line monolithic context into focused components
2. **Improve Maintainability**: Clear separation of concerns for easier debugging
3. **Optimize Performance**: Components only load data they actually need
4. **Enhance Testability**: Independent testing of each data domain
5. **Simplify Data Flows**: Make data dependencies obvious and self-documenting

## Before: Monolithic Architecture

### Problems with Old System

```typescript
// Single context handling everything
interface UsdBalanceContextType {
  // Balance concerns
  usdBalance: UsdBalance | null;
  updateOptimisticBalance: (changeCents: number) => void;
  
  // Subscription concerns (should be separate!)
  subscription: SubscriptionData | null;
  hasActiveSubscription: boolean;
  
  // Earnings concerns (should be separate!)
  earnings: EarningsData | null;
  earningsLoading: boolean;
  
  // Fake balance concerns (should be separate!)
  isFakeBalance: boolean;
  refreshFakeBalance: () => void;
}
```

**Issues:**
- ❌ Single Responsibility Principle violation
- ❌ Complex interdependencies between unrelated data
- ❌ Difficult to test individual concerns
- ❌ Components forced to load all data even if unused
- ❌ 566 lines of complex logic in one file
- ❌ Mixed real and fake balance logic

## After: Separated Architecture

### New Context Structure

#### 1. UsdBalanceContext (Real Balance Only)
```typescript
interface UsdBalanceContextType {
  usdBalance: UsdBalance | null;
  isLoading: boolean;
  refreshUsdBalance: () => Promise<void>;
  updateOptimisticBalance: (changeCents: number) => void;
  getTotalUsdFormatted: () => string;
  getAvailableUsdFormatted: () => string;
  getAllocatedUsdFormatted: () => string;
}
```

#### 2. SubscriptionContext (Subscription Data Only)
```typescript
interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  hasActiveSubscription: boolean;
  subscriptionAmount: number;
  refreshSubscription: () => Promise<void>;
  isSubscriptionActive: () => boolean;
  getSubscriptionStatus: () => string;
}
```

#### 3. EarningsContext (Earnings Data Only)
```typescript
interface EarningsContextType {
  earnings: EarningsData | null;
  hasEarnings: boolean;
  refreshEarnings: () => Promise<void>;
  getTotalEarnings: () => number;
  getFormattedTotalEarnings: () => string;
}
```

#### 4. FakeBalanceContext (Demo/Trial Balance Only)
```typescript
interface FakeBalanceContextType {
  fakeBalance: FakeBalance | null;
  isFakeBalance: boolean;
  allocateFakeBalance: (pageId: string, pageTitle: string, cents: number) => Promise<boolean>;
}
```

## Supporting Infrastructure

### UsdDataService
Centralized API service replacing scattered fetch logic:
- `fetchBalance()` - USD balance API
- `fetchSubscription()` - Subscription API  
- `fetchEarnings()` - Earnings API
- `fetchAllData()` - Parallel fetch utility

### SimpleCache Utility
Unified caching replacing complex multi-layer cache:
- Type-safe cache instances
- Configurable duration per data type
- Memory + persistent storage
- Clear expiration logic

## Migration Process

### 1. Component Updates
Updated all components to use appropriate contexts:

**Before:**
```typescript
const { usdBalance, subscription, earnings, isFakeBalance } = useUsdBalance();
```

**After:**
```typescript
const { usdBalance } = useUsdBalance();
const { subscription, hasActiveSubscription } = useSubscription();
const { earnings } = useEarnings();
const shouldUseFakeBalance = useShouldUseFakeBalance(hasActiveSubscription);
const { fakeBalance } = useFakeBalance();
```

### 2. Provider Tree Updates
Added new providers to app layout in correct dependency order:
```typescript
<SubscriptionProvider>
  <FakeBalanceProvider>
    <UsdBalanceProvider>
      <EarningsProvider>
        {children}
      </EarningsProvider>
    </UsdBalanceProvider>
  </FakeBalanceProvider>
</SubscriptionProvider>
```

### 3. Balance Selection Logic
Components now explicitly choose between real and fake balance:
```typescript
const currentBalance = shouldUseFakeBalance ? fakeBalance : usdBalance;
```

## Benefits Achieved

### ✅ Reduced Complexity
- **Before**: 566-line monolithic context
- **After**: 4 focused contexts (~150 lines each)

### ✅ Improved Performance  
- **Before**: All components load all financial data
- **After**: Components only load data they need

### ✅ Better Caching
- **Before**: Complex multi-layer cache with unclear expiration
- **After**: Simple, dedicated cache per data type with optimal durations

### ✅ Enhanced Testability
- **Before**: Hard to test individual concerns
- **After**: Each context can be tested independently

### ✅ Clearer Data Flows
- **Before**: Unclear which context provides what data
- **After**: Obvious data ownership and dependencies

## Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Context File Size | 566 lines | ~150 lines each | 73% reduction |
| API Calls per Component | 3 (always) | 1-3 (as needed) | Up to 67% reduction |
| Cache Complexity | Multi-layer | Simple unified | Simplified |
| Test Coverage | Difficult | Independent | Improved |
| Debug Difficulty | High | Low | Easier |

## Future Maintenance

### Adding New Financial Data
1. Create dedicated context (e.g., `PayoutContext`)
2. Add to UsdDataService if needed
3. Create cache instance in SimpleCache
4. Add provider to app layout
5. Update components as needed

### Debugging Issues
1. Check specific context for the data type
2. Verify cache behavior in SimpleCache
3. Check UsdDataService for API issues
4. Test context independently

---

**Refactoring Completed**: August 16, 2025  
**Status**: Production Ready  
**Next Steps**: Monitor performance and gather feedback
