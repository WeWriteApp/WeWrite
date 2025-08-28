# WeWrite Subscription System Documentation

## Overview

WeWrite uses a USD-based subscription system powered by Stripe. Users pay monthly subscriptions and receive USD credits that they can allocate directly to pages and creators. This document covers the complete subscription architecture, data flow, and implementation details.

## Architecture

### Core Components

1. **Stripe Integration**: Handles payments, subscriptions, and customer management
2. **Firebase/Firestore**: Stores subscription data and user information
3. **USD System**: Manages USD allocation and distribution
4. **Environment Separation**: Dev/prod data isolation

### Data Flow

```
User → Stripe Checkout → Webhook → Firestore → USD Allocation → Creator Earnings
```

### Simplified Architecture (2025)

**Key Principles:**
- **Single API Endpoint**: `/api/account-subscription` is the only source of subscription data
- **API-First Approach**: No complex real-time listeners, reliable server-side data fetching
- **Automatic USD Integration**: Webhooks automatically update USD balances
- **Separate Stripe Accounts**:
  - Regular Stripe customers for subscription payments (spending)
  - Stripe Connect accounts for creator payouts (receiving)
- **No Manual Fixes**: System works automatically without user intervention

## Environment Configuration

### Development (localhost:3000)
- Uses Stripe **test keys** (`sk_test_...`, `pk_test_...`)
- Points to **dev Firebase collections** (`dev_users`, `dev_subscriptions`)
- Test subscriptions have IDs starting with `sub_test_`

### Production/Preview (Vercel)
- Uses Stripe **live keys** (`sk_live_...`, `pk_live_...`)
- Points to **production Firebase collections** (`users`, `subscriptions`)
- Real subscriptions have standard Stripe IDs

### Environment Variables
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... (dev) / sk_live_... (prod)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... (dev) / pk_live_... (prod)

