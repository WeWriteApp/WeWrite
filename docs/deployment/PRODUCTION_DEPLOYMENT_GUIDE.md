# WeWrite Payout System - Production Deployment Guide

## Overview

This guide covers the complete process of deploying the WeWrite Payout System to production, including Stripe configuration, environment setup, and go-live procedures.

## Prerequisites

- [ ] Stripe business account created and verified
- [ ] Firebase production project set up
- [ ] Vercel account for deployment (or alternative hosting)
- [ ] Domain configured (www.getwewrite.app)
- [ ] SSL certificate configured

## Phase 1: Stripe Production Setup

### 1.1 Stripe Account Verification

1. **Complete Business Verification**
   - Submit business documents to Stripe
   - Verify business bank account
   - Complete identity verification
   - Wait for approval (1-7 business days)

2. **Enable Live Payments**
   - Go to Stripe Dashboard → Settings → Account
   - Complete "Activate your account" checklist
   - Verify all required information is submitted

### 1.2 Stripe Connect Configuration

1. **Enable Stripe Connect**
   ```bash
   # Run the automated setup script
   node scripts/setup-production-stripe.js
   ```

2. **Configure Connect Application**
   - **Application Name**: WeWrite
   - **Description**: Content creator payout platform
   - **Website**: https://www.getwewrite.app
   - **Support Email**: support@wewrite.com
   - **Redirect URI**: https://www.getwewrite.app/api/stripe/connect/callback
   - **Webhook URL**: https://www.getwewrite.app/api/webhooks/stripe-payouts

3. **Account Requirements**
   - Enable Individual and Company accounts
   - Required capabilities: `transfers`, `card_payments`
   - Supported countries: US, CA, GB, AU, EU

### 1.3 Webhook Configuration

1. **Create Production Webhook**
   - URL: `https://www.getwewrite.app/api/webhooks/stripe-payouts`
   - Events to listen for:
     - `transfer.created`
     - `transfer.paid`
     - `transfer.failed`
     - `transfer.reversed`
     - `account.updated`
     - `payout.created`
     - `payout.paid`
     - `payout.failed`

2. **Configure Webhook Security**
   - Copy webhook signing secret
   - Add to environment variables
   - Test webhook delivery

## Phase 2: Environment Configuration

### 2.1 Production Environment Variables

```bash
# Stripe Configuration (LIVE KEYS)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_WEBHOOK_SECRET_PAYOUTS=whsec_...

# Application Configuration
NEXT_PUBLIC_APP_URL=https://www.getwewrite.app
NODE_ENV=production

# Firebase Configuration
FIREBASE_PROJECT_ID=wewrite-prod
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@wewrite-prod.iam.gserviceaccount.com

# Security
NEXTAUTH_SECRET=your-production-secret
NEXTAUTH_URL=https://www.getwewrite.app

# Optional: Monitoring
SENTRY_DSN=https://...@sentry.io/...
DATADOG_API_KEY=...
```

### 2.2 Firebase Production Setup

1. **Create Production Project**
   - Create new Firebase project: `wewrite-prod`
   - Enable Firestore database
   - Configure security rules
   - Set up service account

2. **Database Collections**
   Collections are created automatically with `PROD_` prefix:
   - `PROD_payouts`
   - `PROD_payoutRecipients`
   - `PROD_payoutErrorLogs`
   - `PROD_notifications`
   - `PROD_userNotifications`

