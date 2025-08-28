# Subscription System Troubleshooting Guide

## Quick Diagnosis Checklist

When subscription issues occur, check these items in order:

1. **Environment Check**: Are you using the correct Stripe keys for your environment?
2. **Data Location**: Is subscription data in the correct Firestore collection?
3. **API Response**: Does `/api/user-subscription` return all required fields?
4. **Stripe Sync**: Does the subscription exist in Stripe dashboard?
5. **Test vs Real**: Are you mixing test and real subscription data?

## Common Issues

### 1. Upgrade Button Not Working

**Symptoms**: Button click does nothing, no API calls, or silent failures

**Diagnosis Steps**:
```bash
# Check browser console for errors
# Check terminal logs for API calls
# Verify subscription data structure
```

**Common Causes**:
- Missing `stripeSubscriptionId` in subscription data
- Test subscription ID doesn't exist in Stripe
- Button disabled due to incorrect state logic
- Authentication issues

**Solutions**:
```typescript
// Ensure API returns all fields
const response = {
  tier: 'tier1',
  status: 'active', 
  amount: 10,
  stripeSubscriptionId: 'sub_...',  // ← Must be present
  stripeCustomerId: 'cus_...',      // ← Must be present
  cancelAtPeriodEnd: false,
  currentPeriodStart: '2025-07-07T15:44:16.938Z',
  currentPeriodEnd: '2025-08-06T15:44:16.938Z'
}
```

### 2. Test Subscription Errors

**Symptoms**: `Error: No such subscription: 'sub_test_...'`

**Root Cause**: Test subscriptions created via `/api/test-subscription` have fake IDs that don't exist in Stripe

**Solution**: Add test subscription detection to APIs
```typescript
const isTestSubscription = subscriptionId.startsWith('sub_test_');

if (isTestSubscription) {
  // Skip Stripe API calls, create mock response
  const mockResponse = {
    id: subscriptionId,
    status: 'active',
    // ... other mock fields
  };
} else {
  // Call real Stripe API
  const subscription = await stripe.subscriptions.update(subscriptionId, {...});
}
```

### 3. Environment Data Mixing

**Symptoms**: Dev data appears in prod, or vice versa

**Diagnosis**:
```bash
# Check environment variables
echo $NODE_ENV
echo $SUBSCRIPTION_ENV

# Check collection paths in logs
# Should see: dev_users/dev_subscriptions (dev) or users/subscriptions (prod)
```

**Solution**: Use environment-aware collection paths
```typescript
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../utils/environmentConfig';

const { parentPath, subCollectionName } = getSubCollectionPath(
  PAYMENT_COLLECTIONS.USERS, 
  userId, 
  PAYMENT_COLLECTIONS.SUBSCRIPTIONS
);
```

### 4. Subscription Status Not Updating

**Symptoms**: UI shows old status after subscription changes

**Common Causes**:
- Frontend cache not invalidated
- API not returning updated data
- Component not re-rendering

**Solutions**:
```typescript
// Force refresh subscription data
await fetchSubscription();

// Add cache busting
const response = await fetch(`/api/user-subscription?userId=${userId}&t=${Date.now()}`);

// Trigger page reload as fallback
setTimeout(() => {
  window.location.reload();
}, 1000);
```

### 5. Status Mismatch Between Stripe and UI (CRITICAL FIX APPLIED)

**Symptoms**:
- Stripe dashboard shows "incomplete" but UI shows "cancelled"
- Subscription appears active in Stripe but inactive in WeWrite
- Payment succeeded in Stripe but subscription still shows as failed

**Root Cause (FIXED 2025-01-28)**:
Race condition protection in webhook handler was preventing legitimate "incomplete" statuses from being saved to Firestore.

**Critical Fixes Applied**:
1. **✅ Removed Race Condition Protection**: Webhook handler now always uses Stripe's status as source of truth
2. **✅ Enhanced Cache Invalidation**: Webhooks now properly clear subscription caches immediately
3. **✅ Consistent Status Spelling**: Standardized on "cancelled" (not "canceled")
4. **✅ Enhanced Debug Logging**: Added specific logging for incomplete status transitions

**Resolution Steps**:
```bash
# 1. Check webhook logs for "🚨 INCOMPLETE STATUS" messages
# 2. Verify subscription status in Firestore matches Stripe
# 3. Clear browser cache and refresh
# 4. Check for webhook delivery failures in Stripe dashboard
```

**Code Changes Made**:
```typescript
// BEFORE (Problematic):
if (currentStatus === 'active' && newStatus === 'incomplete') {
  subscriptionData.status = 'active'; // ❌ Prevented legitimate incomplete status
}

// AFTER (Fixed):
subscriptionData.status = newStatus; // ✅ Always use Stripe's status
```

### 6. Stripe Webhook Failures

**Symptoms**: Subscription changes in Stripe don't reflect in app

**Diagnosis**:
```bash
# Check webhook logs in Stripe dashboard
# Check server logs for webhook processing
# Verify webhook endpoint URL is correct
```

**Common Issues**:
- Webhook signature verification failing
- Environment mismatch (dev webhook hitting prod data)
- Firestore permission errors
- Network timeouts

### 6. Payment Method Issues

**Symptoms**: Subscription creation fails, payment declined

**Diagnosis Steps**:
1. Check Stripe dashboard for failed payments
2. Verify test card numbers in development
3. Check customer payment method status
4. Review setup intent completion

**Test Cards** (Development Only):
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient Funds: 4000 0000 0000 9995
```

## Debugging Commands

### Check Subscription Data
```bash
# Terminal logs to watch
tail -f logs/subscription.log

# Browser console commands
console.log('Current subscription:', currentSubscription);
console.log('Button state:', getButtonState());
```

### API Testing
```bash
# Test subscription API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/account-subscription?userId=$USER_ID

# Test subscription update
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"subscriptionId":"sub_...","newTier":"tier2","newAmount":20}' \
  http://localhost:3000/api/subscription/update
```

### Firestore Queries
```javascript
// Check subscription document
const subscriptionRef = db.collection('dev_users')
  .doc(userId)
  .collection('dev_subscriptions')
  .doc('current');
const doc = await subscriptionRef.get();
console.log(doc.data());
```

## Emergency Procedures

### Reset Test Subscription
```bash
# Delete test subscription
curl -X DELETE -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID"}' \
  http://localhost:3000/api/test-subscription

# Create new test subscription
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","tier":"tier1","amount":10}' \
  http://localhost:3000/api/test-subscription
```

### Force Subscription Refresh
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
window.location.reload();
```

### Manual Firestore Fix
```javascript
// Update subscription status manually
await db.collection('dev_users')
  .doc(userId)
  .collection('dev_subscriptions')
  .doc('current')
  .update({
    status: 'active',
    cancelAtPeriodEnd: false,
    updatedAt: new Date()
  });
```

## Prevention Strategies

### Code Review Checklist
- [ ] Environment-aware collection paths used
- [ ] Test subscription detection implemented
- [ ] All required fields returned in API responses
- [ ] Error handling for Stripe API failures
- [ ] Proper authentication checks

### Testing Protocol
1. Test in development with test subscriptions
2. Test in development with real Stripe test mode
3. Test subscription modifications and cancellations
4. Verify webhook processing
5. Test environment separation

### Monitoring
- Set up alerts for subscription API failures
- Monitor Stripe webhook success rates
- Track subscription status inconsistencies
- Log all subscription state changes

---

**Emergency Contact**: Development Team
**Last Updated**: 2025-07-09
**Next Review**: After any subscription system changes
