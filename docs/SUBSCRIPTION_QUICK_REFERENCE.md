# Subscription System Quick Reference

## Environment Setup

### Development (localhost:3000)
```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NODE_ENV=development
SUBSCRIPTION_ENV=development
```

### Production/Preview (Vercel)
```bash
# Environment variables
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NODE_ENV=production
SUBSCRIPTION_ENV=production
```

## Key API Endpoints

| Endpoint | Purpose | Test Handling |
|----------|---------|---------------|
| `/api/account-subscription` | Get subscription data | ✅ Environment-aware |
| `/api/subscription/create-setup-intent` | Create setup intent | ✅ Real Stripe resources |
| `/api/subscription/create-with-payment-method` | Create subscription | ✅ Real Stripe resources |
| `/api/subscription/update` | Modify subscription | ✅ Test detection |
| `/api/subscription/cancel` | Cancel subscription | ✅ Test detection |
| `/api/subscription/reactivate` | Reactivate cancelled | ✅ Test detection |
| `/api/subscription/portal` | Stripe customer portal | ✅ Real Stripe resources |
| `/api/test-subscription` | Create test data | ✅ Dev only |

## Data Paths

### Firestore Collections
```typescript
// Development
dev_users/{userId}/dev_subscriptions/current

// Production  
users/{userId}/subscriptions/current

// Use this helper
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../utils/environmentConfig';
const { parentPath, subCollectionName } = getSubCollectionPath(
  PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS
);
```

## Test Subscription Detection

### Pattern
```typescript
const isTestSubscription = subscriptionId.startsWith('sub_test_');

if (isTestSubscription) {
  // Skip Stripe API, create mock response
  const mockSubscription = {
    id: subscriptionId,
    status: 'active',
    cancel_at_period_end: false,
    current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  };
} else {
  // Call real Stripe API
  const subscription = await stripe.subscriptions.update(subscriptionId, {...});
}
```

### APIs That Need This
- ✅ `/api/subscription/reactivate` (implemented)
- ✅ `/api/subscription/cancel` (implemented)
- ✅ `/api/subscription/update` (implemented)

## Subscription Tiers

```typescript
const TIERS = {
  tier1: { amount: 10, tokens: 100, name: 'Supporter' },
  tier2: { amount: 20, tokens: 200, name: 'Advocate' }, 
  tier3: { amount: 30, tokens: 300, name: 'Champion' },
  custom: { amount: 1-50, tokens: amount * 10, name: 'Custom' }
};
```

## Common Code Patterns

### Get User Subscription
```typescript
const response = await fetch(`/api/account-subscription?userId=${userId}`);
const data = await response.json();
const subscription = data.hasSubscription ? data.fullData : null;

// Expected fields:
// { hasSubscription, status, amount, tokens, cancelAtPeriodEnd, fullData: {...} }
```

### Update Subscription
```typescript
const response = await fetch('/api/subscription/update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subscriptionId: subscription.stripeSubscriptionId,
    newTier: 'tier2',
    newAmount: 20
  })
});
```

### Create Test Subscription
```typescript
// Development only
const response = await fetch('/api/test-subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    tier: 'tier1', 
    amount: 10
  })
});
```

## Stripe Customer Format

### Description Pattern
```typescript
// Format: "WeWrite user {username} ({userId})"
// Example: "WeWrite user jamie (fWNeCuussPgYgkN2LGohFRCPXiy1)"

// Username fallback logic
let username = userData?.username ||
               userData?.displayName ||
               userEmail?.split('@')[0] ||
               'Unknown User';

const customer = await stripe.customers.create({
  description: `WeWrite user ${username} (${userId})`,
  metadata: {
    firebaseUID: userId,
    username: username
  }
});
```

### Implementation Locations
- ✅ `/api/setup-intent/route.ts`
- ✅ `/api/subscription/create-setup-intent/route.ts`
- ✅ `/api/create-connect-account/route.js`

## Error Handling

### Common Errors
```typescript
// Test subscription doesn't exist in Stripe
"No such subscription: 'sub_test_1751903056938'"

// Missing required fields
"stripeSubscriptionId is required"

// Environment mismatch
"Subscription not found in dev_subscriptions"
```

### Debug Logging
```typescript
console.log('🔵 Subscription data:', subscription);
console.log('🔵 Button state:', getButtonState());
console.log('🔵 Environment:', { NODE_ENV, SUBSCRIPTION_ENV });
```

## Testing Checklist

### Before Deployment
- [ ] Test subscription creation in dev
- [ ] Test subscription modification in dev  
- [ ] Test subscription cancellation in dev
- [ ] Verify environment separation
- [ ] Check Stripe webhook processing
- [ ] Test with real Stripe test mode

### Test Cards (Development)
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient: 4000 0000 0000 9995
```

## Quick Fixes

### Reset Test Data
```bash
# Delete test subscription
curl -X DELETE http://localhost:3000/api/test-subscription \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID"}'

# Create new test subscription  
curl -X POST http://localhost:3000/api/test-subscription \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","tier":"tier1","amount":10}'
```

### Force UI Refresh
```javascript
// Clear cache and reload
localStorage.clear();
window.location.reload();
```

### Manual Firestore Update
```javascript
// Fix subscription status
await db.collection('dev_users')
  .doc(userId)
  .collection('dev_subscriptions') 
  .doc('current')
  .update({ status: 'active', cancelAtPeriodEnd: false });
```

## File Locations

### Key Files
```
app/api/account-subscription/route.ts                    # Get subscription data (SINGLE SOURCE OF TRUTH)
app/api/subscription/create-setup-intent/route.ts        # Create setup intent for new subscriptions
app/api/subscription/create-with-payment-method/route.ts # Create subscription after payment setup
app/api/subscription/update/route.ts                     # Modify subscription
app/api/subscription/cancel/route.ts                     # Cancel subscription
app/api/subscription/reactivate/route.ts                 # Reactivate subscription
app/api/subscription/portal/route.ts                     # Stripe customer portal
app/api/test-subscription/route.ts                       # Test data creation
app/hooks/useSubscriptionWarning.ts                      # Subscription warning hook
app/settings/subscription/page.tsx                       # Subscription UI (API-first approach)
app/utils/environmentConfig.ts                           # Environment helpers
docs/SUBSCRIPTION_SYSTEM.md                              # Full documentation
docs/SUBSCRIPTION_TROUBLESHOOTING.md                     # Troubleshooting guide
```

### Important Utilities
```typescript
// Environment-aware paths
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../utils/environmentConfig';

// User data
import { getUsernameById } from '../utils/userUtils';

// Subscription tiers
import { getTierById, calculateTokensForAmount } from '../utils/subscriptionTiers';
```

---

**Quick Help**: Check `docs/SUBSCRIPTION_TROUBLESHOOTING.md` for specific issues
**Last Updated**: 2025-07-09 (All APIs implemented and working)
