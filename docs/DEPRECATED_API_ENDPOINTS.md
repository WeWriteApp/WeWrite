# Deprecated API Endpoints - Token to USD Migration

This document lists all API endpoints that have been deprecated as part of the migration from the token-based system to the USD-based system.

## ✅ Migration Status: COMPLETE

**Migration completed**: January 2025
**Token collections**: All empty (verified)
**USD collections**: Active with 133+ documents
**Legacy code cleanup**: Complete

## ⚠️ Deprecated Token API Endpoints

### Core Token Operations

#### `GET /api/tokens/balance`
- **Status**: Deprecated
- **Replacement**: `GET /api/usd/balance`
- **Description**: Get user's token balance and allocation information
- **Migration**: Use USD balance endpoint for USD cents instead of tokens

#### `POST /api/tokens/allocate`
- **Status**: Deprecated
- **Replacement**: `POST /api/usd/allocate`
- **Description**: Allocate monthly tokens to creators/pages
- **Migration**: Use USD allocation endpoint with USD cents instead of tokens

#### `POST /api/tokens/initialize-balance`
- **Status**: Deprecated
- **Replacement**: `POST /api/usd/initialize-balance`
- **Description**: Initialize token balance for new subscription
- **Migration**: Use USD initialization endpoint for USD-based subscriptions

### Token Allocation Endpoints

#### `GET /api/tokens/allocations`
- **Status**: Deprecated
- **Replacement**: `GET /api/usd/allocations`
- **Description**: Get user's token allocations with page details
- **Migration**: Use USD allocations endpoint for USD-based allocation listings

#### `POST /api/tokens/page-allocation`
- **Status**: Deprecated
- **Replacement**: `POST /api/usd/allocate`
- **Description**: Simple token allocation for pages (used by TokenAllocationBar)
- **Migration**: Use unified USD allocation endpoint

#### `GET /api/tokens/page-allocation`
- **Status**: Deprecated
- **Replacement**: `GET /api/usd/allocate`
- **Description**: Get current token allocation for a page
- **Migration**: Use unified USD allocation endpoint for current USD allocations

#### `POST /api/tokens/allocate-user`
- **Status**: Deprecated
- **Replacement**: `POST /api/usd/allocate-user`
- **Description**: Allocate tokens directly to a user (user-to-user donations)
- **Migration**: Use USD user allocation endpoint for USD-based donations

#### `GET /api/tokens/allocate-user`
- **Status**: Deprecated
- **Replacement**: `GET /api/usd/allocate-user`
- **Description**: Get current token allocation to a specific user
- **Migration**: Use USD user allocation endpoint for current USD allocations

### Token Earnings & Payouts

#### `GET /api/tokens/earnings`
- **Status**: Deprecated
- **Replacement**: `GET /api/usd/earnings`
- **Description**: Get writer token earnings and request payouts
- **Migration**: Use USD earnings endpoint for USD-based earnings and payouts

#### `POST /api/tokens/process-writer-earnings`
- **Status**: Deprecated
- **Replacement**: `POST /api/usd/process-writer-earnings`
- **Description**: Process monthly writer token earnings (cron job)
- **Migration**: Use USD earnings processing endpoint for USD-based earnings

### UI Support Endpoints

#### `GET /api/tokens/pledge-bar-data`
- **Status**: Deprecated
- **Replacement**: `GET /api/usd/pledge-bar-data`
- **Description**: Fast data endpoint for PledgeBar component
- **Migration**: Use USD pledge bar data endpoint for UsdPledgeBar component

## 🗑️ Legacy Migration Endpoints (REMOVED)

These endpoints were used for the token-to-USD migration and have been removed after migration completion:

#### `POST /api/tokens/migrate-unfunded` ✅ REMOVED
- **Status**: Removed - Migration complete
- **Description**: Migrated unfunded token allocations to funded subscription
- **Action**: ✅ Removed after all users were migrated

#### `POST /api/tokens/convert-unfunded` ✅ REMOVED
- **Status**: Removed - Migration complete
- **Description**: Converted unfunded tokens when subscription became active
- **Action**: ✅ Removed after all users were migrated

#### `POST /api/tokens/process-monthly` ✅ REMOVED
- **Status**: Removed - Migration complete
- **Description**: Processed monthly token distribution (cron job)
- **Action**: ✅ Removed after USD system became fully operational

## 📋 API Migration Mapping

| Deprecated Token Endpoint | New USD Endpoint |
|---------------------------|------------------|
| `GET /api/tokens/balance` | `GET /api/usd/balance` |
| `POST /api/tokens/allocate` | `POST /api/usd/allocate` |
| `POST /api/tokens/initialize-balance` | `POST /api/usd/initialize-balance` |
| `GET /api/tokens/allocations` | `GET /api/usd/allocations` |
| `POST /api/tokens/page-allocation` | `POST /api/usd/allocate` |
| `GET /api/tokens/page-allocation` | `GET /api/usd/allocate` |
| `POST /api/tokens/allocate-user` | `POST /api/usd/allocate-user` |
| `GET /api/tokens/allocate-user` | `GET /api/usd/allocate-user` |
| `GET /api/tokens/earnings` | `GET /api/usd/earnings` |
| `POST /api/tokens/process-writer-earnings` | `POST /api/usd/process-writer-earnings` |
| `GET /api/tokens/pledge-bar-data` | `GET /api/usd/pledge-bar-data` |

## 🔄 Data Format Changes

### Request Body Changes
- **Token amounts**: Replace `tokens` field with `usdCents` field
- **Token changes**: Replace `tokenChange` field with `usdCentsChange` field
- **Conversion**: 1 token = 10 USD cents (multiply tokens by 10)

### Response Format Changes
- **Balance objects**: USD cents instead of token amounts
- **Allocation objects**: USD cents instead of token amounts
- **Earnings objects**: USD cents instead of token amounts

## 🧹 Cleanup Summary (January 2025)

### Removed Legacy Code
- **Services**: `tokenService.ts`, `pendingTokenAllocationService.ts`, `tokenEarningsService.ts`
- **API Endpoints**: `debug-token-balance`, `verify-token-data`, `page-stats` (token-based)
- **Scripts**: Migration scripts moved to `scripts/archived-migrations/`
- **Firestore Rules**: All token collection rules removed
- **Database Queries**: All hardcoded `tokenAllocations`, `tokenBalances` queries replaced

### Deprecated API Endpoints
All token-based API endpoints now return HTTP 410 (Gone) with proper deprecation notices pointing to USD equivalents.

### Example Migration
```javascript
// OLD: Token allocation
POST /api/tokens/allocate
{
  "pageId": "abc123",
  "tokens": 50
}

// NEW: USD allocation
POST /api/usd/allocate
{
  "pageId": "abc123",
  "usdCentsChange": 500  // 50 tokens = 500 cents
}
```

## 📅 Deprecation Timeline

- **Phase 1**: Endpoints marked as deprecated (✅ Complete)
- **Phase 2**: Update client code to use USD endpoints
- **Phase 3**: Remove deprecated token endpoints
- **Phase 4**: Clean up legacy migration endpoints

## ⚠️ Important Notes

- **Do not use deprecated endpoints** in new development
- **Existing API calls** should be migrated to USD equivalents
- **Endpoints will be removed** in a future version
- **USD system is the standard** going forward
- **Legacy migration endpoints** will be removed after migration is complete

## 🔗 Related Documentation

- [USD Migration Guide](./USD_MIGRATION_GUIDE.md)
- [Deprecated Components](./DEPRECATED_COMPONENTS.md)
- [USD System Overview](./USD_SYSTEM.md)
