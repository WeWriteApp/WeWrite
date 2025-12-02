# ARCHIVED — see `docs/PAYMENTS_AND_ALLOCATIONS.md`

## Payment Failure Tracking and Audit System

## Overview

WeWrite now includes comprehensive payment failure tracking and audit logging to provide maximum visibility into subscription payment issues. This system helps users troubleshoot payment problems and provides administrators with detailed audit trails for compliance and monitoring.

## Features

### 1. Enhanced Payment Failure Logging

- **Automatic Detection**: All payment failures are automatically detected via Stripe webhooks
- **Detailed Failure Reasons**: Captures specific failure reasons from Stripe (card declined, insufficient funds, expired card, etc.)
- **Failure Count Tracking**: Tracks the number of consecutive payment failures
- **Failure Type Classification**: Categorizes failures for intelligent retry scheduling
- **Audit Trail Integration**: All payment failures are logged to the subscription audit trail

### 2. Subscription Audit Log

Payment failures and recoveries are now prominently displayed in the subscription audit log with:

- **Visual Indicators**: Clear icons and color coding for different event types
- **Severity Levels**: 
  - `info` for first failure
  - `warning` for 2+ failures  
  - `critical` for 3+ failures
- **Detailed Information**: Failure reason, attempt count, failure type, and correlation IDs
- **Recovery Tracking**: Logs when payments recover after failures

### 3. Enhanced User Interface

#### Subscription History Component

The subscription history now includes:

- **Payment Failure Cards**: Prominently displayed failure events with red styling
- **Action Required Indicators**: Clear messaging about what users need to do
- **Payment Recovery Cards**: Green success indicators when payments recover
- **Invoice Links**: Direct links to Stripe hosted invoices when available

#### Failed Payment Recovery Component

Enhanced with:

- **Failure Count Display**: Shows current failure count and severity
- **Retry Information**: Displays next retry schedule and attempt history
- **Escalating Warnings**: Increasingly urgent messaging based on failure count
- **Help Text**: Detailed guidance on resolving payment issues

## Implementation Details

### Webhook Integration

Payment failures are captured in the Stripe webhook handler (`/api/webhooks/stripe-subscription/route.ts`):

```typescript
// Extract failure details
const failureReason = invoice.last_finalization_error?.message ||
                     invoice.charge?.failure_message ||
                     'Payment failed - reason unknown';

// Log to audit trail
await subscriptionAuditService.logPaymentFailed(userId, {
  amount,
  currency: invoice.currency.toUpperCase(),
  invoiceId: invoice.id,
  subscriptionId: subscription.id,
  failureReason,
  failureCount: failureRecord.failureCount,
  failureType: failureRecord.failureType
}, {
  source: 'stripe',
  correlationId,
  metadata: {
    stripeInvoiceId: invoice.id,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    nextRetryAt: failureRecord.nextRetryAt?.toISOString()
  }
});
```

### Audit Service Methods

New methods in `SubscriptionAuditService`:

- `logPaymentFailed()`: Logs payment failures with appropriate severity
- `logPaymentRecovered()`: Logs successful payments after failures

### Database Schema

Payment failures are stored in the `auditTrail` collection with:

```typescript
{
  userId: string,
  eventType: 'payment_failed' | 'payment_recovered',
  description: string,
  entityType: 'subscription',
  entityId: string, // subscription ID
  metadata: {
    amount: number,
    currency: string,
    invoiceId: string,
    failureReason: string,
    failureCount: number,
    failureType: string,
    correlationId: string,
    severity: 'info' | 'warning' | 'critical',
    hostedInvoiceUrl?: string
  },
  source: 'stripe',
  timestamp: Date
}
```

## API Endpoints

### GET /api/subscription-history

Returns subscription history including payment failure events:

```typescript
interface SubscriptionHistoryEvent {
  id: string;
  type: 'payment_failed' | 'payment_recovered' | ...;
  timestamp: Date;
  description: string;
  details: {
    amount?: number;
    currency?: string;
    failureReason?: string;
    failureCount?: number;
    failureType?: string;
    previousFailureCount?: number;
    metadata?: Record<string, any>;
  };
  source: 'stripe' | 'system' | 'user';
}
```

## User Experience

### For Users

1. **Immediate Visibility**: Payment failures appear immediately in subscription history
2. **Clear Messaging**: Detailed failure reasons and next steps
3. **Escalating Urgency**: UI becomes more urgent as failure count increases
4. **Recovery Confirmation**: Clear indication when payments recover

### For Administrators

1. **Comprehensive Audit Trail**: All payment events logged with full context
2. **Correlation Tracking**: Each event has a correlation ID for tracing
3. **Compliance Ready**: 7-year retention for financial records
4. **Monitoring Integration**: Critical failures logged for immediate attention

## Testing

Comprehensive tests cover:

- Payment failure audit logging with correct severity levels
- Payment recovery tracking after failures
- Subscription history API with failure events
- UI component rendering of failure information

## Security and Compliance

- All payment failure data is encrypted at rest
- Audit logs are immutable and tamper-evident
- 7-year retention period for financial compliance
- Correlation IDs enable full transaction tracing
- No sensitive payment data stored (only failure reasons and metadata)

## Future Enhancements

- Real-time notifications for critical payment failures
- Automated retry optimization based on failure patterns
- Integration with customer support systems
- Advanced analytics and reporting dashboards