# Environment Detection
NODE_ENV=development/production
SUBSCRIPTION_ENV=development/production
```

## Subscription Tiers

### Standard Tiers
- **Tier 1 (Supporter)**: $5/month → $5 USD credits
- **Tier 2 (Advocate)**: $25/month → $25 USD credits
- **Tier 3 (Champion)**: $50/month → $50 USD credits

### Custom Tiers
- **Range**: $100+/month
- **USD Calculation**: $1 = $1 USD credit (direct 1:1 mapping)
- **Minimum Custom**: $100/month for custom amounts

## API Endpoints

### Core Subscription APIs

#### `/api/account-subscription` (SINGLE SOURCE OF TRUTH)
- **Purpose**: Get current user's subscription data using reliable server-side Firebase
- **Returns**: `{ hasSubscription, status, amount, cancelAtPeriodEnd, fullData: {...} }`
- **Environment**: Uses environment-aware collection paths
- **Approach**: API-first, no complex real-time listeners

#### `/api/subscription/create-setup-intent`
- **Purpose**: Create Stripe setup intent for new subscriptions
- **Flow**: Creates customer → setup intent → embedded checkout
- **Test Handling**: Creates real Stripe resources even in dev

#### `/api/subscription/create-with-payment-method`
- **Purpose**: Create subscription after payment method setup
- **Flow**: Creates subscription → updates Firestore → allocates USD credits

#### `/api/subscription/update`
- **Purpose**: Modify existing subscription amount/tier
- **Test Handling**: Detects `sub_test_` IDs and skips Stripe calls
- **Stripe Best Practice**: Uses `stripe.subscriptions.update()` with proration

#### `/api/subscription/reactivate`
- **Purpose**: Reactivate cancelled subscriptions
- **Features**: Supports amount changes during reactivation
- **Test Handling**: Detects `sub_test_` IDs and skips Stripe calls

#### `/api/subscription/cancel`
- **Purpose**: Cancel subscriptions
- **Options**: Immediate cancellation or at period end
- **Test Handling**: Detects `sub_test_` IDs and skips Stripe calls

#### `/api/subscription/portal`
- **Purpose**: Create Stripe customer portal sessions for subscription management
- **Features**: Allows users to manage billing, payment methods, and view invoices
- **Test Handling**: Requires real Stripe customer ID

### Test/Debug APIs

#### `/api/test-subscription`
- **Purpose**: Create fake subscriptions for development
- **Creates**: Mock subscription data with `sub_test_` IDs
- **Warning**: These don't exist in Stripe, only in Firestore

## Data Structure

### Firestore Subscription Document
```typescript
{
  id: 'current',
  userId: string,
  stripeSubscriptionId: string,
  stripeCustomerId: string,
  status: 'active' | 'cancelled' | 'past_due',
  amount: number,
  tier: 'tier1' | 'tier2' | 'tier3' | 'custom',
  tokens: number,
  currency: 'usd',
  interval: 'month',
  cancelAtPeriodEnd: boolean,
  currentPeriodStart: string,
  currentPeriodEnd: string,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection Paths
- **Development**: `dev_users/{userId}/dev_subscriptions/current`
- **Production**: `users/{userId}/subscriptions/current`

## Status Mapping (CRITICAL FIXES APPLIED 2025-01-28)

WeWrite subscription statuses map directly to Stripe statuses as follows:

| WeWrite Status | Stripe Status | Description | UI Display |
|---------------|---------------|-------------|------------|
| `active` | `active` | Subscription is active and paid | "Active" (green) |
| `incomplete` | `incomplete` | Payment setup required | "Payment Required" (orange) |
| `incomplete_expired` | `incomplete_expired` | Payment setup expired | "Payment Expired" (red) |
| `past_due` | `past_due` | Payment failed, retrying | "Past Due" (red) |
| `cancelled` | `canceled` | Subscription has been cancelled | "Canceled" (gray) |
| `trialing` | `trialing` | In free trial period | "Trial" (blue) |
| `paused` | `paused` | Subscription temporarily paused | "Paused" (gray) |

### Critical Fixes Applied (2025-01-28)

**Problem**: Users were seeing "cancelled" in UI while Stripe showed "incomplete" status.

**Root Cause**: Race condition protection in webhook handler was preventing legitimate "incomplete" statuses from being saved.

**Fixes Applied**:
1. **✅ Removed Race Condition Protection**: Webhook handlers now always use Stripe's status as source of truth
2. **✅ Enhanced Cache Invalidation**: Webhooks properly clear subscription caches immediately
3. **✅ Consistent Status Spelling**: Standardized on "cancelled" (not "canceled")
4. **✅ Enhanced Debug Logging**: Added specific logging for incomplete status transitions

**Code Change**:
```typescript
// BEFORE (Problematic):
if (currentStatus === 'active' && newStatus === 'incomplete') {
  subscriptionData.status = 'active'; // ❌ Prevented legitimate incomplete status
}

// AFTER (Fixed):
subscriptionData.status = newStatus; // ✅ Always use Stripe's status
```

## Stripe Customer Management

### Customer Creation
- **Description Format**: `WeWrite user {username} ({userId})`
- **Metadata**: `{ firebaseUID: userId, username: username }`
- **Email**: From Firebase Auth user record
- **Username Fallback**: `username → email prefix → "Unknown User"`

### Customer Updates
- Username changes should update Stripe customer description
- Payment method updates handled via Stripe APIs

### Implementation Status
- ✅ `/api/setup-intent` - Includes username in customer creation
- ✅ `/api/subscription/create-setup-intent` - Includes username in customer creation
- ✅ `/api/create-connect-account` - Includes username in account metadata
- ❌ Customer update on username change - Not implemented

## Test Subscription Handling

### Problem
Test subscriptions created via `/api/test-subscription` have fake Stripe IDs that don't exist in Stripe, causing API calls to fail.

### Solution
APIs detect test subscriptions by checking if ID starts with `sub_test_` and:
1. Skip Stripe API calls
2. Create mock responses
3. Still update Firestore data
4. Handle business logic normally

### Implementation Status
- ✅ `/api/subscription/update` - Handles test subscriptions
- ✅ `/api/subscription/reactivate` - Handles test subscriptions
- ✅ `/api/subscription/cancel` - Handles test subscriptions

## Token System Integration

### Token Allocation
- **Calculation**: $1 = 10 tokens per month
- **Distribution**: Users allocate tokens to pages/creators
- **Overspending**: Allowed, creates "unfunded" allocations

### Monthly Processing
- Tokens reset each month based on subscription amount
- Previous allocations preserved for subscription continuity
- Earnings calculated from token allocations

## Common Issues & Solutions

### Issue: Subscription upgrade button not working
**Cause**: Missing `stripeSubscriptionId` in API response
**Solution**: Ensure `/api/user-subscription` returns all required fields

### Issue: Test subscription modification fails
**Cause**: Fake Stripe IDs don't exist in Stripe
**Solution**: Add test subscription detection to all subscription APIs

### Issue: Environment data mixing
**Cause**: Incorrect collection path usage
**Solution**: Use `getSubCollectionPath()` for environment-aware paths

### Issue: Subscription status not updating after reactivation
**Cause**: Frontend not refreshing subscription data
**Solution**: Force refresh with cache busting after subscription changes

## Development Workflow

### Testing Subscriptions
1. Use `/api/test-subscription` to create test data
2. Test subscription modifications with test detection
3. For real Stripe testing, use test cards in checkout flow

### Debugging
1. Check terminal logs for Stripe API responses
2. Verify Firestore data in correct environment collections
3. Use browser dev tools to inspect API responses

## Future Improvements

### Planned Enhancements
1. Add test subscription detection to all subscription APIs
2. Improve error handling for subscription edge cases
3. Add subscription analytics and monitoring
4. Implement subscription pause/resume functionality

### Technical Debt
1. Consolidate subscription data fetching logic
2. Improve test subscription management
3. Add comprehensive subscription validation
4. Enhance webhook reliability

## Security Considerations

### API Security
- All subscription APIs require authentication
- User can only modify their own subscriptions
- Stripe webhook signatures verified

### Data Protection
- Sensitive payment data handled entirely by Stripe
- User data encrypted in transit and at rest
- Environment separation prevents data leakage

---

**Last Updated**: 2025-07-09 (Critical APIs implemented, system now complete)
**Maintainer**: Development Team
**Review Schedule**: Monthly or after major subscription changes
