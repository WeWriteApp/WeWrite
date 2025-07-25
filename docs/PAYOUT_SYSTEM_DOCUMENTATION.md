# WeWrite Payout System Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [API Reference](#api-reference)
5. [Configuration](#configuration)
6. [Monitoring & Logging](#monitoring--logging)
7. [Error Handling](#error-handling)
8. [Security](#security)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

## Overview

The WeWrite Payout System is a comprehensive financial infrastructure that handles automated token-to-cash payouts for content creators. The system integrates with Stripe Connect to process payments while maintaining full audit trails and compliance requirements.

### Key Features

- **Automated Payout Processing**: Scheduled monthly payouts based on token earnings
- **Multi-Currency Support**: USD, EUR, GBP, CAD, AUD with automatic conversion
- **Intelligent Retry Logic**: Exponential backoff with configurable retry policies
- **Real-time Status Tracking**: Complete payout lifecycle monitoring
- **Comprehensive Error Logging**: Structured logging with correlation IDs
- **Admin Intervention Tools**: Manual override and investigation capabilities
- **User Notifications**: Email, in-app, and push notifications for status changes
- **Compliance & Audit**: Full transaction history and regulatory compliance

### System Requirements

- **Minimum Payout**: $25.00 USD (configurable)
- **Processing Time**: 1-3 business days for ACH transfers
- **Supported Countries**: US, UK, Canada, Australia, EU (27 countries)
- **Payment Methods**: Bank transfers (ACH, SEPA, BACS)
- **Uptime SLA**: 99.9% availability

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Interface   │    │   API Gateway    │    │   Core Services  │
│                 │    │                 │    │                 │
│ • Payout Dashboard │    │ • Authentication │    │ • Payout Service │
│ • Status Tracking  │    │ • Rate Limiting  │    │ • Retry Service  │
│ • Preferences      │    │ • Request Routing│    │ • Status Service │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   External APIs  │    │   Data Layer     │    │   Monitoring     │
│                 │    │                 │    │                 │
│ • Stripe Connect │    │ • Firestore DB   │    │ • Error Logging  │
│ • Stripe Webhooks│    │ • Collections    │    │ • Health Checks  │
│ • Email Service  │    │ • Transactions   │    │ • Alerting       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow

1. **Token Earnings Accumulation**: Users earn tokens through content engagement
2. **Payout Eligibility Check**: System validates minimum thresholds and account status
3. **Payout Creation**: Automated scheduler creates payout records
4. **Stripe Processing**: Transfers are created via Stripe Connect API
5. **Status Tracking**: Webhooks update payout status in real-time
6. **User Notification**: Multi-channel notifications for status changes
7. **Completion**: Funds arrive in user's bank account

### Environment Architecture

- **Development**: Local development with test Stripe keys
- **Preview**: Staging environment with Stripe test mode
- **Production**: Live environment with production Stripe keys

## Core Components

### 1. Payout Service (`StripePayoutService`)

**Purpose**: Core payout processing logic and Stripe integration

**Key Methods**:
- `processPayout(payoutId)`: Main payout processing entry point
- `createStripeTransfer()`: Creates Stripe Connect transfers
- `verifyStripeAccount()`: Validates recipient account status
- `handleWebhookEvent()`: Processes Stripe webhook events

**Configuration**:
```typescript
{
  minimumPayoutThreshold: 25.00,
  platformFeePercentage: 0.0,
  stripeConnectFeePercentage: 0.0025,
  newAccountReservePeriod: 7
}
```

### 2. Status Service (`PayoutStatusService`)

**Purpose**: Centralized payout status management with atomic updates

**Key Features**:
- Status transition validation
- Atomic database updates
- Status history tracking
- Automatic notifications

**Status Flow**:
```
pending → processing → completed
    ↓         ↓
cancelled   failed → pending (retry)
```

### 3. Retry Service (`PayoutRetryService`)

**Purpose**: Intelligent retry logic for failed payouts

**Configuration**:
```typescript
{
  maxRetries: 3,
  baseDelayMs: 300000, // 5 minutes
  maxDelayMs: 86400000, // 24 hours
  backoffMultiplier: 2,
  retryableFailureCodes: [
    'account_closed',
    'insufficient_funds',
    'debit_not_authorized',
    'generic_decline',
    'processing_error'
  ]
}
```

### 4. Notification Service (`PayoutNotificationService`)

**Purpose**: Multi-channel user notifications for payout events

**Channels**:
- **Email**: HTML templates with variable substitution
- **In-App**: Real-time notifications with read/unread status
- **Push**: Mobile push notifications (optional)

**Event Types**:
- `payout_initiated`: Payout has started processing
- `payout_completed`: Payout successfully completed
- `payout_failed`: Payout failed with reason
- `payout_retry_scheduled`: Automatic retry scheduled

### 5. Error Logger (`PayoutErrorLogger`)

**Purpose**: Comprehensive error tracking with correlation IDs

**Features**:
- Automatic error categorization
- Severity determination
- Searchable error logs
- External monitoring integration

**Error Categories**:
- `stripe_api`: Stripe API errors
- `database`: Firestore/database errors
- `validation`: Input validation errors
- `network`: Network connectivity issues
- `authentication`: Auth/permission errors
- `configuration`: Environment/config errors

### 6. Monitoring Service (`PayoutMonitoringService`)

**Purpose**: System health monitoring and alerting

**Metrics**:
- Payout success rates
- Processing times
- Error rates by category
- Volume trends
- Stuck payout detection

## API Reference

### Payout Management

#### Get User Payouts
```http
GET /api/payouts
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "payouts": [...],
    "recipient": {...},
    "summary": {...}
  }
}
```

#### Request Payout
```http
POST /api/payouts/earnings
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 125.50
}
```

#### Get Payout Preferences
```http
GET /api/payouts/preferences
Authorization: Bearer <token>
```

#### Update Payout Preferences
```http
PUT /api/payouts/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "minimumThreshold": 50.00,
  "currency": "USD"
}
```

### Admin APIs

#### Get All Payouts (Admin)
```http
GET /api/admin/payouts?status=failed&pageSize=50
Authorization: Bearer <admin-token>
```

#### Payout Actions (Admin)
```http
POST /api/admin/payouts
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "action": "retry",
  "payoutId": "payout_123",
  "reason": "Manual admin retry"
}
```

**Available Actions**:
- `retry`: Schedule payout for retry
- `cancel`: Cancel pending/processing payout
- `force_complete`: Mark as completed (use with caution)
- `reprocess`: Reprocess through Stripe
- `add_note`: Add admin note

#### Error Logs (Admin)
```http
GET /api/admin/payouts/errors?severity=high&timeRange=24h
Authorization: Bearer <admin-token>
```

### Webhook Endpoints

#### Stripe Payout Webhooks
```http
POST /api/webhooks/stripe-payouts
Stripe-Signature: <signature>
Content-Type: application/json
```

**Handled Events**:
- `transfer.created`
- `transfer.paid`
- `transfer.failed`
- `account.updated`
- `payout.created`
- `payout.paid`
- `payout.failed`

## Configuration

### Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_WEBHOOK_SECRET_PAYOUTS=whsec_...

# Application Configuration
NEXT_PUBLIC_APP_URL=https://www.getwewrite.app
NODE_ENV=production

# Firebase Configuration
FIREBASE_PROJECT_ID=wewrite-prod
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Optional: External Monitoring
SENTRY_DSN=...
DATADOG_API_KEY=...
```

### Payout Thresholds

```typescript
// Centralized in app/utils/feeCalculations.ts
export const WEWRITE_FEE_STRUCTURE = {
  minimumPayoutThreshold: 25.00, // $25 USD minimum
  platformFeePercentage: 0.0,    // 0% platform fee
  stripeConnectFeePercentage: 0.0025 // 0.25% Stripe fee
};
```

### Supported Countries & Currencies

```typescript
const SUPPORTED_COUNTRIES = {
  'US': { currency: 'usd', processingTime: '1-3 business days' },
  'GB': { currency: 'gbp', processingTime: '1-3 business days' },
  'CA': { currency: 'cad', processingTime: '3-7 business days' },
  'AU': { currency: 'aud', processingTime: '3-7 business days' },
  'DE': { currency: 'eur', processingTime: '3-7 business days' },
  // ... additional EU countries
};
```

## Monitoring & Logging

### Health Checks

The system provides comprehensive health monitoring:

```http
GET /api/admin/payouts/monitoring
```

**Health Indicators**:
- **Healthy**: All systems operational
- **Warning**: Minor issues detected
- **Critical**: Major issues requiring attention

### Error Logging

All errors are logged with structured data:

```typescript
{
  id: "error_123",
  correlationId: "uuid-v4",
  category: "stripe_api",
  severity: "high",
  message: "Transfer failed",
  context: {
    payoutId: "payout_456",
    amount: 125.50,
    operation: "createTransfer"
  },
  timestamp: "2024-01-15T10:30:00Z"
}
```

### Metrics & Alerts

Key metrics monitored:
- **Success Rate**: Target >99%
- **Processing Time**: Target <24 hours
- **Error Rate**: Target <1%
- **Stuck Payouts**: Alert if >24 hours in processing

## Error Handling

### Error Categories & Responses

1. **Stripe API Errors**
   - Automatic retry for transient errors
   - User notification for permanent failures
   - Admin alert for critical issues

2. **Database Errors**
   - Automatic retry with exponential backoff
   - Fallback to read replicas if available
   - Data consistency checks

3. **Network Errors**
   - Automatic retry with circuit breaker
   - Timeout handling
   - Graceful degradation

### Retry Logic

```typescript
const retryConfig = {
  maxRetries: 3,
  baseDelay: 5 * 60 * 1000, // 5 minutes
  maxDelay: 24 * 60 * 60 * 1000, // 24 hours
  backoffMultiplier: 2
};
```

**Retry Schedule**:
- Attempt 1: Immediate
- Attempt 2: 5 minutes
- Attempt 3: 10 minutes
- Attempt 4: 20 minutes
- Final failure: Manual intervention required

## Security

### Authentication & Authorization

- **User Authentication**: Firebase Auth with JWT tokens
- **Admin Access**: Role-based access control
- **API Security**: Rate limiting and request validation

### Data Protection

- **Encryption**: All sensitive data encrypted at rest and in transit
- **PCI Compliance**: Stripe handles all payment card data
- **Audit Trails**: Complete transaction history maintained

### Webhook Security

- **Signature Verification**: All webhooks verified using Stripe signatures
- **Idempotency**: Duplicate event protection using event IDs
- **Rate Limiting**: Webhook endpoints protected against abuse

## Deployment

### Production Deployment Checklist

- [ ] Environment variables configured
- [ ] Stripe webhooks configured
- [ ] Database collections created
- [ ] Monitoring alerts set up
- [ ] Error logging configured
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Security audit completed

### Scaling Considerations

- **Database**: Firestore auto-scales with usage
- **API**: Vercel serverless functions scale automatically
- **Webhooks**: Consider webhook queuing for high volume
- **Monitoring**: External monitoring service recommended

## Testing Infrastructure

WeWrite provides comprehensive testing tools for validating payout functionality:

### Testing Guides
- **[Payout Testing Infrastructure](./PAYOUT_TESTING_INFRASTRUCTURE.md)**: Complete overview of testing components and capabilities
- **[Admin Payout Testing Guide](./ADMIN_PAYOUT_TESTING_GUIDE.md)**: Step-by-step instructions for using admin testing tools

### Quick Testing Access
- **Admin Dashboard**: `/admin/dashboard` → Testing Tools section
- **PayoutFlowValidator**: Primary interface for fee calculation and flow testing
- **Connected Account Setup**: `/settings/earnings?tab=payouts`

### Key Testing Features
- Real-time fee calculation validation
- Platform fee transparency verification (7% WeWrite fee)
- Connected account setup flow testing
- Stripe test mode integration
- Mathematical accuracy validation
- Error scenario testing

## Troubleshooting

### Common Issues

#### Stuck Payouts
**Symptoms**: Payouts remain in "processing" status >24 hours
**Diagnosis**: Check Stripe dashboard for transfer status
**Resolution**: Use admin tools to retry or force complete

#### High Error Rates
**Symptoms**: Increased error notifications
**Diagnosis**: Check error logs by category
**Resolution**: Address root cause (API limits, config issues, etc.)

#### Webhook Failures
**Symptoms**: Status updates not reflecting in UI
**Diagnosis**: Check webhook delivery in Stripe dashboard
**Resolution**: Verify webhook endpoints and signatures

### Debug Tools

#### Error Log Search
```http
GET /api/admin/payouts/errors?search=stripe&severity=high
```

#### Payout Status History
```http
GET /api/admin/payouts?payoutId=payout_123
```

#### System Health Check
```http
GET /api/admin/payouts/monitoring
```

### Support Contacts

- **Technical Issues**: engineering@wewrite.com
- **Financial Issues**: finance@wewrite.com
- **Emergency**: Use admin intervention tools

## Quick Start Guide

### 1. Development Setup

```bash
# Clone repository
git clone https://github.com/WeWriteApp/WeWrite.git
cd WeWrite

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

### 2. Stripe Configuration

1. **Create Stripe Account**: Sign up at https://stripe.com
2. **Enable Connect**: Enable Stripe Connect in your dashboard
3. **Get API Keys**: Copy test and live API keys
4. **Configure Webhooks**: Use the webhook setup script

```bash
# Set up webhooks automatically
node scripts/setup-payout-webhooks.js
```

### 3. Firebase Setup

1. **Create Project**: Create Firebase project at https://console.firebase.google.com
2. **Enable Firestore**: Enable Firestore database
3. **Set up Collections**: Collections are created automatically
4. **Configure Auth**: Set up Firebase Authentication

### 4. Testing

```bash
# Run all tests
npm test

# Test specific components
node scripts/test-webhook-processing.js
node scripts/test-notification-system.js
node scripts/test-error-logging.js
node scripts/validate-webhooks.js
```

### 5. Production Deployment

1. **Environment Setup**: Configure production environment variables
2. **Webhook Configuration**: Set up production webhooks
3. **Monitoring**: Configure external monitoring services
4. **Go Live**: Deploy to production

---

*Last Updated: January 15, 2024*
*Version: 1.0.0*
