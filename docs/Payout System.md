# WeWrite Comprehensive Payout System

## Overview

The WeWrite payout system enables creators to earn money from their content through user pledges and subscriptions. The system handles revenue distribution, automatic payouts, and international payments through Stripe Connect.

## Architecture

### Core Components

1. **Payout Recipients** - Creator accounts that can receive payments
2. **Revenue Splits** - Configurable percentage distributions for pages/groups
3. **Earnings Tracking** - Monthly calculation and distribution of pledge revenue
4. **Payout Processing** - Automated monthly transfers via Stripe Connect
5. **International Support** - Multi-currency and country support

### Database Schema

```
payoutRecipients/
├── recipient_{userId}
│   ├── stripeConnectedAccountId
│   ├── accountStatus: 'pending' | 'verified' | 'restricted'
│   ├── payoutPreferences
│   ├── totalEarnings
│   ├── availableBalance
│   └── pendingBalance

revenueSplits/
├── {resourceType}_{resourceId}
│   ├── splits[]
│   │   ├── recipientId
│   │   ├── percentage
│   │   └── role: 'owner' | 'contributor' | 'platform_fee'
│   └── totalPercentage: 100

earnings/
├── {pledgeId}_{recipientId}_{period}
│   ├── amount
│   ├── platformFee
│   ├── netAmount
│   ├── period: 'YYYY-MM'
│   └── status: 'pending' | 'available' | 'paid'

payouts/
├── payout_{recipientId}_{period}
│   ├── amount
│   ├── stripeTransferId
│   ├── status: 'pending' | 'processing' | 'completed' | 'failed'
│   └── earningIds[]
```

## Revenue Distribution

### Default Split (New Pages/Groups)
- **Creator**: 93%
- **Platform Fee**: 7%

### Configurable Splits
- **Owner**: Variable (default 93%)
- **Contributors**: 0-50% (deducted from owner)
- **Early Supporters**: Bonus percentage for first 12 months
- **Platform Fee**: Fixed 7%

### Fee Structure
- **Platform Fee**: 7% of gross pledge amount
- **Stripe Processing**: ~2.9% + $0.30 per transaction
- **Creator Net**: ~90% of pledge amount

## Monthly Processing

### Start-of-Month Processing Schedule
- **Processing Date**: 1st of each month at 9 AM UTC
- **Minimum Threshold**: $25 USD
- **Processing Time**: 2-5 business days for bank transfers
- **Cron Job**: `scripts/process-monthly-payouts.cjs`

### Processing Steps (All on 1st of Month)
1. **Finalize Allocations**: Convert pending token allocations to writer earnings
2. **Calculate Earnings**: Process all finalized allocations for previous month
3. **Distribute Revenue**: Apply revenue splits and fee deductions
4. **Create Payouts**: Generate payout records for eligible recipients
5. **Process Transfers**: Execute Stripe Connect transfers from escrow
6. **Bill Subscriptions**: Renew user subscriptions and allocate new tokens
7. **Update Balances**: Adjust recipient and escrow account balances

### Fund Segregation (Stripe Escrow)
- **User Funds**: Held in separate escrow account until payout
- **Platform Revenue**: Fees and unallocated tokens in revenue account
- **Clean Reporting**: Platform income only from legitimate revenue sources

## API Endpoints

### Setup & Management
```
POST /api/payouts/setup
GET  /api/payouts/setup
POST /api/payouts/revenue-splits
GET  /api/payouts/revenue-splits
PUT  /api/payouts/revenue-splits
```

### Earnings & Payouts
```
GET  /api/payouts/earnings
POST /api/payouts/earnings (manual payout request)
POST /api/payouts/process-monthly (cron job)
GET  /api/payouts/process-monthly (status check)
```

### Webhooks
```
POST /api/webhooks/stripe-payouts
```

## International Support

### Supported Countries
- **United States** (USD)
- **Canada** (CAD)
- **United Kingdom** (GBP)
- **Australia** (AUD)
- **Germany** (EUR)
- **France** (EUR)
- **Japan** (JPY)

### Requirements by Country
- **US**: SSN/EIN + Bank Account
- **CA**: SIN/Business Number + Bank Account
- **UK**: National Insurance + Bank Account
- **AU**: ABN/TFN + Bank Account
- **DE**: Tax ID + IBAN
- **FR**: SIRET + IBAN
- **JP**: Personal/Corporate Number + Bank Account

## Setup Instructions

### 1. Environment Variables
```bash
# Required for payouts
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET_PAYOUTS=whsec_...
CRON_API_KEY=your_secure_api_key

# Optional
NEXT_PUBLIC_APP_URL=https://getwewrite.app
```

### 2. Stripe Webhook Configuration
Create webhook endpoint: `https://your-domain.com/api/webhooks/stripe-payouts`

Events to listen for:
- `transfer.created`
- `transfer.paid`
- `transfer.failed`
- `account.updated`

### 3. Cron Job Setup
```bash
# Run monthly on 1st at 9 AM UTC
0 9 1 * * /usr/bin/node /path/to/scripts/process-monthly-payouts.js

# Dry run for testing
0 9 1 * * /usr/bin/node /path/to/scripts/process-monthly-payouts.js --dry-run
```

### 4. Feature Flag
Enable payments feature flag in Firebase:
```json
{
  "payments": {
    "enabled": true,
    "rolloutPercentage": 100
  }
}
```

## Usage Examples

### Creator Setup
1. User creates Stripe Connect account
2. System creates payout recipient
3. Default revenue splits created for existing pages/groups
4. Creator can configure custom splits

### Monthly Processing
```bash
# Process previous month automatically
node scripts/process-monthly-payouts.js

# Process specific month
node scripts/process-monthly-payouts.js --period=2024-01

# Dry run (no actual changes)
node scripts/process-monthly-payouts.js --dry-run
```

### Revenue Split Configuration
```javascript
// Add contributor to page
await fetch('/api/payouts/revenue-splits', {
  method: 'PUT',
  body: JSON.stringify({
    action: 'add_contributor',
    resourceType: 'page',
    resourceId: 'page123',
    contributorId: 'user456',
    percentage: 15
  })
});
```

## Error Handling

### Common Issues
1. **Account Not Verified**: User needs to complete Stripe onboarding
2. **Insufficient Balance**: Below $25 minimum threshold
3. **Failed Transfer**: Bank account issues or restrictions
4. **Invalid Split**: Percentages don't total 100%

### Monitoring
- Check processing status via API
- Monitor Stripe webhook events
- Review failed payouts in dashboard
- Track earnings vs. payouts reconciliation

## Security Considerations

1. **API Authentication**: All endpoints require user authentication
2. **Ownership Verification**: Users can only modify their own resources
3. **Webhook Validation**: Stripe signature verification required
4. **Rate Limiting**: Prevent abuse of payout requests
5. **Audit Trail**: All changes logged with timestamps

## Testing

### Test Mode
- Use Stripe test keys for development
- Test webhook events with Stripe CLI
- Verify calculations with small amounts
- Test international scenarios

### Dry Run Mode
```bash
# Test monthly processing without changes
node scripts/process-monthly-payouts.js --dry-run
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Stripe webhooks set up
- [ ] Cron job scheduled
- [ ] Feature flag enabled
- [ ] Database indexes created
- [ ] Monitoring alerts configured
- [ ] Test transactions verified

## Support

For issues or questions:
1. Check error logs in `/api/errors`
2. Review Stripe dashboard for transfer status
3. Monitor Firebase console for database issues
4. Contact support with transaction IDs for investigation
