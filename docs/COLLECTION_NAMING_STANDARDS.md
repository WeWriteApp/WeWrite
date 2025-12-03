# Collection Naming Standards

## Overview

This document establishes the official naming conventions for Firestore collections in the WeWrite application to prevent inconsistencies and confusion.

## 🎯 Core Principles

### 1. **Always Use camelCase**
- ✅ `usdBalances` 
- ❌ `usd_balances`
- ❌ `USD_BALANCES`

### 2. **Always Use Environment-Aware Functions**
- ✅ `getCollectionName('usdBalances')`
- ❌ Direct collection references like `'usdBalances'`

### 3. **Use Descriptive Names**
- ✅ `writerUsdBalances` (clear purpose)
- ❌ `balances` (too generic)

## 📋 Official Collection Names

### Core Collections
```typescript
USERS: 'users'
PAGES: 'pages'
ACTIVITIES: 'activities'
CONFIG: 'config'
```

### USD Payment System (Active)
```typescript
USD_BALANCES: 'usdBalances'              // User USD account balances
USD_ALLOCATIONS: 'usdAllocations'        // Monthly USD allocations to creators
PENDING_USD_ALLOCATIONS: 'pendingUsdAllocations'  // Pending allocations
USD_EARNINGS: 'usdEarnings'              // USD earnings records
WRITER_USD_BALANCES: 'writerUsdBalances' // Creator earnings in USD
WRITER_USD_EARNINGS: 'writerUsdEarnings' // Detailed earnings records
USD_PAYOUTS: 'usdPayouts'                // USD payout transaction records
```

### Subscription & Payment
```typescript
SUBSCRIPTIONS: 'subscriptions'           // User subscriptions (subcollection)
BANK_ACCOUNTS: 'bankAccounts'           // User bank account info
PAYOUTS: 'payouts'                      // General payout records
PAYOUT_REQUESTS: 'payoutRequests'       // Payout requests
TRANSACTIONS: 'transactions'            // Transaction history
PAYMENT_RECOVERY: 'paymentRecovery'     // Payment recovery records
```

### Analytics
```typescript
ANALYTICS_COUNTERS: 'analytics_counters'  // Note: Legacy snake_case
ANALYTICS_DAILY: 'analytics_daily'        // Note: Legacy snake_case
ANALYTICS_HOURLY: 'analytics_hourly'      // Note: Legacy snake_case
PAGE_VIEWS: 'pageViews'
```

### User Features
```typescript
READING_HISTORY: 'readingHistory'
SESSIONS: 'sessions'
SITE_VISITORS: 'siteVisitors'
USER_FOLLOWER_RELATIONS: 'userFollowerRelations'
USER_FOLLOWERS: 'userFollowers'
USER_FOLLOWING: 'userFollowing'
USER_FOLLOWS: 'userFollows'
USER_STREAKS: 'userStreaks'
USERNAME_HISTORY: 'usernameHistory'
USERNAMES: 'usernames'
```

### Feature Management
```typescript
FEATURE_HISTORY: 'featureHistory'
FEATURE_OVERRIDES: 'featureOverrides'
LEDGER: 'ledger'
PLEDGES: 'pledges'
NOTIFICATIONS: 'notifications'
COUNTERS: 'counters'
BACKLINKS: 'backlinks'
FOLLOWS: 'follows'
PAGE_FOLLOWERS: 'pageFollowers'
```

### Legacy Collections (Deprecated)
```typescript
// ⚠️ DEPRECATED - Use USD equivalents instead
TOKEN_BALANCES: 'tokenBalances'          // Use USD_BALANCES
TOKEN_ALLOCATIONS: 'tokenAllocations'    // Use USD_ALLOCATIONS
PENDING_TOKEN_ALLOCATIONS: 'pendingTokenAllocations'  // Use PENDING_USD_ALLOCATIONS
TOKEN_EARNINGS: 'tokenEarnings'          // Use USD_EARNINGS
WRITER_TOKEN_BALANCES: 'writerTokenBalances'  // Use WRITER_USD_BALANCES
WRITER_TOKEN_EARNINGS: 'writerTokenEarnings'  // Use WRITER_USD_EARNINGS
TOKEN_PAYOUTS: 'tokenPayouts'            // Use USD_PAYOUTS
```

## 🔧 Usage Guidelines

### ✅ Correct Usage

```typescript
import { getCollectionName, COLLECTIONS } from '../utils/environmentConfig';

// Use the constant and environment-aware function
const balanceRef = doc(db, getCollectionName(COLLECTIONS.USD_BALANCES), userId);

// For subcollections
const { parentPath, subCollectionName } = getSubCollectionPath(
  COLLECTIONS.USERS, 
  userId, 
  COLLECTIONS.SUBSCRIPTIONS
);
```

### ❌ Incorrect Usage

```typescript
// DON'T: Direct collection reference
const balanceRef = doc(db, 'usdBalances', userId);

// DON'T: Wrong casing
const balanceRef = doc(db, 'usd_balances', userId);

// DON'T: Hardcoded environment prefix
const balanceRef = doc(db, 'DEV_usdBalances', userId);
```

## 🌍 Environment Handling

### Development
- Collections get `DEV_` prefix: `DEV_usdBalances`
- Isolated from production data

### Preview/Staging
- Uses production collections: `usdBalances`
- Shares data with production for testing

