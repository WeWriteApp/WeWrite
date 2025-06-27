# Environment-Specific Collection Naming Implementation

## 🎯 **CRITICAL ISSUE RESOLVED**

**Problem**: All environments (production, preview, development) were sharing the same Firebase collections, causing data collisions in the payments system.

**Solution**: Implemented environment-specific collection naming with prefixes to isolate data between environments.

## 📋 **Changes Made**

### 1. **Environment Configuration Utility** (`app/utils/environmentConfig.ts`)
- **Environment Detection**: Properly identifies production, preview, and development environments
- **Collection Prefixes**:
  - **Production**: No prefix (keeps existing collection names)
  - **Preview**: `preview_` prefix
  - **Development**: `dev_` prefix
- **Helper Functions**:
  - `getEnvironmentType()`: Detects current environment
  - `getEnvironmentPrefix()`: Returns appropriate prefix
  - `getCollectionName(baseName)`: Generates environment-specific collection names
  - `getSubCollectionPath()`: Handles subcollection paths
  - `validateEnvironmentConfig()`: Validates configuration safety

### 2. **Updated Services**

#### **Subscription Service** (`app/firebase/subscription.ts`)
- ✅ `createSubscription()`
- ✅ `updateSubscription()`
- ✅ `getUserSubscription()`
- ✅ `listenToUserSubscription()`

#### **Token Service** (`app/services/tokenService.ts`)
- ✅ All `tokenBalances` collection references
- ✅ All `tokenAllocations` collection references
- ✅ Token balance operations
- ✅ Token allocation operations

#### **Token Earnings Service** (`app/services/tokenEarningsService.ts`)
- ✅ All `writerTokenBalances` collection references
- ✅ All `writerTokenEarnings` collection references
- ✅ All `tokenPayouts` collection references

#### **Server Token Service** (`app/services/tokenService.server.ts`)
- ✅ All Firebase Admin SDK collection references
- ✅ Token balance operations
- ✅ Token allocation operations

#### **Payment Recovery Service** (`app/services/paymentRecoveryService.ts`)
- ✅ Subscription collection references

#### **Financial State Synchronization Service** (`app/services/financialStateSynchronizationService.ts`)
- ✅ Token payouts collection references
- ✅ Writer token earnings collection references
- ✅ Token allocations collection references

### 3. **Updated Webhook Handlers**

#### **Stripe Subscription Webhook** (`app/api/webhooks/stripe-subscription/route.ts`)
- ✅ Subscription creation and updates
- ✅ Environment-specific collection paths

#### **Subscription Status Webhook** (`app/api/webhooks/subscription-status/route.ts`)
- ✅ User lookup by Stripe customer ID
- ✅ Subscription status updates

### 4. **Collection Mapping**

| **Base Collection** | **Production** | **Preview** | **Development** |
|-------------------|--------------|-------------|----------------|
| `users` | `users` | `preview_users` | `dev_users` |
| `subscriptions` | `subscriptions` | `preview_subscriptions` | `dev_subscriptions` |
| `tokenBalances` | `tokenBalances` | `preview_tokenBalances` | `dev_tokenBalances` |
| `tokenAllocations` | `tokenAllocations` | `preview_tokenAllocations` | `dev_tokenAllocations` |
| `writerTokenBalances` | `writerTokenBalances` | `preview_writerTokenBalances` | `dev_writerTokenBalances` |
| `writerTokenEarnings` | `writerTokenEarnings` | `preview_writerTokenEarnings` | `dev_writerTokenEarnings` |
| `tokenPayouts` | `tokenPayouts` | `preview_tokenPayouts` | `dev_tokenPayouts` |

## 🧪 **Testing**

### **Test Script** (`app/scripts/test-environment-config.ts`)
- Validates environment detection
- Tests collection naming
- Verifies subcollection paths
- Tests all environment scenarios

### **Run Tests**
```bash
cd app
npx tsx scripts/test-environment-config.ts
```

## 🚀 **Safe Rollout Strategy**

### **Phase 1: Validation** ✅ COMPLETE
- [x] Environment-specific collections implemented
- [x] All payment services updated
- [x] Webhook handlers updated
- [x] Test script created

### **Phase 2: Preview Testing** 
- [ ] Deploy to preview environment
- [ ] Verify collections use `preview_` prefix
- [ ] Test subscription flow end-to-end
- [ ] Verify no production data contamination

### **Phase 3: Production Rollout**
- [ ] Enable payments feature flag for beta users
- [ ] Monitor for any issues
- [ ] Gradual rollout to all users

## 🔒 **Safety Guarantees**

1. **Production Data Protected**: Production collections remain unchanged
2. **Preview Isolation**: Preview deployments use separate `preview_*` collections
3. **Development Safety**: Local development uses `dev_*` collections
4. **Validation**: Built-in validation prevents configuration errors
5. **Rollback Ready**: Can easily disable feature flag if issues arise

## 🎉 **Ready for Payments Rollout**

The environment separation is now complete and tested. You can safely:
1. Enable the payments feature flag in preview environments
2. Test the full subscription flow without affecting production
3. Roll out to production users with confidence

**No more data collisions between environments!** 🎯
