# Webhook Migration Guide: Moving to Unified Webhook Architecture

## Overview

This guide outlines the migration from multiple webhook endpoints to a single unified webhook endpoint for better reliability and maintainability.

## Current State (Before Migration)

### Multiple Webhook Endpoints:
1. `/api/webhooks/stripe-subscription` - Main subscription events
2. `/api/webhooks/stripe-payouts` - Payout events  
3. `/api/webhooks/subscription-status` - Duplicate subscription handling
4. `/api/webhooks/stripe` - Legacy (disabled)

### Issues with Current Architecture:
- ❌ Duplicate event processing
- ❌ Race conditions between handlers
- ❌ Complex Stripe dashboard configuration
- ❌ Multiple webhook secrets to manage

## Target State (After Migration)

### Single Unified Endpoint:
- `/api/webhooks/stripe-unified` - All Stripe events

### Benefits:
- ✅ No duplicate processing
- ✅ Single source of truth
- ✅ Simplified configuration
- ✅ Better error handling and monitoring
- ✅ Atomic event processing

## Migration Steps

### Phase 1: Deploy Unified Webhook (Safe)
1. Deploy the new unified webhook endpoint
2. Keep existing endpoints active
3. Test unified endpoint with webhook testing tools

### Phase 2: Configure Stripe Dashboard
1. **In Stripe Dashboard:**
   - Go to Developers → Webhooks
   - Create new webhook endpoint: `https://getwewrite.app/api/webhooks/stripe-unified`
   - Select all required events:
     ```
     checkout.session.completed
     customer.subscription.created
     customer.subscription.updated
     customer.subscription.deleted
     invoice.payment_succeeded
     invoice.payment_failed
     transfer.created
     transfer.paid
     transfer.failed
     account.updated
     ```
   - Copy the webhook signing secret

2. **Update Environment Variables:**
   ```bash
   # Use the same webhook secret for unified endpoint
   STRIPE_WEBHOOK_SECRET=whsec_unified_webhook_secret
   ```

### Phase 3: Test Unified Webhook
1. **Test with Stripe CLI:**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe-unified
   stripe trigger customer.subscription.created
   stripe trigger invoice.payment_succeeded
   ```

2. **Monitor logs for:**
   - Successful event processing
   - No duplicate processing
   - All handlers executing correctly

### Phase 4: Switch Traffic (Production)
1. **Update webhook URL in Stripe Dashboard:**
   - Change existing webhook endpoints to point to unified endpoint
   - OR disable old endpoints and use only the new one

2. **Monitor for 24-48 hours:**
   - Check webhook delivery success rates
   - Monitor application logs for errors
   - Verify subscription and payout processing

### Phase 5: Cleanup (After Verification)
1. **Remove old webhook endpoints:**
   - Delete old webhook configurations from Stripe
   - Archive old webhook handler files
   - Update documentation

## Testing Checklist

### Before Migration:
- [ ] Unified webhook endpoint deployed
- [ ] Health check endpoint responding: `/api/webhooks/stripe-unified`
- [ ] All handler functions properly exported
- [ ] Environment variables configured

### During Migration:
- [ ] New webhook endpoint configured in Stripe
- [ ] Test events processed successfully
- [ ] No duplicate processing detected
- [ ] All event types handled correctly

### After Migration:
- [ ] 24-hour monitoring period completed
- [ ] No webhook delivery failures
- [ ] Subscription processing working
- [ ] Payout processing working
- [ ] Old endpoints disabled/removed

## Rollback Plan

If issues occur during migration:

1. **Immediate Rollback:**
   - Re-enable old webhook endpoints in Stripe dashboard
   - Verify old endpoints are processing events
   - Disable unified webhook temporarily

2. **Investigation:**
   - Check unified webhook logs for errors
   - Verify handler function imports
   - Test individual event types

3. **Fix and Retry:**
   - Address identified issues
   - Re-test unified webhook
   - Retry migration when stable

## Event Routing Logic

The unified webhook routes events as follows:

```typescript
// Subscription Events → Multiple Handlers
if (isSubscriptionEvent(event.type)) {
  await handleSubscriptionWebhookEvent(event);     // Main processing
  await handleSubscriptionEvent(event);            // Pledge budget validation
}

// Payout Events → Payout Handler
if (isPayoutEvent(event.type)) {
  await stripePayoutService.handleWebhookEvent(event);
}
```

## Monitoring and Alerting

### Key Metrics to Monitor:
- Webhook delivery success rate (should be >99%)
- Event processing latency
- Handler execution success rates
- Duplicate event detection (should be 0)

### Alerts to Configure:
- Webhook endpoint returning 5xx errors
- Event processing taking >30 seconds
- Missing required event handlers
- Webhook signature verification failures

## FAQ

**Q: Will this cause downtime?**
A: No, the migration can be done with zero downtime by running both old and new endpoints in parallel.

**Q: What if the unified webhook fails?**
A: Each handler is wrapped in try-catch blocks, so one failure won't break others. Plus we have a rollback plan.

**Q: How do we prevent duplicate processing during migration?**
A: The unified webhook includes deduplication logic and we'll disable old endpoints once the new one is verified.

**Q: What about webhook secrets?**
A: We can reuse the existing webhook secret or generate a new one. The unified endpoint uses the same secret for all events.
