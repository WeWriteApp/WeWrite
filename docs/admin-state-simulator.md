# Admin State Simulator

The Admin State Simulator is a floating UI tool that allows admin users to simulate different application states for testing and development purposes. It provides a draggable interface that can toggle between collapsed and expanded states, and never goes off-screen.

## Features

- **Floating UI**: Draggable window that stays within viewport bounds
- **Mobile Support**: Touch-friendly with hover/touch expansion
- **Persistent State**: Remembers position and settings across sessions
- **Session Hide**: Can be hidden for the current session and reappears on refresh
- **Extensible**: Easy to add new state categories
- **Admin Only**: Only visible to admin users

## Current State Categories

### Authentication
- **Logged Out**: Simulates unauthenticated state
- **Logged In**: Normal authenticated state

### Subscription
- **No Subscription**: User has no active subscription
- **Active Subscription**: User has an active subscription
- **Cancelling Subscription**: User is in the process of cancelling
- **Payment Failed**: Subscription payment has failed

### Spending
- **Past Month Tokens Sent**: User has allocated tokens in the past month

### Token Earnings
- **None**: No token earnings
- **10 unfunded: logged out users**: Tokens from users who were logged out
- **10 unfunded: users without subscriptions**: Tokens from users without subscriptions
- **10 funded: pending**: Funded tokens pending month-end processing
- **10 locked: from last month**: Locked tokens available for payout

## Usage in Components

### Basic Usage

```typescript
import { useSimulatedAppState } from '../providers/AdminStateSimulatorProvider';
import { useSimulatedAuth } from '../hooks/useSimulatedAuth';

function MyComponent() {
  const simulatedState = useSimulatedAppState();
  const { isAuthenticated, isSimulated } = useSimulatedAuth();

  // Check authentication state (respects simulation)
  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  // Check subscription state
  if (simulatedState.subscription.hasNone) {
    return <SubscriptionPrompt />;
  }

  // Check for payment issues
  if (simulatedState.subscription.hasPaymentFailed) {
    return <PaymentFailedAlert />;
  }

  // Check token earnings
  if (simulatedState.tokenEarnings.fundedPending) {
    return <PendingTokensNotice />;
  }

  return <MainContent />;
}
```

### Advanced Usage

```typescript
import { useAdminStateSimulatorContext } from '../providers/AdminStateSimulatorProvider';

function AdvancedComponent() {
  const { simulatedState, isSimulating } = useAdminStateSimulatorContext();

  // Check if specific categories are being simulated
  const isSimulatingAuth = isSimulating('authState');
  const isSimulatingSubscription = isSimulating('subscriptionState');

  return (
    <div>
      {isSimulatingAuth && (
        <div className="bg-orange-100 p-2 text-sm">
          ⚠️ Authentication state is being simulated
        </div>
      )}
      
      {/* Your component content */}
    </div>
  );
}
```

## Adding New State Categories

### 1. Update Configuration

Edit `app/config/adminStateSimulatorConfig.ts`:

```typescript
export const STATE_CATEGORIES: StateCategory[] = [
  // ... existing categories
  {
    id: 'notificationState',
    name: 'Notifications',
    icon: Bell,
    description: 'Simulate notification states',
    type: 'multi-checkbox',
    defaultValue: {
      hasUnread: false,
      emailVerificationPending: false,
      paymentReminder: false
    },
    options: [
      {
        id: 'hasUnread',
        label: 'Has unread notifications',
        description: 'User has unread notifications',
        value: true
      },
      {
        id: 'emailVerificationPending',
        label: 'Email verification pending',
        description: 'User needs to verify their email',
        value: true
      },
      {
        id: 'paymentReminder',
        label: 'Payment reminder',
        description: 'User has a payment reminder',
        value: true
      }
    ]
  }
];
```

### 2. Update State Interface

Edit `app/hooks/useAdminStateSimulator.ts`:

```typescript
export interface AdminSimulatorState {
  // ... existing state
  notificationState: {
    hasUnread: boolean;
    emailVerificationPending: boolean;
    paymentReminder: boolean;
  };
}

const DEFAULT_STATE: AdminSimulatorState = {
  // ... existing defaults
  notificationState: {
    hasUnread: false,
    emailVerificationPending: false,
    paymentReminder: false
  }
};
```

### 3. Add State Setter

Add the setter function to the hook:

```typescript
const setNotificationState = useCallback((updates: Partial<AdminSimulatorState['notificationState']>) => {
  updateState({ 
    notificationState: { ...state.notificationState, ...updates }
  });
}, [state.notificationState, updateState]);

return {
  // ... existing returns
  notificationState: state.notificationState,
  setNotificationState,
};
```

### 4. Update Provider

Edit `app/providers/AdminStateSimulatorProvider.tsx`:

```typescript
export function useSimulatedAppState() {
  const context = useContext(AdminStateSimulatorContext);
  return context?.simulatedState || {
    // ... existing defaults
    notifications: { 
      hasUnread: false, 
      emailVerificationPending: false, 
      paymentReminder: false 
    }
  };
}
```

### 5. Use in Components

```typescript
function NotificationComponent() {
  const simulatedState = useSimulatedAppState();

  if (simulatedState.notifications.hasUnread) {
    return <UnreadNotificationsBadge />;
  }

  if (simulatedState.notifications.emailVerificationPending) {
    return <EmailVerificationAlert />;
  }

  return <NoNotifications />;
}
```

## State Types

### Radio Group
Single selection from multiple options:
```typescript
type: 'radio'
options: [
  { id: 'option1', label: 'Option 1', value: 'value1' },
  { id: 'option2', label: 'Option 2', value: 'value2' }
]
```

### Multi-Checkbox
Multiple boolean selections:
```typescript
type: 'multi-checkbox'
options: [
  { id: 'feature1', label: 'Feature 1', value: true },
  { id: 'feature2', label: 'Feature 2', value: true }
]
```

### Toggle
Single boolean value:
```typescript
type: 'toggle'
// No options needed, just true/false
```

## File Structure

```
app/
├── components/admin/
│   ├── AdminStateSimulator.tsx          # Main simulator component
│   ├── AdminStateSimulatorGuard.tsx     # Admin-only guard
│   └── AdminStateSimulatorDemo.tsx      # Usage examples
├── hooks/
│   ├── useAdminStateSimulator.ts        # Core state management
│   └── useSimulatedAuth.ts              # Auth simulation wrapper
├── providers/
│   └── AdminStateSimulatorProvider.tsx  # Context provider
├── config/
│   └── adminStateSimulatorConfig.ts     # State configuration
└── docs/
    └── admin-state-simulator.md         # This documentation
```

## Best Practices

1. **Always use simulation hooks**: Use `useSimulatedAuth()` instead of `useCurrentAccount()` directly
2. **Check simulation state**: Use `isSimulated` flag to show simulation indicators
3. **Graceful fallbacks**: Provide default values when simulation context is not available
4. **Test all states**: Use the simulator to test edge cases and error states
5. **Document new states**: Update this documentation when adding new state categories

## Troubleshooting

### Simulator not appearing
- Check if user is admin: `isAdmin(user.email)`
- Verify AdminStateSimulatorGuard is in the layout
- Check if hidden for session: refresh the page

### State not updating
- Verify state setter is called correctly
- Check if state category is properly configured
- Ensure component is wrapped in AdminStateSimulatorProvider

### Dragging issues
- Check viewport constraints in handleMouseMove/handleTouchMove
- Verify drag offset calculations
- Test on different screen sizes
