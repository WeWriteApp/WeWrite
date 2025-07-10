# Environment Quick Reference

## 🚀 TL;DR

| Environment | URL | Data | Stripe | Collections |
|-------------|-----|------|--------|-------------|
| **Local** | `localhost:3000` | Dev | Test | `dev_*` |
| **Dev Deploy** | `dev-wewrite.vercel.app` | Dev | Test | `dev_*` |
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
- **Development**: Should see `dev_subscriptions`, `dev_users`, etc.
- **Production/Preview**: Should see `subscriptions`, `users`, etc.

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

### 1. Local Development
- Uses `dev_` collections
- Safe to test payments with test Stripe keys
- No risk to production data

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

- [Full Environment Architecture](./ENVIRONMENT_ARCHITECTURE.md)
- [Dual Deployment Setup](../scripts/setup-dual-deployment.md)
- [Subscription System Docs](./SUBSCRIPTION_SYSTEM.md)
- [Environment Test Suite](../app/scripts/test-environment-config.ts)

## 📞 Need Help?

1. Run the test suite first
2. Check the debug endpoint
3. Review environment variable configuration
4. Consult the full architecture documentation
