# ARCHIVED — see `docs/PAYMENTS_AND_ALLOCATIONS.md`

## WeWrite Platform Fee Update - August 2025

## Summary

WeWrite's platform fee has been increased from **7%** to **10%** effective August 2025. This change affects all future payouts to creators.

## What Changed

### Previous Fee Structure
- **Platform Fee**: 7%
- **Creators kept**: 93% of earnings (minus payment processing fees)

### New Fee Structure  
- **Platform Fee**: 10%
- **Creators keep**: 90% of earnings (minus payment processing fees)

## Impact on Creators

### Example Payout Calculation

**Before (7% fee):**
- Creator earnings: $100.00
- WeWrite platform fee: $7.00
- Creator receives: $93.00 (minus Stripe fees)

**After (10% fee):**
- Creator earnings: $100.00  
- WeWrite platform fee: $10.00
- Creator receives: $90.00 (minus Stripe fees)

### When This Takes Effect

- **Existing pending payouts**: Use the 7% fee rate that was active when initiated
- **New payouts**: Use the 10% fee rate for all payouts initiated after this update
- **No retroactive changes**: Past completed payouts are not affected

## Technical Implementation

### Centralized Configuration

The platform fee is defined in one place and propagated throughout the system:

**Primary Configuration** (`app/utils/feeCalculations.ts`):
```typescript
export const WEWRITE_FEE_STRUCTURE = {
  platformFeePercentage: 0.10, // 10% - WeWrite platform fee
  // ... other fee settings
};
```

### Updated Components

The following UI components now reflect the 10% fee:

1. **Payout Fee Breakdown** (`app/components/PayoutFeeBreakdown.tsx`)
   - Shows detailed fee calculation to users
   - Displays "Platform fee (10%)" in payout screens

2. **Admin Dashboard** (`app/components/admin/PlatformFeeRevenueWidget.tsx`)
   - Revenue tracking shows "10% of payouts"
   - Analytics reflect new fee structure

3. **Fee Management Interface** (`app/components/admin/FeeManagementSection.tsx`)
   - Admin interface for real-time fee adjustments
   - Shows current 10% rate

### Configuration Files Updated

- `app/utils/feeCalculations.ts` - Main fee structure
- `app/services/feeConfigurationService.ts` - Service layer configuration  
- `app/config/currency.ts` - Currency-specific settings
- `app/utils/currencyUtils.ts` - Utility functions
- `app/components/PayoutFeeBreakdown.tsx` - UI display components

## User Experience

### What Users See

1. **Payout Screens**: Clear breakdown showing 10% platform fee
2. **Earnings Calculations**: Updated to reflect new fee structure
3. **Admin Tools**: Real-time fee management interface shows 10%

### Transparency

- All fee calculations are shown transparently to users
- Payout screens clearly indicate the 10% platform fee
- No hidden fees or surprise deductions

## Documentation Updates

The following documentation has been updated to reflect the 10% fee:

- `docs/PLATFORM_FEE_MANAGEMENT_SYSTEM.md`
- `docs/PAYOUT_SYSTEM_DOCUMENTATION.md`
- This new document: `docs/PLATFORM_FEE_UPDATE_AUGUST_2025.md`

## Admin Management

Administrators can still adjust the platform fee in real-time through:

- **URL**: `/admin/tools`
- **Tab**: "Fees" section
- **Real-time updates**: Changes take effect immediately for new payouts

## Questions & Support

For questions about this fee change:

1. **Technical**: Refer to the updated documentation
2. **Business**: Contact the WeWrite team
3. **Implementation**: Check the centralized fee configuration in `app/utils/feeCalculations.ts`

---

**Note**: This change ensures WeWrite can continue providing and improving the platform while maintaining transparency with creators about fee structures.
