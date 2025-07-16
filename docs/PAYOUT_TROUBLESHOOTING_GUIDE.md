# WeWrite Payout System Troubleshooting Guide

## Quick Diagnostic Tools

### Health Check Commands

```bash
# Check webhook endpoints
node scripts/validate-webhooks.js

# Test notification system
node scripts/test-notification-system.js

# Test error logging
node scripts/test-error-logging.js

# Test webhook processing
node scripts/test-webhook-processing.js
```

### API Health Checks

```bash
# Check payout API
curl -s http://localhost:3000/api/payouts

# Check admin monitoring
curl -s http://localhost:3000/api/admin/payouts/monitoring

# Check webhook health
curl -s http://localhost:3000/api/webhooks/stripe-payouts
```

## Common Issues & Solutions

### 1. Stuck Payouts

**Symptoms**:
- Payouts remain in "processing" status for >24 hours
- Users reporting delayed payments
- High number of processing payouts in admin dashboard

**Diagnosis**:
```bash
# Check for stuck payouts
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "https://app.wewrite.com/api/admin/payouts/monitoring"

# Look for stuckPayouts array in response
```

**Root Causes**:
- Stripe API issues or maintenance
- Connected account problems
- Network connectivity issues
- Webhook delivery failures

**Solutions**:

1. **Check Stripe Dashboard**:
   - Log into Stripe dashboard
   - Check transfer status
   - Look for any account restrictions

2. **Manual Retry via Admin Tools**:
   ```bash
   curl -X POST -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"action":"retry","payoutId":"payout_123","reason":"Manual retry"}' \
     "https://app.wewrite.com/api/admin/payouts"
   ```

3. **Force Complete (if verified externally)**:
   ```bash
   curl -X POST -H "Authorization: Bearer ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"action":"force_complete","payoutId":"payout_123","reason":"Verified in Stripe dashboard"}' \
     "https://app.wewrite.com/api/admin/payouts"
   ```

### 2. High Error Rates

**Symptoms**:
- Increased error notifications
- Multiple payout failures
- Users unable to request payouts

**Diagnosis**:
```bash
# Check error logs
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "https://app.wewrite.com/api/admin/payouts/errors?severity=high&timeRange=24h"
```

**Common Error Categories**:

#### Stripe API Errors
- **insufficient_funds**: Platform account lacks funds
- **account_closed**: Recipient account closed
- **invalid_request**: API parameter issues

**Solutions**:
- Check platform Stripe account balance
- Verify recipient account status
- Review API request parameters

#### Database Errors
- **firestore_timeout**: Database connection issues
- **permission_denied**: Authentication problems

**Solutions**:
- Check Firebase service status
- Verify service account permissions
- Review database rules

#### Validation Errors
- **minimum_threshold**: Amount below minimum
- **invalid_currency**: Unsupported currency

**Solutions**:
- Update validation rules
- Check user input handling
- Verify currency support

### 3. Webhook Failures

**Symptoms**:
- Payout status not updating in UI
- Users not receiving notifications
- Webhook delivery failures in Stripe dashboard

**Diagnosis**:
```bash
# Test webhook endpoint
curl -X GET http://localhost:3000/api/webhooks/stripe-payouts

# Check webhook signature verification
node scripts/test-webhook-processing.js
```

**Root Causes**:
- Incorrect webhook URL
- Invalid webhook signature
- Endpoint returning errors
- Network connectivity issues

**Solutions**:

1. **Verify Webhook Configuration**:
   ```bash
   # Re-run webhook setup
   node scripts/setup-payout-webhooks.js
   ```

2. **Check Webhook Secrets**:
   - Verify `STRIPE_WEBHOOK_SECRET_PAYOUTS` environment variable
   - Ensure secrets match Stripe dashboard

3. **Test Webhook Processing**:
   ```bash
   # Send test webhook events
   stripe trigger transfer.created
   stripe trigger transfer.paid
   ```

### 4. User Account Issues

**Symptoms**:
- Users unable to set up payouts
- "Account not verified" errors
- Missing bank account information

**Diagnosis**:
```bash
# Check user's payout recipient status
curl -H "Authorization: Bearer USER_TOKEN" \
  "https://app.wewrite.com/api/payouts"
```

**Root Causes**:
- Incomplete Stripe Connect onboarding
- Missing required information
- Account verification pending

**Solutions**:

1. **Check Stripe Connect Account**:
   - Log into Stripe dashboard
   - Navigate to Connect > Accounts
   - Check account status and requirements

2. **Re-initiate Onboarding**:
   - Direct user to complete Stripe Connect flow
   - Ensure all required fields are completed

3. **Manual Account Review**:
   - Review account in Stripe dashboard
   - Contact Stripe support if needed

