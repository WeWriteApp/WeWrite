# WeWrite Environment Architecture

This document provides a comprehensive overview of WeWrite's environment configuration, data separation strategy, and deployment architecture.

## 🏗️ Environment Overview

WeWrite uses a **four-environment architecture** with strict data separation to ensure safe development and testing:

| Environment | Data Source | Stripe Keys | Collections | Purpose |
|-------------|-------------|-------------|-------------|---------|
| **Local Development** | Dev Data | Test Keys | `dev_*` | Local development and testing |
| **Vercel Dev** | Dev Data | Test Keys | `dev_*` | Development branch testing |
| **Vercel Preview** | **Production Data** | Live Keys | No prefix | Pre-production testing with real data |
| **Vercel Production** | Production Data | Live Keys | No prefix | Live production environment |

## 🎯 Key Design Principles

### 1. **Data Isolation**
- **Development environments** use `dev_` prefixed collections
- **Production environments** use unprefixed collections
- **Preview environments** use production data for realistic testing

### 2. **Environment Detection**
The system automatically detects environments using:
- `VERCEL_ENV` (set by Vercel: `production`, `preview`, or undefined)
- `NODE_ENV` (standard Node.js environment variable)

Vercel automatically handles environment switching - no manual configuration needed!

### 3. **Safe Defaults**
- Unknown environments default to development mode (isolated data)
- Better to isolate than contaminate production data

## 🔧 Environment Configuration

### Local Development
```bash
# Environment Detection
NODE_ENV=development
# VERCEL_ENV is undefined (not on Vercel)

# Result: Uses dev_ prefixed collections
# Example: subscriptions -> dev_subscriptions
```

### Vercel Development
```bash
# Environment Detection  
NODE_ENV=development
SUBSCRIPTION_ENV=development
VERCEL_ENV=development  # Custom for dual deployment

# Result: Uses dev_ prefixed collections
# Example: subscriptions -> dev_subscriptions
```

### Vercel Preview
```bash
# Environment Detection
NODE_ENV=production
SUBSCRIPTION_ENV=production
VERCEL_ENV=preview

# Result: Uses production collections (no prefix)
# Example: subscriptions -> subscriptions
```

### Vercel Production
```bash
# Environment Detection
NODE_ENV=production
SUBSCRIPTION_ENV=production
VERCEL_ENV=production

# Result: Uses production collections (no prefix)
# Example: subscriptions -> subscriptions
```

## 📊 Collection Mapping

### Development Collections (dev_ prefix)
```
users -> dev_users
subscriptions -> dev_subscriptions
tokenBalances -> dev_tokenBalances
tokenAllocations -> dev_tokenAllocations
writerTokenBalances -> dev_writerTokenBalances
writerTokenEarnings -> dev_writerTokenEarnings
tokenPayouts -> dev_tokenPayouts
payouts -> dev_payouts
payout_requests -> dev_payoutRequests
transactions -> dev_transactions
paymentRecovery -> dev_paymentRecovery
```

### Production Collections (no prefix)
```
users -> users
subscriptions -> subscriptions
tokenBalances -> tokenBalances
tokenAllocations -> tokenAllocations
writerTokenBalances -> writerTokenBalances
writerTokenEarnings -> writerTokenEarnings
tokenPayouts -> tokenPayouts
payouts -> payouts
payoutRequests -> payoutRequests
transactions -> transactions
paymentRecovery -> paymentRecovery
```

## 🚀 Deployment Architecture

### Single Repository, Multiple Deployments

The system supports **dual deployments** from the `dev` branch:

1. **Development Deployment**
   - URL: `dev-wewrite.vercel.app`
   - Uses development data (`dev_` collections)
   - Uses Stripe test keys
   - Safe for feature testing

2. **Preview Deployment**
   - URL: `preview-wewrite.vercel.app`
   - Uses production data (no prefix)
   - Uses Stripe live keys
   - Tests with real user data

### Branch Strategy
- `main` → Production deployment
- `dev` → Dual deployment (dev + preview)
- Feature branches → Preview deployments only

## 🔐 Security & Data Safety

### Development Safety
- Development environments are completely isolated
- No risk of affecting production data
- Test Stripe keys prevent real charges

### Preview Safety
- Uses production data for realistic testing
- Live Stripe keys for real payment testing
- Careful access control required

### Production Safety
- Only production branch deploys to production
- Environment validation prevents accidents
- Automatic rollback capabilities

## 🧪 Testing Strategy

### Environment Validation
Run the test suite to verify environment configuration:

```bash
cd app
npx tsx scripts/test-environment-config.ts
```

### Manual Verification
Check environment detection via API:

```bash
# Development
curl https://dev-wewrite.vercel.app/api/debug/environment

# Preview  
curl https://preview-wewrite.vercel.app/api/debug/environment

# Production
curl https://wewrite.app/api/debug/environment
```

## 📋 Environment Variables

### Required for All Environments
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_BUCKET=
NEXT_PUBLIC_FIREBASE_DB_URL=
NEXT_PUBLIC_FIREBASE_DOMAIN=
NEXT_PUBLIC_FIREBASE_MSNGR_ID=
NEXT_PUBLIC_FIREBASE_PID=

# Google Cloud
GOOGLE_CLOUD_KEY_JSON=
LOGGING_CLOUD_KEY_JSON=
PROJECT_ID=

# Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

### Environment-Specific Variables

#### Development Environments
```bash
NODE_ENV=development
SUBSCRIPTION_ENV=development
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Production/Preview Environments
```bash
NODE_ENV=production
SUBSCRIPTION_ENV=production
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
NEXT_PUBLIC_APP_URL=https://wewrite.app
```

## 🔄 Deployment Process

### Automatic Deployments
1. **Push to `main`** → Production deployment
2. **Push to `dev`** → Dual deployment (dev + preview)
3. **Pull request** → Preview deployment

### Manual Deployments
Use Vercel CLI or dashboard for manual deployments and environment variable management.

## 🚨 Troubleshooting

### Common Issues

#### Wrong Environment Detected
- Check `VERCEL_ENV` and `NODE_ENV` values
- Verify environment variables are set correctly
- Use debug endpoint to check detection

#### Data in Wrong Collections
- Verify environment prefix is correct
- Check subscription environment override
- Run environment test suite

#### Stripe Key Mismatches
- Ensure test keys for development
- Ensure live keys for production/preview
- Check webhook endpoint configurations

### Debug Tools
- `/api/debug/environment` - Environment detection info
- Test scripts in `app/scripts/`
- Vercel deployment logs
- Firebase console for collection verification

## 📚 Related Documentation
- [Dual Deployment Setup](../scripts/setup-dual-deployment.md)
- [Subscription System](./SUBSCRIPTION_SYSTEM.md)
- [Environment Separation Summary](./Environment%20Separation%20Summary.md)