### Production
- Base collection names: `usdBalances`
- Live user data

## 🚨 Common Mistakes to Avoid

### 1. **Inconsistent Casing**
```typescript
// ❌ Wrong
'usd_balances'  // snake_case
'USD_BALANCES'  // UPPER_CASE

// ✅ Correct
'usdBalances'   // camelCase
```

### 2. **Direct Collection References**
```typescript
// ❌ Wrong - bypasses environment handling
collection(db, 'usdBalances')

// ✅ Correct - environment-aware
collection(db, getCollectionName('usdBalances'))
```

### 3. **Hardcoded Environment Prefixes**
```typescript
// ❌ Wrong - hardcoded prefix
collection(db, 'DEV_usdBalances')

// ✅ Correct - dynamic prefix
collection(db, getCollectionName('usdBalances'))
```

## 🔍 Validation Tools

### Check Collection Naming
```bash
# Run the collection naming audit
node scripts/fix-collection-naming.js
```

### Firestore Optimization Audit
```bash
# Check for naming inconsistencies
node scripts/firestore-optimization-audit.js
```

## 📝 Adding New Collections

When adding a new collection:

1. **Add to COLLECTIONS constant**
```typescript
// In app/utils/environmentConfig.ts
export const COLLECTIONS = {
  // ... existing collections
  NEW_COLLECTION: 'newCollection'  // Use camelCase
} as const;
```

2. **Use environment-aware access**
```typescript
// In your code
const newCollectionRef = collection(db, getCollectionName(COLLECTIONS.NEW_COLLECTION));
```

3. **Update documentation**
- Add to this file
- Update relevant API documentation
- Add to migration scripts if needed

## 🔄 Migration Notes

### From snake_case to camelCase
If you find collections using snake_case (like `usd_balances`):

1. **Don't rename existing collections** - this breaks existing data
2. **Update code to use correct constant** - use `COLLECTIONS.USD_BALANCES` 
3. **The constant maps to the correct name** - `'usdBalances'`
4. **Environment prefixes are added automatically** - `DEV_usdBalances` in dev

### Legacy Analytics Collections
Some analytics collections still use snake_case (`analytics_counters`) for historical reasons. These are documented as exceptions and should not be changed without a full migration plan.

## 🎯 Summary

- **Always use camelCase** for new collections
- **Always use `getCollectionName()`** for environment awareness
- **Always use COLLECTIONS constants** instead of string literals
- **Never hardcode environment prefixes**
- **Document any exceptions** with clear reasoning

This ensures consistent, maintainable, and environment-safe collection access across the entire application.

## 🔧 Recent Fixes (August 2025)

### Resolved Collection Naming Issues

**Problem**: Found duplicate collections with inconsistent casing:
- `DEV_usd_balances` (snake_case) vs `DEV_usdBalances` (camelCase)
- `DEV_user_preferences` (snake_case) vs `DEV_userPreferences` (camelCase)

**Solution**:
1. ✅ **Fixed API code** - Updated hardcoded collection references to use COLLECTIONS constants
2. ✅ **Migrated data** - Safely moved data from snake_case to camelCase collections
3. ✅ **Cleaned up duplicates** - Removed old snake_case collections after migration
4. ✅ **Added constants** - Added `USER_PREFERENCES: 'userPreferences'` to COLLECTIONS
5. ✅ **Updated documentation** - Created comprehensive naming standards

**Files Fixed**:
- `app/api/dev/check-balances/route.ts` - Fixed `'usd_balances'` → `'usdBalances'`
- `app/api/dev/setup-test-data/route.ts` - Fixed `'usd_balances'` → `'usdBalances'`
- `app/api/user-preferences/allocation-interval/route.ts` - Fixed `'user_preferences'` → `COLLECTIONS.USER_PREFERENCES`
- `scripts/migrate-tokens-to-usd.js` - Fixed environment-aware collection access

**Migration Scripts Created**:
- `scripts/audit-duplicate-collections.js` - Identifies duplicate collections
- `scripts/find-casing-duplicates.js` - Finds snake_case vs camelCase duplicates
- `scripts/migrate-collection-casing.js` - Safely migrates data between collections
- `scripts/delete-collection.js` - Safely deletes collections using Admin SDK

### Current Status: ✅ RESOLVED
All collection naming inconsistencies have been fixed. The codebase now uses:
- **Consistent camelCase naming** for all new collections
- **Environment-aware access** via `getCollectionName(COLLECTIONS.CONSTANT)`
- **No duplicate collections** with different casing patterns

### Prevention Measures
1. **Code Review Checklist** - Always check for hardcoded collection names
2. **Automated Scripts** - Use audit scripts to detect future inconsistencies
3. **Documentation** - This comprehensive guide prevents future confusion
4. **Constants Usage** - Always use COLLECTIONS constants instead of string literals

## Related Documentation

- [Firebase Migration Architecture](./FIREBASE_MIGRATION_ARCHITECTURE.md) - Environment-aware architecture
- [Environment Quick Reference](./ENVIRONMENT_QUICK_REFERENCE.md) - Dev vs prod collections
- [Financial Data Architecture](./FINANCIAL_DATA_ARCHITECTURE.md) - Financial collections
- [USD Payment System](./USD_PAYMENT_SYSTEM.md) - USD-related collections
- [Firebase Optimization Guide](./FIREBASE_OPTIMIZATION_GUIDE.md) - Query optimization
