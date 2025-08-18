# Environment Quick Reference

## ⚠️ Special Case: Landing Page Production Data

**Important**: The logged-out landing page ALWAYS uses production data regardless of environment. See [LANDING_PAGE_PRODUCTION_DATA.md](./LANDING_PAGE_PRODUCTION_DATA.md) for details.

## 🚀 TL;DR

| Environment | URL | Data | Stripe | Collections |
|-------------|-----|------|--------|-------------|
| **Local (main branch)** | `localhost:3000` | **Prod** | **Live** | No prefix |
| **Local (dev branch)** | `localhost:3000` | Dev | Test | `DEV_*` |
| **Local (other branches)** | `localhost:3000` | Dev | Test | `DEV_*` |
| **Dev Deploy** | `dev-wewrite.vercel.app` | Dev | Test | `DEV_*` |
| **Preview** | `preview-wewrite.vercel.app` | **Prod** | **Live** | No prefix |
| **Production** | `wewrite.app` | Prod | Live | No prefix |

## 🔍 Quick Checks

### Check Current Environment
```bash
# Via API
curl https://your-deployment.vercel.app/api/debug/environment

# Via Test Script
cd app && npx tsx scripts/test-environment-config.ts
```

### Verify Collections
- **Development (dev branch, other branches)**: Should see `DEV_subscriptions`, `DEV_users`, etc.
- **Production (main branch, preview, production)**: Should see `subscriptions`, `users`, etc.

### Verify Stripe Keys
- **Development**: Keys start with `sk_test_` and `pk_test_`
- **Production/Preview**: Keys start with `sk_live_` and `pk_live_`

## ⚡ Common Commands

### Run Environment Tests
```bash
cd app
npx tsx scripts/test-environment-config.ts
```

### Check Environment Variables
```bash
# Local development
echo $NODE_ENV $SUBSCRIPTION_ENV

# In deployment
curl https://your-app.vercel.app/api/debug/environment
```

### Deploy to Specific Environment
```bash
# Deploy dev branch (triggers dual deployment)
git push origin dev

# Deploy to production
git push origin main
```

## 🛠️ Development Workflow

### 1. Local Development (Branch-Aware)
- **Main branch**: Uses production collections - **CAUTION: Real data!**
- **Dev branch**: Uses `DEV_` collections - Safe for testing
- **Other branches**: Uses `DEV_` collections - Safe for testing
- Safe to test payments with appropriate Stripe keys based on branch

### 2. Dev Branch Testing
- Push to `dev` branch
- Check both environments:
  - `dev-wewrite.vercel.app` (dev data)
  - `preview-wewrite.vercel.app` (prod data)

### 3. Production Release
- Merge `dev` → `main`
- Automatic production deployment

## 🚨 Safety Rules

### ✅ Safe Actions
- Test payments in development environments
- Modify dev collections
- Experiment with features locally

### ⚠️ Caution Required
- Testing in preview environment (uses prod data)
- Modifying subscription logic
- Payment webhook changes

### 🚫 Never Do
- Test with live Stripe keys in development
- Modify production collections directly
- Deploy untested code to main branch

## 🔧 Environment Variables Cheat Sheet

### Local Development (.env.local)
```bash
NODE_ENV=development
SUBSCRIPTION_ENV=development
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Vercel Development
```bash
NODE_ENV=development
SUBSCRIPTION_ENV=development
VERCEL_ENV=development
```

### Vercel Preview
```bash
NODE_ENV=production
SUBSCRIPTION_ENV=production
VERCEL_ENV=preview
```

### Vercel Production
```bash
NODE_ENV=production
SUBSCRIPTION_ENV=production
VERCEL_ENV=production
```

## 🐛 Troubleshooting

### Wrong Collections Being Used
1. Check environment detection: `/api/debug/environment`
2. Verify `SUBSCRIPTION_ENV` variable
3. Run test suite to validate configuration

### Stripe Key Issues
1. Verify key format (`sk_test_` vs `sk_live_`)
2. Check webhook endpoints match environment
3. Confirm publishable key matches secret key

### Data Not Appearing
1. Check if using correct collection prefix
2. Verify Firebase permissions
3. Check environment variable configuration

## 📱 Mobile Testing

### Local Development
- Use `http://localhost:3000` or your local IP
- Test with Stripe test cards
- Safe to test all payment flows

### Preview Testing
- Use `https://preview-wewrite.vercel.app`
- **Caution**: Uses real production data
- Test with small amounts or test accounts

## 🔗 Quick Links

- [Branch-Aware Development Guide](./BRANCH_AWARE_DEVELOPMENT.md) - 🆕 Detailed branch-based workflow
- [Full Environment Architecture](./ENVIRONMENT_ARCHITECTURE.md)
- [Dual Deployment Setup](../scripts/setup-dual-deployment.md)
- [Subscription System Docs](./SUBSCRIPTION_SYSTEM.md)
- [Environment Test Suite](../app/scripts/test-environment-config.ts)

## 📞 Need Help?

1. Run the test suite first
2. Check the debug endpoint
3. Review environment variable configuration
4. Consult the full architecture documentation
