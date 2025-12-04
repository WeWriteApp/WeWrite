# Branch-Aware Development Guide

## 🎯 Overview

WeWrite implements **branch-aware environment detection** for local development, automatically selecting the appropriate Firebase collections based on your current git branch.

## 🌿 Branch Behavior

### Main Branch (`main`)
```bash
git checkout main
bun dev
# → Uses production collections (users, pages, subscriptions)
# → Connects to real production data
# → Uses live Stripe keys
```

**⚠️ CAUTION**: Working on main branch connects to **real production data**. Use this when:
- Testing against real user data
- Debugging production issues
- Verifying fixes work with actual data
- Final testing before deployment

### Dev Branch (`dev`)
```bash
git checkout dev
bun dev
# → Uses DEV_ prefixed collections (DEV_users, DEV_pages, DEV_subscriptions)
# → Connects to isolated test data
# → Uses test Stripe keys
```

**✅ SAFE**: Working on dev branch uses isolated test data. Use this for:
- Feature development
- Experimental changes
- Testing new functionality
- Day-to-day development work

### Other Branches (Feature branches, etc.)
```bash
git checkout feature/my-new-feature
bun dev
# → Uses DEV_ prefixed collections (safe default)
# → Connects to isolated test data
# → Uses test Stripe keys
```

**✅ SAFE**: All other branches default to dev collections for safety.

## 🔧 Implementation Details

### Environment Detection Logic
The system checks your git branch in this order:

1. **Vercel deployments**: Uses `VERCEL_ENV` (production/preview/development)
2. **Local main branch**: Uses production collections
3. **Local dev branch**: Uses DEV_ collections  
4. **Local other branches**: Uses DEV_ collections (safe default)

### Code Location
The branch detection logic is implemented in:
- `app/utils/environmentDetection.ts` - Core detection logic
- `app/utils/environmentConfig.ts` - Collection prefix configuration

## 🚀 Development Workflow

### Recommended Workflow

1. **Start new features on dev branch**:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/my-feature
   bun dev  # Safe: uses DEV_ collections
   ```

2. **Test with production data when needed**:
   ```bash
   git checkout main
   bun dev  # Caution: uses production collections
   # Test your changes against real data
   ```

3. **Switch back to dev for continued development**:
   ```bash
   git checkout dev
   bun dev  # Safe: back to DEV_ collections
   ```

### Branch Switching
When you switch branches, the environment automatically updates:

```bash
# Currently on dev branch - using DEV_ collections
git checkout main
# Now on main branch - will use production collections on next server restart
bun dev  # Restart to pick up new environment
```

## 🛡️ Safety Features

### Safe Defaults
- Unknown branches default to development mode
- Better to isolate than contaminate production data
- Console logging shows which environment is detected

### Environment Validation
The system validates environment configuration and warns about:
- Missing environment variables
- Inconsistent environment detection
- Potential data contamination risks

## 🔍 Verification

### Check Current Environment
```bash
# Via API endpoint
curl http://localhost:3000/api/debug/environment

# Via test script
cd app && npx tsx scripts/test-environment-config.ts
```

### Console Output
When starting the dev server, you'll see:
```bash
[Environment Detection] Main branch detected → using production collections
# or
[Environment Detection] Dev branch detected → using DEV_ collections
# or  
[Environment Detection] Branch 'feature/xyz' detected → using DEV_ collections (safe default)
```

### Database Verification
Check your Firebase console:
- **Production mode**: See collections like `users`, `pages`, `subscriptions`
- **Development mode**: See collections like `DEV_users`, `DEV_pages`, `DEV_subscriptions`

## ⚠️ Important Warnings

### Production Data Access
When on main branch locally:
- You're working with **real user data**
- Changes affect **actual users**
- Payments use **live Stripe keys**
- Be extra careful with database operations

### Branch Switching
- Restart your dev server after switching branches
- Environment detection happens at server startup
- Client-side code may need refresh to pick up changes

## 🔗 Related Documentation

- [Environment Architecture](./ENVIRONMENT_ARCHITECTURE.md) - Complete environment overview
- [Environment Quick Reference](./ENVIRONMENT_QUICK_REFERENCE.md) - Quick lookup table
- [Development Auth Guide](./DEVELOPMENT_AUTH_GUIDE.md) - Authentication setup

---

**This branch-aware system provides the flexibility to test against production data when needed while keeping development work safely isolated by default.**
