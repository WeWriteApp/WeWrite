# WeWrite Webhook Setup Guide

## Overview

WeWrite uses Stripe webhooks to handle real-time updates for payments and payouts. This guide covers the complete setup process for production deployment.

## Required Webhook Endpoints

### 1. Payout Webhook (`/api/webhooks/stripe-payouts`)
**Purpose**: Handles payout and transfer events
**Events**:
- `transfer.created` - When a transfer to a connected account is created
- `transfer.paid` - When a transfer is successfully completed
- `transfer.failed` - When a transfer fails
- `account.updated` - When a connected account's status changes
- `payout.created` - When a payout is created
- `payout.paid` - When a payout is completed
- `payout.failed` - When a payout fails

**Environment Variable**: `STRIPE_WEBHOOK_SECRET_PAYOUTS`

### 2. Subscription Webhook (`/api/webhooks/stripe-subscription`)
**Purpose**: Handles subscription and payment events
**Events**:
- `checkout.session.completed` - When a checkout session is completed
- `customer.subscription.created` - When a subscription is created
- `customer.subscription.updated` - When a subscription is modified
- `customer.subscription.deleted` - When a subscription is cancelled
- `invoice.payment_succeeded` - When a payment succeeds
- `invoice.payment_failed` - When a payment fails

**Environment Variable**: `STRIPE_WEBHOOK_SECRET`

## Setup Methods

### Method 1: Automated Setup (Recommended)

1. **Set Environment Variables**:
   ```bash
   export STRIPE_SECRET_KEY=sk_test_... # or sk_live_... for production
   export NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

2. **Run Setup Script**:
   ```bash
   node scripts/setup-payout-webhooks.js
   ```

3. **Add Webhook Secrets to Environment**:
   The script will output the webhook secrets. Add them to your `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET_PAYOUTS=whsec_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Method 2: Manual Setup via Stripe Dashboard

1. **Login to Stripe Dashboard**
   - Go to https://dashboard.stripe.com
   - Navigate to Developers → Webhooks

2. **Create Payout Webhook**
   - Click "Add endpoint"
   - URL: `https://your-domain.com/api/webhooks/stripe-payouts`
   - Events: Select the payout events listed above
   - Description: "WeWrite Payout Webhook"

3. **Create Subscription Webhook**
   - Click "Add endpoint"
   - URL: `https://your-domain.com/api/webhooks/stripe-subscription`
   - Events: Select the subscription events listed above
   - Description: "WeWrite Subscription Webhook"

4. **Copy Webhook Secrets**
   - Click on each webhook endpoint
   - Copy the "Signing secret" (starts with `whsec_`)
   - Add to your environment variables

## Environment Variables Required

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_... # or sk_live_... for production
STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_... for production

# Webhook Secrets
STRIPE_WEBHOOK_SECRET=whsec_... # For subscription webhook
STRIPE_WEBHOOK_SECRET_PAYOUTS=whsec_... # For payout webhook

# Application URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Testing Webhook Setup

### 1. Health Check Endpoints
Test that your webhook endpoints are accessible:

```bash
# Test payout webhook
curl https://your-domain.com/api/webhooks/stripe-payouts

# Test subscription webhook  
curl https://your-domain.com/api/webhooks/stripe-subscription
```

Expected response:
```json
{
  "status": "ok",
  "service": "stripe-payouts-webhook",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Stripe CLI Testing
Use Stripe CLI to test webhook events locally:

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward events to local development
stripe listen --forward-to localhost:3000/api/webhooks/stripe-payouts
stripe listen --forward-to localhost:3000/api/webhooks/stripe-subscription

# Trigger test events
stripe trigger transfer.created
stripe trigger invoice.payment_succeeded
```

### 3. Production Testing
After deployment, test with real Stripe events:

1. Create a test subscription
2. Process a test payout
3. Check webhook delivery in Stripe Dashboard
4. Verify events are processed correctly in your application logs

## Troubleshooting

### Common Issues

1. **Webhook Signature Verification Failed**
   - Check that `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint
   - Ensure the raw request body is used for signature verification
   - Verify the webhook secret is for the correct environment (test/live)

2. **Webhook Endpoint Not Found (404)**
   - Verify the webhook URL is correct
   - Check that the Next.js route file exists
   - Ensure the application is deployed and accessible

3. **Webhook Timeout**
   - Webhook handlers should respond within 20 seconds
   - Use async processing for long-running operations
   - Return 200 status immediately, process in background

4. **Duplicate Event Processing**
   - Implement idempotency using Stripe's `event.id`
   - Store processed event IDs to prevent duplicate processing
   - Use database transactions for critical operations

### Monitoring Webhook Health

1. **Stripe Dashboard**
   - Monitor webhook delivery success rates
   - Check for failed deliveries and retry attempts
   - Review webhook logs for errors

2. **Application Logs**
   - Monitor webhook processing logs
   - Set up alerts for webhook failures
   - Track processing times and success rates

3. **Database Monitoring**
   - Verify payout status updates are applied
   - Check for orphaned records or inconsistent states
   - Monitor transaction completion rates

## Security Considerations

1. **Always Verify Webhook Signatures**
   - Never process webhooks without signature verification
   - Use Stripe's official libraries for verification
   - Reject requests with invalid signatures

2. **Use HTTPS Only**
   - Webhook endpoints must use HTTPS in production
   - Stripe will not deliver to HTTP endpoints

3. **Implement Rate Limiting**
   - Protect webhook endpoints from abuse
   - Use appropriate rate limiting for webhook traffic

4. **Secure Environment Variables**
   - Store webhook secrets securely
   - Rotate secrets periodically
   - Use different secrets for test and live environments

## Production Checklist

- [ ] Webhook endpoints are accessible via HTTPS
- [ ] Health check endpoints return 200 status
- [ ] Environment variables are configured correctly
- [ ] Webhook signature verification is working
- [ ] Test events are processed successfully
- [ ] Monitoring and alerting are set up
- [ ] Error handling and retry logic are implemented
- [ ] Idempotency is implemented to prevent duplicate processing
- [ ] Database transactions are used for critical operations
- [ ] Webhook secrets are stored securely

## Next Steps

After webhook setup is complete:

1. **Test End-to-End Payout Flow**
   - Create test user with token earnings
   - Request payout through UI
   - Verify webhook events are processed
   - Confirm payout status updates correctly

2. **Monitor Production Deployment**
   - Watch webhook delivery rates
   - Monitor application logs for errors
   - Set up alerts for failed webhooks

3. **Implement Additional Features**
   - User notifications for payout status changes
   - Admin tools for webhook monitoring
   - Retry mechanisms for failed operations
