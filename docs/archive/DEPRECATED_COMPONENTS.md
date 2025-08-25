# Deprecated Components & Systems

This document lists all components and systems that have been deprecated as part of various system migrations and improvements.

## ⚠️ Deprecated Systems

### Email Verification Sync Queue System
- **Status**: Deprecated and Removed
- **Date Removed**: January 2025
- **Description**: Legacy system that queued content creation for unverified email users
- **Reason**: Removed as part of email verification UX improvement - users can now access all features immediately
- **Migration**: All users can create content immediately; email verification is now handled only through banner system

### Redundant Earnings Dashboard Components
- **Status**: Deprecated and Removed
- **Date Removed**: January 2025
- **Components Removed**:
  - `PayoutsManager.tsx` - Complex payout management with redundant features
  - `PayoutDashboard.tsx` - Duplicate payout functionality
  - `WriterUsdDashboard.tsx` - Redundant earnings display
- **Reason**: Consolidated to use single `SimpleEarningsDashboard` component for maintainability
- **Migration**: All payout functionality now handled by `SimpleEarningsDashboard` in earnings page

## ⚠️ Deprecated Components

### Token Allocation Components

#### `TokenAllocationModal.tsx`
- **Status**: Deprecated
- **Replacement**: `UsdAllocationModal`
- **Location**: `app/components/payments/TokenAllocationModal.tsx`
- **Description**: Legacy token allocation modal for managing token allocations to pages
- **Migration**: Use `UsdAllocationModal` for USD-based allocations

#### `TokenAllocationDisplay.tsx`
- **Status**: Deprecated
- **Replacement**: `UsdAllocationDisplay`
- **Location**: `app/components/token-purchase/TokenAllocationDisplay.tsx`
- **Description**: Legacy display component for token balance and allocation overview
- **Migration**: Use `UsdAllocationDisplay` for USD-based balance displays

#### `TokenAllocationBreakdown.tsx`
- **Status**: Deprecated
- **Replacement**: `UsdAllocationBreakdown`
- **Location**: `app/components/token-purchase/TokenAllocationBreakdown.tsx`
- **Description**: Legacy detailed breakdown of token allocations
- **Migration**: Use `UsdAllocationBreakdown` for USD-based allocation details

#### `TokenAllocationDashboard.tsx`
- **Status**: Deprecated
- **Replacement**: `UsdAllocationDashboard`
- **Location**: `app/components/token-purchase/TokenAllocationDashboard.tsx`
- **Description**: Legacy dashboard for managing token allocations
- **Migration**: Use `UsdAllocationDashboard` for USD-based allocation management

#### `EmbeddedTokenAllocation.tsx`
- **Status**: Deprecated
- **Replacement**: `UsdPledgeBar`
- **Location**: `app/components/payments/EmbeddedTokenAllocation.tsx`
- **Description**: Legacy embedded token allocation controls
- **Migration**: Use `UsdPledgeBar` for USD-based pledge functionality

### Token Purchase Components

#### `TokenPurchaseTierSlider.tsx`
- **Status**: Deprecated
- **Replacement**: `UsdFundingTierSlider`
- **Location**: `app/components/token-purchase/TokenPurchaseTierSlider.tsx`
- **Description**: Legacy subscription tier slider for token purchases
- **Migration**: Use `UsdFundingTierSlider` for USD-based subscription tiers

#### `TokenPurchaseHistory.tsx`
- **Status**: Deprecated
- **Replacement**: Subscription history components
- **Location**: `app/components/token-purchase/TokenPurchaseHistory.tsx`
- **Description**: Legacy token purchase history display
- **Migration**: Use subscription history components for USD-based purchase history

### Token Dashboard Components

#### `WriterTokenDashboard.tsx`
- **Status**: Deprecated
- **Replacement**: `WriterUsdDashboard`
- **Location**: `app/components/payments/WriterTokenDashboard.tsx`
- **Description**: Legacy writer dashboard showing token earnings
- **Migration**: Use `WriterUsdDashboard` for USD-based writer earnings

### Context Components

#### `TokenBalanceContext.tsx`
- **Status**: Deprecated
- **Replacement**: `UsdBalanceContext`
- **Location**: `app/contexts/TokenBalanceContext.tsx`
- **Description**: Legacy context for managing token balance state
- **Migration**: Use `UsdBalanceContext` for USD-based balance management

### UI Components

#### `TokenAllocationBar.tsx`
- **Status**: Deprecated
- **Replacement**: `UsdPledgeBar`
- **Location**: `app/components/editor/TokenAllocationBar.tsx`
- **Description**: Legacy token allocation bar for editor
- **Migration**: Use `UsdPledgeBar` for USD-based allocation bars

#### `RemainingTokensCounter.tsx`
- **Status**: Deprecated
- **Replacement**: `RemainingUsdCounter`
- **Location**: `app/components/ui/RemainingTokensCounter.tsx`
- **Description**: Legacy remaining tokens counter display
- **Migration**: Use `RemainingUsdCounter` for USD-based remaining funds display

#### `TokenPieChart.tsx`
- **Status**: Deprecated
- **Replacement**: `UsdPieChart`
- **Location**: `app/components/ui/TokenPieChart.tsx`
- **Description**: Legacy token allocation pie chart
- **Migration**: Use `UsdPieChart` for USD-based pie charts

## 🔄 Migration Guide

### For Developers

1. **Replace Imports**: Update import statements to use USD equivalents
2. **Update Props**: Convert token-based props to USD cents
3. **Update State**: Use USD balance context instead of token balance context
4. **Update API Calls**: Use USD API endpoints instead of token endpoints

### Component Mapping

| Legacy Token Component | New USD Component |
|------------------------|-------------------|
| `TokenAllocationModal` | `UsdAllocationModal` |
| `TokenAllocationDisplay` | `UsdAllocationDisplay` |
| `TokenAllocationBreakdown` | `UsdAllocationBreakdown` |
| `TokenAllocationDashboard` | `UsdAllocationDashboard` |
| `EmbeddedTokenAllocation` | `UsdPledgeBar` |
| `TokenPurchaseTierSlider` | `UsdFundingTierSlider` |
| `TokenPurchaseHistory` | Subscription history components |
| `WriterTokenDashboard` | `WriterUsdDashboard` |
| `TokenBalanceContext` | `UsdBalanceContext` |
| `TokenAllocationBar` | `UsdPledgeBar` |
| `RemainingTokensCounter` | `RemainingUsdCounter` |
| `TokenPieChart` | `UsdPieChart` |

### Data Conversion

- **Tokens to USD**: 1 token = $0.10 (10 cents)
- **Token amounts**: Convert to USD cents (multiply by 10)
- **Display values**: Use `formatUsdCents()` for consistent formatting

## 📅 Deprecation Timeline

- **Phase 1**: Components marked as deprecated (✅ Complete)
- **Phase 2**: Remove from active pages and replace with USD equivalents
- **Phase 3**: Delete deprecated components after migration is complete
- **Phase 4**: Clean up related utilities and types

## ⚠️ Important Notes

- **Do not use deprecated components** in new development
- **Existing usage** should be migrated to USD equivalents
- **Components will be removed** in a future version
- **USD system is the standard** going forward

## 🔗 Related Documentation

- [USD Migration Guide](./USD_MIGRATION_GUIDE.md)
- [USD System Overview](./USD_SYSTEM.md)
- [Component Migration Examples](./COMPONENT_MIGRATION_EXAMPLES.md)
