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

#### `/api/subscription/create-with-payment-method` ✅ *Duplicate-safe*
- **Purpose**: Create subscription after payment method setup
- **Flow**: Validates no existing subscription → creates subscription → updates Firestore → allocates USD credits
- **Validation**: Uses `SubscriptionValidationService` to prevent duplicates

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

### Validation & Services

#### `SubscriptionValidationService` 🆕
- **Purpose**: Centralized validation logic for subscription operations
- **Key Methods**:
  - `checkForExistingSubscriptions()` - Detects duplicate subscriptions
  - `validateSubscriptionCreation()` - Returns standardized error responses
  - `validateSubscriptionStatus()` - Ensures subscriptions are in expected state
  - `logValidationEvent()` - Structured logging for debugging
- **Used By**: All subscription creation APIs to prevent duplicates

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

## Status Mapping (CRITICAL FIXES APPLIED 2025-08-28)

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

### Critical Fixes Applied (2025-08-28)

**Problem**: Users were seeing "Payment Processing" UI while Stripe showed "incomplete" status with no actual charge.

**Root Cause**: Subscriptions were created with `payment_behavior: 'default_incomplete'` which creates incomplete subscriptions that require manual confirmation, instead of processing payments immediately.

**Fixes Applied**:
1. **✅ Fixed Payment Behavior**: Changed to `payment_behavior: 'error_if_incomplete'` for immediate processing
2. **✅ Instant Subscription Activation**: Subscriptions now activate immediately or fail with clear error
3. **✅ Removed Misleading "Processing" UI**: No more fake processing states
4. **✅ Enhanced Error Handling**: Clear error messages for payment failures
5. **✅ Added Audit Trail Logging**: Subscription update API now logs audit events for history

**Code Changes**:
```typescript
// BEFORE (Problematic):
payment_behavior: 'default_incomplete', // ❌ Created incomplete subscriptions
const subscription = await stripe.subscriptions.create({...}); // ❌ Always created new subscriptions

// AFTER (Fixed):
// 1. Check for existing subscriptions first
const existingSubscriptions = await stripe.subscriptions.list({
  customer: customerId,
  status: 'active',
  limit: 10
});

if (existingSubscriptions.data.length > 0) {
  return NextResponse.json({
    error: 'User already has active subscription. Use update endpoint instead.',
    shouldUpdate: true
  }, { status: 409 });
}

// 2. Use proper payment behavior
payment_behavior: 'error_if_incomplete', // ✅ Immediate processing or clear failure

// 3. Status validation:
if (subscription.status !== 'active') {
  throw new Error(`Subscription creation failed with status: ${subscription.status}`);
}
```

**New Subscription Creation Flow**:
1. User submits checkout form with payment method
2. **Validation**: `SubscriptionValidationService` checks for existing active subscriptions
3. **If existing subscription found**: Return 409 error with redirect to update flow
4. **If no existing subscription**: Create new subscription with `payment_behavior: 'error_if_incomplete'`
5. **Payment processed immediately** by Stripe (no incomplete states)
6. **Status validation**: Subscription must be `active` or creation fails with clear error
7. **Success page**: Shows immediate success for active subscriptions

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

## Subscription History & Audit Trail

### Audit Trail System
- **Service**: `subscriptionAuditService` logs all subscription events
- **Events**: Creation, updates, cancellations, reactivations, status changes
- **Storage**: Firestore subcollection `audit_trail` under user document
- **Display**: `SubscriptionHistory` component shows formatted history

### Event Types
- `subscription_created`: New subscription created
- `subscription_updated`: Amount/tier changed
- `subscription_cancelled`: Subscription cancelled
- `subscription_reactivated`: Cancelled subscription reactivated
- `subscription_status_changed`: Status updated via webhook

### History Display
- **Component**: `SubscriptionHistory.tsx`
- **Features**: Auto-refresh on page visibility, manual refresh button
- **Formatting**: Human-readable messages (e.g., "subscription upgraded from $10/mo to $25/mo")
- **Real-time**: Updates when returning from checkout success

