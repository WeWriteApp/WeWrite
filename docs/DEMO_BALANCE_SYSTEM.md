# Demo Balance System

The Demo Balance System provides a simulated USD allocation experience for users who don't have active subscriptions. This allows both logged-out users and logged-in users without subscriptions to try the allocation system with demo funds.

## Overview

The demo balance system is completely separate from the real USD balance system, ensuring clean separation of concerns and preventing any interference with actual financial transactions.

### Key Features

- **$10/month Demo Budget**: All users get $10.00 in demo funds to allocate
- **Persistent Allocations**: Demo allocations are saved in localStorage and persist across sessions
- **Real-time Updates**: All allocation UI components update immediately when demo allocations change
- **Seamless Experience**: Demo mode feels identical to real allocation mode
- **Encouraging UI**: Green earnings and positive demo amounts encourage sign-up

## Architecture

### Core Components

1. **DemoBalanceContext** (`app/contexts/DemoBalanceContext.tsx`)
   - Manages demo balance state for both logged-out and logged-in users
   - Provides hooks for accessing and updating demo balance
   - Handles localStorage persistence

2. **Simulated USD Utilities** (`app/utils/simulatedUsd.ts`)
   - Low-level functions for managing demo allocations in localStorage
   - Separate storage keys for logged-out vs logged-in users
   - Handles allocation calculations and validation

3. **Allocation Components**
   - All allocation components automatically detect demo mode
   - Use `useShouldUseDemoBalance()` to determine which balance system to use
   - Seamlessly switch between demo and real allocations

### Data Flow

```
User Action (click +/-) 
    ↓
useAllocationActions hook
    ↓
Detects demo mode (isDemoBalance)
    ↓
Calls simulatedUsd functions
    ↓
Updates localStorage
    ↓
Calls refreshDemoBalance()
    ↓
DemoBalanceContext updates
    ↓
All components re-render with new values
```

## Usage

### Basic Hook Usage

```typescript
import { useDemoBalance, useShouldUseDemoBalance } from '../contexts/DemoBalanceContext';
import { useSubscription } from '../contexts/SubscriptionContext';

function MyComponent() {
  const { hasActiveSubscription } = useSubscription();
  const shouldUseDemoBalance = useShouldUseDemoBalance(hasActiveSubscription);
  const { demoBalance, isDemoBalance } = useDemoBalance();
  
  if (shouldUseDemoBalance && demoBalance) {
    // Use demo balance
    const available = demoBalance.availableUsdCents;
    const allocated = demoBalance.allocatedUsdCents;
  }
}
```

### Allocation Component Integration

```typescript
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { useDemoBalance, useShouldUseDemoBalance } from '../contexts/DemoBalanceContext';

function AllocationComponent() {
  const { usdBalance } = useUsdBalance();
  const { hasActiveSubscription } = useSubscription();
  const shouldUseDemoBalance = useShouldUseDemoBalance(hasActiveSubscription);
  const { demoBalance } = useDemoBalance();
  
  // Automatically choose the right balance
  const currentBalance = shouldUseDemoBalance ? demoBalance : usdBalance;
  
  return (
    <AllocationAmountDisplay
      allocationCents={allocationState.currentAllocationCents}
      availableBalanceCents={currentBalance?.availableUsdCents || 0}
      variant="page"
    />
  );
}
```

## Storage Format

### Logged-out Users
**Key**: `wewrite_logged_out_usd_balance`

```json
{
  "allocatedUsdCents": 250,
  "allocations": [
    {
      "pageId": "abc123",
      "pageTitle": "Sample Page",
      "usdCents": 100,
      "timestamp": 1703123456789
    }
  ],
  "lastUpdated": 1703123456789
}
```

### Logged-in Users (without subscription)
**Key**: `wewrite_user_usd_balance_${userId}`

```json
{
  "allocatedUsdCents": 500,
  "allocations": [
    {
      "pageId": "def456",
      "pageTitle": "Another Page", 
      "usdCents": 200,
      "timestamp": 1703123456789
    }
  ],
  "lastUpdated": 1703123456789
}
```

## Demo vs Real Balance Detection

The system automatically determines whether to use demo or real balance:

```typescript
export function useShouldUseDemoBalance(hasActiveSubscription: boolean): boolean {
  const { user } = useAuth();
  
  // Use demo balance if:
  // 1. User is not logged in, OR
  // 2. User is logged in but doesn't have an active subscription
  return !user?.uid || !hasActiveSubscription;
}
```

## Migration from "Fake" to "Demo"

The system was migrated from "fake" terminology to "demo" for clarity:

- ✅ `FakeBalanceContext` → `DemoBalanceContext`
- ✅ `useFakeBalance()` → `useDemoBalance()`
- ✅ `isFakeBalance` → `isDemoBalance`
- ✅ `fakeBalance` → `demoBalance`
- ✅ All comments and UI text updated
- ✅ Legacy exports removed after migration completion
- ✅ Deprecated token-based components removed

## Benefits

### User Experience
- **Try Before Subscribe**: Users can experience the full allocation system
- **No Barriers**: No login required to try basic functionality
- **Encouraging**: Positive demo earnings motivate sign-up
- **Persistent**: Allocations survive page refreshes and navigation

### Development
- **Clean Separation**: Demo logic is completely isolated from real financial code
- **Easy Testing**: Developers can test allocation flows without subscriptions
- **Consistent API**: Same hooks and components work for both demo and real modes
- **Type Safety**: Full TypeScript support with proper interfaces

### Business
- **Conversion Tool**: Interactive demo encourages subscription sign-ups
- **Risk-Free**: No real money involved in demo mode
- **Analytics Ready**: Can track demo usage patterns
- **Scalable**: Handles unlimited demo users without backend load

## Best Practices

1. **Always Check Mode**: Use `useShouldUseDemoBalance()` to determine which balance to use
2. **Consistent UI**: Demo mode should feel identical to real mode
3. **Clear Indicators**: Show "Demo funds" or similar indicators when in demo mode
4. **Encourage Upgrade**: Include calls-to-action to upgrade to real subscriptions
5. **Handle Edge Cases**: Gracefully handle localStorage errors or missing data

## Troubleshooting

### Common Issues

**Demo allocations not updating UI**
- Ensure components use `useDemoBalance()` hook
- Check that `demoBalance` is included in dependency arrays
- Verify `refreshDemoBalance()` is called after allocation changes

**Demo mode not detected**
- Check `hasActiveSubscription` value
- Verify `useShouldUseDemoBalance()` logic
- Ensure user authentication state is correct

**localStorage errors**
- All localStorage operations are wrapped in try-catch
- System gracefully falls back to default values
- Check browser localStorage quota and permissions