### 5. Notification Issues

**Symptoms**:
- Users not receiving payout notifications
- Email delivery failures
- In-app notifications not appearing

**Diagnosis**:
```bash
# Check notification preferences
curl -H "Authorization: Bearer USER_TOKEN" \
  "https://app.wewrite.com/api/payouts/notifications"

# Test notification system
node scripts/test-notification-system.js
```

**Root Causes**:
- Email service configuration issues
- User notification preferences disabled
- Database notification records not created

**Solutions**:

1. **Check Email Service**:
   - Verify email service configuration
   - Check email delivery logs
   - Test email templates

2. **Update Notification Preferences**:
   ```bash
   curl -X PUT -H "Authorization: Bearer USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email":{"enabled":true},"inApp":{"enabled":true}}' \
     "https://app.wewrite.com/api/payouts/notifications"
   ```

3. **Manual Notification Trigger**:
   - Use admin tools to resend notifications
   - Check notification database records

## Performance Issues

### Slow API Responses

**Symptoms**:
- API timeouts
- Slow dashboard loading
- User complaints about performance

**Diagnosis**:
```bash
# Check API response times
time curl -H "Authorization: Bearer TOKEN" \
  "https://app.wewrite.com/api/payouts"

# Monitor database queries
# Check Firestore metrics in Firebase console
```

**Solutions**:
- Optimize database queries
- Add pagination to large result sets
- Implement caching where appropriate
- Review database indexes

### High Memory Usage

**Symptoms**:
- Vercel function timeouts
- Out of memory errors
- Slow processing

**Solutions**:
- Optimize data processing
- Implement streaming for large datasets
- Review memory-intensive operations
- Consider function size limits

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Payout Success Rate**: Should be >99%
2. **Processing Time**: Should be <24 hours
3. **Error Rate**: Should be <1%
4. **Webhook Delivery Rate**: Should be >99%

### Setting Up Alerts

```javascript
// Example alert configuration
const alerts = {
  payoutSuccessRate: {
    threshold: 99,
    timeWindow: '1h',
    action: 'email_admin'
  },
  processingTime: {
    threshold: 24 * 60 * 60 * 1000, // 24 hours
    timeWindow: '1h',
    action: 'slack_notification'
  },
  errorRate: {
    threshold: 1,
    timeWindow: '15m',
    action: 'page_oncall'
  }
};
```

### External Monitoring Integration

```bash
# Sentry integration
export SENTRY_DSN="your-sentry-dsn"

# DataDog integration
export DATADOG_API_KEY="your-datadog-key"

# Custom monitoring webhook
export MONITORING_WEBHOOK_URL="your-webhook-url"
```

## Emergency Procedures

### Critical System Failure

1. **Immediate Actions**:
   - Check system health dashboard
   - Verify external service status (Stripe, Firebase)
   - Review recent deployments

2. **Communication**:
   - Notify users via status page
   - Alert engineering team
   - Prepare incident report

3. **Recovery**:
   - Rollback recent changes if needed
   - Implement temporary fixes
   - Monitor system recovery

### Data Integrity Issues

1. **Detection**:
   - Automated consistency checks
   - User reports of incorrect balances
   - Audit trail discrepancies

2. **Investigation**:
   - Review transaction logs
   - Check database consistency
   - Verify external system data

3. **Resolution**:
   - Implement data fixes
   - Reconcile with external systems
   - Update audit procedures

## Support Escalation

### Level 1: User Support
- Basic troubleshooting
- Account verification
- Status updates

### Level 2: Technical Support
- API debugging
- Configuration issues
- Integration problems

### Level 3: Engineering
- System failures
- Data integrity issues
- Security incidents

### Emergency Contacts

- **Engineering On-Call**: engineering-oncall@wewrite.com
- **Finance Team**: finance@wewrite.com
- **Security Team**: security@wewrite.com

## Useful Commands & Scripts

### Database Queries

```javascript
// Check payout status distribution
db.collection('payouts')
  .where('status', '==', 'failed')
  .orderBy('updatedAt', 'desc')
  .limit(10)
  .get()
```

### Stripe CLI Commands

```bash
# Listen to webhooks locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe-payouts

# Trigger test events
stripe trigger transfer.created
stripe trigger transfer.paid
stripe trigger transfer.failed

# Check account status
stripe accounts retrieve acct_123
```

### Log Analysis

```bash
# Search error logs
grep "ERROR" /var/log/payout-service.log | tail -20

# Filter by correlation ID
grep "correlation-id-123" /var/log/payout-service.log

# Count error types
grep "StripeError" /var/log/payout-service.log | wc -l
```

---

*Last Updated: January 15, 2024*
*Version: 1.0.0*
