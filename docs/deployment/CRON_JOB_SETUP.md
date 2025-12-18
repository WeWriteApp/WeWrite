# WeWrite Cron Job Setup Guide

## Overview

WeWrite requires scheduled tasks to process monthly earnings and automated payouts. This guide covers setting up cron jobs for production deployment.

## Required Cron Jobs

### 1. Monthly Earnings Processing
**Endpoint**: `POST /api/usd/process-writer-earnings`
**Schedule**: 1st of every month at 8:00 AM UTC
**Purpose**: Process monthly writer earnings from allocations

### 2. Automated Payouts
**Endpoint**: `POST /api/cron/automated-payouts`
**Schedule**: 1st of every month at 9:00 AM UTC
**Purpose**: Process pending earnings and create automated payouts

### 3. Weekly Digest Email
**Endpoint**: `POST /api/cron/weekly-digest`
**Schedule**: Every Monday at 10:00 AM UTC
**Purpose**: Send weekly digest emails to users

### 4. Username Reminder
**Endpoint**: `POST /api/cron/username-reminder`
**Schedule**: Daily at 2:00 PM UTC
**Purpose**: Remind new users to set a username

### 5. Payout Setup Reminder
**Endpoint**: `POST /api/cron/payout-setup-reminder`
**Schedule**: Daily at 3:00 PM UTC
**Purpose**: Remind creators with earnings to set up payouts

### 6. Email Verification Reminder
**Endpoint**: `POST /api/cron/email-verification-reminder`
**Schedule**: Daily at 4:00 PM UTC
**Purpose**: Remind users to verify their email addresses

### 7. Reactivation Emails
**Endpoint**: `POST /api/cron/reactivation`
**Schedule**: Every Monday at 4:00 PM UTC
**Purpose**: Send reactivation emails to dormant users

## Environment Variables

Add these to your production environment:

```bash
# Cron job authentication
CRON_API_KEY=your-secure-random-key-here

# Stripe configuration (already set)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database configuration (already set)
FIREBASE_PROJECT_ID=your-project-id
```

## Vercel Cron Setup

If deploying on Vercel, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/usd/process-writer-earnings",
      "schedule": "0 8 1 * *"
    },
    {
      "path": "/api/cron/automated-payouts",
      "schedule": "0 9 1 * *"
    },
    {
      "path": "/api/cron/weekly-digest",
      "schedule": "0 10 * * 1"
    },
    {
      "path": "/api/cron/username-reminder",
      "schedule": "0 14 * * *"
    },
    {
      "path": "/api/cron/payout-setup-reminder",
      "schedule": "0 15 * * *"
    },
    {
      "path": "/api/cron/email-verification-reminder",
      "schedule": "0 16 * * *"
    },
    {
      "path": "/api/cron/reactivation",
      "schedule": "0 16 * * 1"
    }
  ]
}
```

## Manual Cron Setup (Linux/Unix)

Add to your server's crontab:

```bash
# Edit crontab
crontab -e

# Add these lines:
# Monthly earnings processing (1st of month at 9 AM UTC)
0 9 1 * * curl -X POST https://your-domain.com/api/cron/automated-payouts \
  -H "Authorization: Bearer $CRON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"forceRun": false, "dryRun": false}'

# Payout status sync (every 30 minutes)
*/30 * * * * curl -X POST https://your-domain.com/api/cron/payout-status-sync \
  -H "Authorization: Bearer $CRON_API_KEY" \
  -H "Content-Type: application/json"
```

## GitHub Actions Setup

Create `.github/workflows/cron-jobs.yml`:

```yaml
name: WeWrite Cron Jobs

on:
  schedule:
    # Monthly earnings processing (1st of month at 9 AM UTC)
    - cron: '0 9 1 * *'
    # Payout status sync (every 30 minutes)
    - cron: '*/30 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  monthly-earnings:
    if: github.event.schedule == '0 9 1 * *'
    runs-on: ubuntu-latest
    steps:
      - name: Process Monthly Earnings
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/cron/automated-payouts \
            -H "Authorization: Bearer ${{ secrets.CRON_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"forceRun": false, "dryRun": false}'

  payout-status-sync:
    if: github.event.schedule == '*/30 * * * *'
    runs-on: ubuntu-latest
    steps:
      - name: Sync Payout Status
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/cron/payout-status-sync \
            -H "Authorization: Bearer ${{ secrets.CRON_API_KEY }}" \
            -H "Content-Type: application/json"
```

## Testing Cron Jobs

### Manual Testing

```bash
# Test monthly earnings processing (dry run)
curl -X POST https://your-domain.com/api/cron/automated-payouts \
  -H "Authorization: Bearer your-cron-key" \
  -H "Content-Type: application/json" \
  -d '{"forceRun": true, "dryRun": true}'

# Test payout status sync
curl -X POST https://your-domain.com/api/cron/payout-status-sync \
  -H "Authorization: Bearer your-cron-key" \
  -H "Content-Type: application/json"
```

### Admin Dashboard Testing

Use the admin dashboard at `/admin/dashboard` to:
1. View cron job status
2. Manually trigger processing
3. Monitor payout queue
4. Check error logs

## Monitoring & Alerts

### Log Monitoring
- Check application logs for cron job execution
- Monitor for correlation IDs in error tracking
- Set up alerts for failed cron jobs

### Key Metrics to Monitor
- Monthly earnings processed count
- Payout success/failure rates
- Processing time duration
- Queue backlog size

### Error Handling
- Failed cron jobs will retry automatically
- Check `/api/admin/payout-monitoring` for detailed status
- Use correlation IDs to trace issues

## Security Considerations

1. **API Key Security**: Keep `CRON_API_KEY` secure and rotate regularly
2. **Rate Limiting**: Cron endpoints have built-in rate limiting
3. **Authentication**: All cron endpoints require Bearer token authentication
4. **Logging**: All cron activities are logged with correlation IDs

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check `CRON_API_KEY` environment variable
2. **500 Server Error**: Check application logs for detailed error messages
3. **Timeout**: Increase timeout limits for large batch processing
4. **Database Locks**: Ensure proper transaction handling in concurrent operations

### Debug Commands

```bash
# Check cron job status
curl -X GET https://your-domain.com/api/admin/payout-monitoring \
  -H "Authorization: Bearer admin-key"

# Force run with detailed logging
curl -X POST https://your-domain.com/api/cron/automated-payouts \
  -H "Authorization: Bearer cron-key" \
  -d '{"forceRun": true, "dryRun": true, "verbose": true}'
```

## Production Checklist

- [ ] Set `CRON_API_KEY` environment variable
- [ ] Configure cron schedule (Vercel/GitHub Actions/Manual)
- [ ] Test cron endpoints manually
- [ ] Set up monitoring and alerts
- [ ] Verify Stripe webhook endpoints are active
- [ ] Test end-to-end payout flow
- [ ] Document incident response procedures

## Next Steps

After setting up cron jobs:
1. Monitor first monthly processing run
2. Verify payout status updates work correctly
3. Set up alerting for failed jobs
4. Document any environment-specific configurations