### Implementation Status
- ✅ Webhook handlers log audit events
- ✅ Subscription update API logs audit events (fixed 2025-08-28)
- ✅ History component with refresh capabilities
- ✅ Auto-refresh on checkout return

## Token System Integration

### Token Allocation
- **Calculation**: $1 = 10 tokens per month
- **Distribution**: Users allocate tokens to pages/creators
- **Overspending**: Allowed, creates "unfunded" allocations

### Monthly Processing
- Tokens reset each month based on subscription amount
- Previous allocations preserved for subscription continuity
- Earnings calculated from token allocations

## Fund Account UI System

### UsdFundingTierSlider Component
- **Purpose**: Main subscription management interface
- **Features**: Slider for amount selection, upgrade/downgrade buttons
- **Smart Button Logic**: Hides button when no change needed (2025-08-28 fix)
- **Animation**: Smooth height transitions to prevent layout shifts

### Button State Logic
```typescript
// Hide button when slider matches current subscription amount
const shouldHideButton = currentSubscription?.amount === selectedAmount && selectedAmount !== 0;

// Animate height smoothly
className={`transition-all duration-300 ease-in-out ${
  shouldHideButton ? 'max-h-0 opacity-0 pt-0' : 'max-h-20 opacity-100 pt-2'
}`}
```

### Success Page Improvements
- **Status Checking**: Verifies actual subscription status before showing success
- **Conditional Messaging**: Different messages for active, incomplete, and processing states
- **Visual Feedback**: Confetti only for truly successful (active) subscriptions
- **Auto-refresh**: Reloads subscription data after successful checkout

## Common Issues & Solutions

### Issue: Button shows "Current Plan" instead of hiding
**Cause**: Button was disabled but still visible when no change needed
**Solution**: Hide button completely with smooth animation (fixed 2025-08-28)

### Issue: Multiple active subscriptions for same user in Stripe
**Cause**: Subscription creation APIs always created new subscriptions instead of checking for existing ones
**Solution**: Added duplicate subscription detection and redirect to update flow (fixed 2025-08-28)
**Cleanup**: Performed cleanup on 2025-08-28 - removed 24 duplicate subscriptions across 4 customers in dev environment

### Issue: Success page shows confetti for incomplete subscriptions
**Cause**: Success page didn't check actual subscription status
**Solution**: Added status verification before showing success UI (fixed 2025-08-28)

### Issue: Subscription history not updating after changes
**Cause**: Subscription update API wasn't logging audit events
**Solution**: Added audit trail logging to update API (fixed 2025-08-28)

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

## Recent Updates (2025-08-28)

### Major Architectural Fixes Applied
1. **🚨 CRITICAL: Fixed Duplicate Subscription Creation**: Subscription creation APIs now check for existing active subscriptions
2. **⚡ Fixed Instant Payment Processing**: Changed from `default_incomplete` to `error_if_incomplete` for immediate processing
3. **🧹 Completed Duplicate Cleanup**: Cleaned up 24 duplicate subscriptions across 4 customers in dev environment
4. **🔧 Added Validation Service**: Created `SubscriptionValidationService` for reusable validation logic
5. **📊 Enhanced Success Page**: Added status verification and conditional messaging
6. **📝 Added Audit Trail Logging**: All subscription changes now create history entries
7. **🎨 Enhanced Fund Account UI**: Smart button hiding with smooth animations
8. **🔄 Added Auto-refresh**: Subscription data refreshes after checkout completion

### Code Architecture Improvements
- **Centralized Validation**: `SubscriptionValidationService` handles all duplicate detection and status validation
- **Consistent Error Handling**: Standardized error responses across all subscription creation APIs
- **Improved Maintainability**: Reduced code duplication through shared validation service
- **Better Logging**: Structured logging for validation events and subscription state changes

---

**Last Updated**: 2025-08-28 (Major subscription flow fixes and UI improvements)
**Maintainer**: Development Team
**Review Schedule**: Monthly or after major subscription changes
