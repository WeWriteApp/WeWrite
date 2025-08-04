# Deprecated API Endpoints - Token to USD Migration

This document lists all API endpoints that have been deprecated as part of the migration from the token-based system to the USD-based system.

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

## 🗑️ Legacy Migration Endpoints (To Be Removed)

These endpoints were used for the token-to-USD migration and should be removed after migration is complete:

#### `POST /api/tokens/migrate-unfunded`
- **Status**: Legacy - Remove after migration
- **Description**: Migrate unfunded token allocations to funded subscription
- **Action**: Remove after all users have been migrated

#### `POST /api/tokens/convert-unfunded`
- **Status**: Legacy - Remove after migration
- **Description**: Convert unfunded tokens when subscription becomes active
- **Action**: Remove after all users have been migrated

#### `POST /api/tokens/process-monthly`
- **Status**: Legacy - Remove after migration
- **Description**: Process monthly token distribution (cron job)
- **Action**: Remove after USD system is fully operational

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
