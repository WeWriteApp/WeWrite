# Storage Balance Testing Environment Audit

## 🚨 **CRITICAL ISSUE IDENTIFIED**

You're absolutely right to be concerned! The fact that Storage Balance only appears in your real Stripe account and not in sandbox/test accounts indicates a **critical configuration issue** that needs immediate attention.

---

## 🔍 **Root Cause Analysis**

### **The Problem:**
- **Production Stripe Account**: Shows Storage Balance ✅
- **Test/Sandbox Stripe Accounts**: No Storage Balance ❌
- **Risk**: Development environment can't properly test Storage Balance system

### **Possible Causes:**
1. **Global Payouts not enabled** in test Stripe accounts
2. **Wrong Stripe account** being used in development
3. **Environment configuration mismatch**
4. **Stripe sandbox limitations** (though documentation says it should work)

---

## 🎯 **Immediate Action Plan**

### **Step 1: Audit Current Configuration**
Run this API call to check your current environment setup:

```bash
curl -X GET /api/admin/environment-audit
```

This will show:
- Which Stripe keys are being used
- Whether test vs live keys match the environment
- Storage Balance availability in current account
- Firebase collection configuration

### **Step 2: Enable Global Payouts in Test Accounts**

**For each Stripe test account:**

1. **Go to Stripe Dashboard** (test mode)
2. **Navigate to**: More → Global Payouts
3. **Click "Get started"** to enable Global Payouts
4. **Complete setup** - this enables Storage Balance

**Critical**: Storage Balance is part of Global Payouts - if Global Payouts isn't enabled, Storage Balance won't appear.

### **Step 3: Verify Test Account Setup**

```bash
curl -X POST /api/admin/environment-audit \
  -H "Content-Type: application/json" \
  -d '{"action": "test_storage_balance_setup"}'
```

This will:
- Test connection to current Stripe account
- Check if Storage Balance is available
- Provide specific setup recommendations

---

## 🔧 **Environment Configuration Fixes**

### **Current Environment Logic:**
```typescript
// Development = Test Stripe keys
if (isDevelopment) {
  return process.env.STRIPE_TEST_SECRET_KEY;
}

// Production = Live Stripe keys  
return process.env.STRIPE_PROD_SECRET_KEY;
```

### **Required Environment Variables:**
```bash
# Development (.env.local)
STRIPE_TEST_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...

# Production (.env)
STRIPE_PROD_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY=pk_live_...
```

### **Firebase Collections:**
Our collections are environment-aware:
```typescript
// Development uses: users_dev, subscriptions_dev, etc.
// Production uses: users, subscriptions, etc.
```

---

## 🧪 **Testing Storage Balance Setup**

### **Step 1: Enable Global Payouts in Test Mode**

1. **Switch to test mode** in Stripe Dashboard
2. **Go to**: More → Global Payouts → Get started
3. **Follow setup wizard** (uses test data)
4. **Verify Storage Balance appears** in Balance section

### **Step 2: Test Fund Movement**

Once Global Payouts is enabled in test mode:

```bash
# Add test funds to account
curl -X POST /api/admin/test-storage-balance \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_current_balances"
  }'

# Move funds to Storage Balance
curl -X POST /api/admin/test-storage-balance \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test_move_to_storage",
    "amount": 25,
    "confirm": true
  }'
```

### **Step 3: Verify in Dashboard**

After test transfer, your **test** Stripe dashboard should show:
- **Payments Balance**: Reduced amount
- **Storage Balance**: Increased amount ✅

---

## 🎯 **Environment Separation Verification**

### **Development Environment Should Use:**
- ✅ **Stripe Test Keys** (`sk_test_...`, `pk_test_...`)
- ✅ **Test Firebase Collections** (`users_dev`, `subscriptions_dev`)
- ✅ **Test Stripe Account** (with Global Payouts enabled)

### **Production Environment Should Use:**
- ✅ **Stripe Live Keys** (`sk_live_...`, `pk_live_...`)
- ✅ **Production Firebase Collections** (`users`, `subscriptions`)
- ✅ **Live Stripe Account** (with Global Payouts enabled)

---

## 🚨 **Critical Checks**

### **1. Verify Stripe Account in Development**
```bash
# Check which Stripe account you're connected to
curl -X GET /api/stripe/config-check
```

Should return:
```json
{
  "configured": true,
  "testMode": true,  // ← Should be true in development
  "environment": "development"
}
```

### **2. Check Global Payouts Status**
In your **test** Stripe dashboard:
- Go to **More → Global Payouts**
- Should show "Active" or setup option
- If not active, complete setup

### **3. Verify Storage Balance API**
```bash
# Test Storage Balance service
curl -X GET /api/admin/diagnose-balances
```

Should show Storage Balance availability in test environment.

---

## 🔧 **Quick Fix Steps**

### **Immediate Actions:**

1. **Enable Global Payouts in ALL test Stripe accounts**
   - Go to each test account dashboard
   - Navigate to More → Global Payouts
   - Complete setup process

2. **Verify environment variables**
   - Check `.env.local` has test keys
   - Check production has live keys
   - Ensure no mixing of test/live keys

3. **Test the system**
   - Run environment audit API
   - Test Storage Balance transfers
   - Verify dashboard shows Storage Balance

### **Long-term Solutions:**

1. **Automated Environment Checks**
   - Add startup validation for Storage Balance availability
   - Alert if Global Payouts not enabled
   - Prevent deployment without proper setup

2. **Documentation Updates**
   - Document Global Payouts setup requirement
   - Add troubleshooting guide for Storage Balance
   - Include environment setup checklist

---

## 🎉 **Success Criteria**

The issue is resolved when:

- ✅ **Test Stripe accounts show Storage Balance** in dashboard
- ✅ **Development environment can move funds** to/from Storage Balance
- ✅ **Environment audit shows no issues**
- ✅ **All test APIs work** with Storage Balance
- ✅ **Clear separation** between test and production data

---

## 🚀 **Next Steps**

1. **Run environment audit** to identify specific issues
2. **Enable Global Payouts** in all test Stripe accounts
3. **Test Storage Balance transfers** in development
4. **Verify environment separation** is working correctly
5. **Document the setup process** for future reference

**The Storage Balance system is solid - we just need to ensure Global Payouts is enabled in all test environments!** 🎯
