# WeWrite Subscription Management Guide

This document outlines the subscription management system, cleanup procedures, and best practices for maintaining a clean billing experience.

## Overview

WeWrite implements a **single-subscription-per-customer** policy to ensure:
- Clean billing experience in Stripe Customer Portal
- Simplified subscription management
- Reduced customer confusion
- Consistent token allocation

## Current Implementation

### Single Subscription Enforcement

The system automatically prevents multiple active subscriptions:

```typescript
// Before creating new subscription, cancel existing ones
const existingSubscriptions = await stripe.subscriptions.list({
  customer: stripeCustomerId,
  status: 'active',
  limit: 10,
});

for (const existingSubscription of existingSubscriptions.data) {
  await stripe.subscriptions.cancel(existingSubscription.id);
}
```

**Statuses automatically cancelled:**
- `active` (keeps newest, cancels others)
- `incomplete` 
- `past_due`
- `unpaid`

### Customer Portal Optimization

The portal automatically cleans up problematic subscriptions before display:

1. **Pre-portal cleanup**: Removes incomplete/problematic subscriptions
2. **Custom configuration**: Optimized portal settings for clean UX
3. **Metadata tracking**: Identifies WeWrite-specific portal configurations

## Cleanup Utilities

### 1. Administrative API Endpoint

**Endpoint**: `POST /api/admin/subscription-cleanup`

**Usage**:
```bash
curl -X POST /api/admin/subscription-cleanup \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": true,
    "maxCustomers": 50,
    "includeStatuses": ["canceled", "incomplete", "past_due", "unpaid"]
  }'
```

**Parameters**:
- `dryRun` (boolean): Preview changes without executing
- `customerId` (string): Target specific customer
- `maxCustomers` (number): Limit processing scope
- `includeStatuses` (array): Subscription statuses to clean up

### 2. Command Line Script

**Location**: `scripts/subscription-cleanup.js`

**Usage**:
```bash
# Dry run (safe preview)
node scripts/subscription-cleanup.js --dry-run

# Target specific customer
node scripts/subscription-cleanup.js --customer=cus_123456789 --execute

# Process multiple customers
node scripts/subscription-cleanup.js --execute --max-customers=10
```

**Environment Variables Required**:
```bash
STRIPE_SECRET_KEY=sk_...
FIREBASE_SERVICE_ACCOUNT='{...}'  # Optional for local dev
```

## Monitoring and Alerting

### Monitoring API

**Endpoint**: `GET /api/admin/subscription-monitor`

**Usage**:
```bash
curl /api/admin/subscription-monitor?maxCustomers=100&includeMinorIssues=true \
  -H "Authorization: Bearer <admin-token>"
```

**Issue Types Detected**:
- `multiple_active`: Multiple active subscriptions (URGENT)
- `multiple_total`: Excessive historical subscriptions
- `orphaned_subscription`: Subscriptions without Firebase users

### Recommended Monitoring Schedule

1. **Daily**: Check for multiple active subscriptions
2. **Weekly**: Full monitoring scan with minor issues
3. **Monthly**: Comprehensive cleanup of historical data

## Best Practices

### For Developers

1. **Always use the subscription service**: Don't create subscriptions directly
2. **Test with cleanup**: Verify cleanup works in development
3. **Monitor logs**: Watch for cancellation patterns
4. **Handle edge cases**: Account for Stripe API failures

### For Administrators

1. **Run dry-run first**: Always preview changes before executing
2. **Monitor regularly**: Set up weekly monitoring checks
3. **Keep logs**: Maintain cleanup execution logs
4. **Backup strategy**: Ensure you can recover from mistakes

### For Customer Support

1. **Check portal first**: Most issues resolve with portal cleanup
2. **Use monitoring API**: Identify customer-specific issues
3. **Document patterns**: Track common subscription problems
4. **Escalate appropriately**: Know when to involve developers

## Troubleshooting

### Common Issues

**Multiple Active Subscriptions**:
```bash
# Quick fix for specific customer
node scripts/subscription-cleanup.js --customer=cus_123 --execute
```

**Portal Shows Too Many Subscriptions**:
- Portal cleanup runs automatically
- Manual cleanup may be needed for historical data
- Check portal configuration is applied

**Orphaned Subscriptions**:
- Usually indicates data sync issues
- Check Firebase user linking
- May require manual investigation

### Emergency Procedures

**If Customer Reports Multiple Charges**:
1. Run monitoring for that customer
2. Execute immediate cleanup
3. Check for refund requirements
4. Document the incident

**If Cleanup Script Fails**:
1. Check Stripe API limits
2. Verify authentication
3. Run with smaller batch sizes
4. Check individual customer manually

## API Reference

### Cleanup Response Format

```json
{
  "success": true,
  "dryRun": false,
  "summary": {
    "totalCustomersProcessed": 25,
    "totalSubscriptionsCancelled": 47,
    "customersWithMultipleSubscriptions": 12,
    "errors": [],
    "results": [...]
  }
}
```

### Monitoring Response Format

```json
{
  "success": true,
  "report": {
    "timestamp": "2024-01-15T10:30:00Z",
    "totalCustomersScanned": 100,
    "customersWithIssues": 3,
    "issueBreakdown": {
      "multipleActive": 1,
      "multipleTotal": 2,
      "orphanedSubscriptions": 0
    },
    "recommendations": [...]
  }
}
```

## Security Considerations

1. **Admin-only access**: All cleanup endpoints require admin privileges
2. **Audit logging**: All cleanup actions are logged
3. **Dry-run default**: Scripts default to safe preview mode
4. **Rate limiting**: Respect Stripe API limits
5. **Error handling**: Graceful failure without data corruption

## Future Enhancements

1. **Automated scheduling**: Cron jobs for regular cleanup
2. **Slack notifications**: Alert on critical issues
3. **Customer notifications**: Inform users of cleanup actions
4. **Advanced analytics**: Track cleanup effectiveness
5. **Self-healing**: Automatic resolution of common issues