3. **Security Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Payout collections - admin only
       match /PROD_payouts/{document} {
         allow read, write: if request.auth != null && 
           request.auth.token.admin == true;
       }
       
       // User notifications - user can read own
       match /PROD_userNotifications/{document} {
         allow read: if request.auth != null && 
           request.auth.uid == resource.data.userId;
         allow write: if request.auth != null && 
           request.auth.token.admin == true;
       }
     }
   }
   ```

## Phase 3: Deployment

### 3.1 Vercel Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Production**
   ```bash
   # Deploy to production
   vercel --prod
   
   # Configure environment variables in Vercel dashboard
   # or use Vercel CLI
   vercel env add STRIPE_SECRET_KEY production
   vercel env add STRIPE_PUBLISHABLE_KEY production
   # ... add all environment variables
   ```

3. **Configure Custom Domain**
   - Add domain in Vercel dashboard
   - Configure DNS records
   - Verify SSL certificate

### 3.2 Alternative Deployment (AWS/GCP)

If not using Vercel, ensure your hosting platform supports:
- Node.js 18+
- Environment variables
- HTTPS/SSL
- Webhook endpoints
- Serverless functions or containers

## Phase 4: Testing & Validation

### 4.1 Pre-Launch Testing

1. **Test Stripe Connect Onboarding**
   ```bash
   # Test Express account creation
   curl -X POST https://www.getwewrite.app/api/stripe/connect/create \
     -H "Authorization: Bearer TEST_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"type":"express","country":"US"}'
   ```

2. **Test Webhook Processing**
   ```bash
   # Use Stripe CLI to test webhooks
   stripe listen --forward-to https://www.getwewrite.app/api/webhooks/stripe-payouts
   stripe trigger transfer.created
   ```

3. **Test Payout Flow**
   ```bash
   # Test payout request
   curl -X POST https://www.getwewrite.app/api/payouts/earnings \
     -H "Authorization: Bearer REAL_USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"amount": 25.00}'
   ```

### 4.2 Load Testing

1. **Test Concurrent Payouts**
   ```bash
   # Run load test script
   node scripts/load-test-payouts.js --concurrent=10 --duration=60
   ```

2. **Monitor Performance**
   - API response times < 2 seconds
   - Webhook processing < 5 seconds
   - Database queries optimized
   - Memory usage within limits

## Phase 5: Monitoring & Alerting

### 5.1 Health Monitoring

1. **Set Up Health Checks**
   ```bash
   # Monitor key endpoints
   curl https://www.getwewrite.app/api/webhooks/stripe-payouts
   curl https://www.getwewrite.app/api/admin/payouts/monitoring
   ```

2. **Configure Alerts**
   - High error rates (>1%)
   - Stuck payouts (>24 hours)
   - Webhook delivery failures
   - API response time degradation

### 5.2 External Monitoring

1. **Sentry for Error Tracking**
   ```javascript
   // Already integrated in error logger
   SENTRY_DSN=https://...@sentry.io/...
   ```

2. **Uptime Monitoring**
   - Use services like Pingdom, UptimeRobot
   - Monitor critical endpoints
   - Set up SMS/email alerts

## Phase 6: Go-Live Checklist

### 6.1 Pre-Launch Verification

- [ ] Stripe account fully verified and activated
- [ ] Connect application approved
- [ ] Production webhooks configured and tested
- [ ] Environment variables set correctly
- [ ] Database collections created with proper permissions
- [ ] SSL certificate valid and configured
- [ ] Domain pointing to production deployment
- [ ] Monitoring and alerting configured
- [ ] Error logging working correctly
- [ ] Rate limiting tested and configured
- [ ] Admin tools accessible and functional
- [ ] Documentation updated
- [ ] Team trained on admin procedures

### 6.2 Launch Day Procedures

1. **Final Testing**
   ```bash
   # Run comprehensive test suite
   npm test
   node scripts/test-webhook-processing.js
   node scripts/test-payout-user-flows.js
   node scripts/test-rate-limiting.js
   ```

2. **Enable Production Mode**
   - Switch from test to live Stripe keys
   - Update environment variables
   - Deploy final configuration

3. **Monitor Launch**
   - Watch error logs closely
   - Monitor webhook delivery
   - Check payout processing
   - Verify user notifications

### 6.3 Post-Launch Monitoring

1. **First 24 Hours**
   - Monitor all metrics closely
   - Check for any error spikes
   - Verify webhook processing
   - Test admin intervention tools

2. **First Week**
   - Review payout success rates
   - Check user feedback
   - Monitor performance metrics
   - Validate error handling

## Phase 7: Maintenance & Support

### 7.1 Regular Maintenance

1. **Weekly Tasks**
   - Review error logs
   - Check stuck payouts
   - Monitor success rates
   - Update documentation

2. **Monthly Tasks**
   - Review Stripe fees and limits
   - Update rate limiting if needed
   - Check for Stripe API updates
   - Review security settings

### 7.2 Incident Response

1. **Critical Issues**
   - Payout system down
   - High error rates
   - Webhook failures
   - Security incidents

2. **Response Procedures**
   - Use admin intervention tools
   - Check external service status
   - Review recent deployments
   - Communicate with users

## Support Contacts

- **Technical Issues**: engineering@wewrite.com
- **Financial Issues**: finance@wewrite.com
- **Stripe Support**: https://support.stripe.com
- **Emergency Escalation**: Use admin tools for immediate intervention

## Security Considerations

### Production Security Checklist

- [ ] API keys stored securely (not in code)
- [ ] Webhook signature verification enabled
- [ ] HTTPS enforced for all endpoints
- [ ] Rate limiting configured and tested
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive data
- [ ] Audit logging enabled and monitored
- [ ] Access controls for admin functions
- [ ] Regular security monitoring
- [ ] Incident response plan documented

### Compliance Notes

- PCI compliance handled by Stripe
- User data encrypted in transit and at rest
- Audit logs maintained for financial transactions
- Privacy policy updated for payout features
- Terms of service include payout terms

---

**This deployment guide ensures a smooth transition to production with proper monitoring, security, and support procedures in place.**

*Last Updated: January 15, 2024*
*Version: 1.0.0*
