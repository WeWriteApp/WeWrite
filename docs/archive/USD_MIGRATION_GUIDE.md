# WeWrite USD Migration Guide

## Overview

WeWrite has successfully migrated from a token-based virtual currency system to a direct USD payment system. This guide covers the completed migration process, new features, and system architecture.

## Migration Summary

### What Changed ✅ COMPLETED
- **From:** Token-based virtual currency (100 tokens = $10)
- **To:** Direct USD payments and allocations
- **Status:** ✅ **MIGRATION COMPLETE** - All systems now use USD
- **Benefits:** Transparent pricing, no virtual currency confusion, direct creator support

### Key Improvements
1. **Transparent Pricing:** All amounts displayed in real USD
2. **Direct Payments:** No virtual currency conversion needed
3. **Simplified UX:** Users understand exactly what they're paying
4. **Better Creator Support:** Direct USD allocations to creators

## Architecture Changes

### Database Schema
- **New Collections:**
  - `usdBalances` - User USD account balances
  - `usdAllocations` - Monthly USD allocations to creators
  - `writerUsdBalances` - Creator earnings in USD
  - `usdPayouts` - USD payout records

- **Legacy Collections:** (Deprecated - migration complete)
  - `tokenBalances` - ⚠️ Deprecated - use `usdBalances`
  - `tokenAllocations` - ⚠️ Deprecated - use `usdAllocations`

### API Endpoints
- **New USD Endpoints:**
  - `/api/usd/balance` - USD balance management
  - `/api/usd/allocate` - Page allocations
  - `/api/usd/allocate-user` - User-to-user donations
  - `/api/usd/pledge-bar-data` - Pledge bar data
  - `/api/usd/initialize-balance` - Balance initialization

- **Legacy Token Endpoints:** (⚠️ Deprecated - migration complete)
  - `/api/tokens/*` - All token endpoints marked as deprecated with warnings

### Services
- **UsdService** - Client-side USD operations
- **ServerUsdService** - Server-side USD operations with admin permissions
- **UsdBalanceContext** - React context for USD balance state
- **simulatedUsd** - USD simulation for logged-out users

## Migration Process ✅ COMPLETED

### 1. Pre-Migration Preparation ✅ COMPLETE
```bash
# Backup existing data
npm run backup-production-data

# Run migration tests
npm run test:usd-migration

# Verify all components are ready
node scripts/test-usd-migration.js
```

### 2. Data Migration ✅ COMPLETE
```bash
# Dry run migration (recommended first)
node scripts/migrate-tokens-to-usd.js --dry-run

# Full migration
node scripts/migrate-tokens-to-usd.js

# Verify migration accuracy
node scripts/migrate-tokens-to-usd.js --verify
```

**Migration Status:** ✅ **COMPLETE** - All development and production data migrated successfully

### 3. Rollback Scripts (Available if needed)
```bash
# Rollback to token system (emergency use only)
node scripts/rollback-usd-migration.js --dry-run
node scripts/rollback-usd-migration.js
```

## Component Migration ✅ COMPLETED

### New USD Components ✅ ACTIVE
- `UsdPledgeBar` - Main pledge bar with USD amounts
- `UsdAllocationModal` - USD allocation modal
- `UserUsdPledgeBar` - User-to-user USD support
- `UsdAllocationDisplay` - Balance and allocation overview
- `UsdAllocationBreakdown` - Detailed allocation breakdown
- `UsdFundingTierSlider` - Subscription tier selection
- `UsdPieChart` - Visual allocation breakdown
- `RemainingUsdCounter` - Available funds counter

### Legacy Component Status ⚠️ DEPRECATED
All legacy token components are marked as deprecated with `@deprecated` warnings. They maintain backward compatibility but should not be used in new development.

## Settings Pages Migration ✅ COMPLETED

### New Pages ✅ ACTIVE
- `/settings/fund-account` - Account funding (replaces buy-tokens)
- `/settings/spend` - Spending management (replaces spend-tokens)
- `/settings/fund-account/checkout` - Funding checkout flow
- `/settings/fund-account/success` - Success confirmation

### Updated Navigation ✅ COMPLETE
- Settings page updated to prioritize USD-based options
- Legacy token options removed from active navigation
- New green "Fund Account" buttons deployed throughout the app

## Testing

### Automated Tests
```bash
# Run all USD migration tests
npm run test:usd-migration

# Run specific test suites
npm test __tests__/utils/formatCurrency.test.ts
npm test __tests__/api/usd/
```

### Manual Testing Checklist
- [ ] User can fund account with various amounts
- [ ] Pledge bars work on all page types
- [ ] USD allocations save and persist correctly
- [ ] Settings pages display correct information
- [ ] Stripe integration processes payments
- [ ] Creator payouts calculate correctly
- [ ] Mobile experience works smoothly
- [ ] Logged-out simulation works properly

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Database migration scripts tested
- [ ] Stripe webhooks updated
- [ ] Environment variables configured
- [ ] Backup procedures verified

### Deployment Steps
1. **Deploy Backend Changes**
   - Deploy new API endpoints
   - Update Stripe webhook handlers
   - Deploy database schema changes

2. **Run Data Migration**
   - Execute migration scripts
   - Verify data accuracy
   - Monitor for errors

3. **Deploy Frontend Changes**
   - Deploy new USD components
   - Update settings pages
   - Enable new features

4. **Post-Deployment Verification**
   - Test critical user flows
   - Monitor error rates
   - Verify payment processing

### Rollback Plan
If issues arise:
1. Disable new USD features via feature flags
2. Revert to legacy token system
3. Run rollback migration script
4. Monitor system stability

## Monitoring and Alerts

### Key Metrics to Monitor
- USD allocation success rates
- Payment processing errors
- User adoption of new system
- Creator payout accuracy
- API response times

### Alert Thresholds
- Payment failures > 1%
- API errors > 0.5%
- Migration data inconsistencies
- Stripe webhook failures

## User Communication

### Migration Announcement
- Email to all users explaining the change
- In-app notifications about new features
- Help documentation updates
- FAQ section for common questions

### Support Preparation
- Train support team on new USD system
- Update help documentation
- Prepare FAQ responses
- Monitor support ticket volume

## Performance Considerations

### Database Optimization
- Index new USD collections appropriately
- Monitor query performance
- Optimize allocation lookups
- Consider read replicas for heavy queries

### Caching Strategy
- Cache USD balance data appropriately
- Implement efficient allocation queries
- Use optimistic updates for better UX
- Monitor cache hit rates

## Security Considerations

### Payment Security
- All payments processed through Stripe
- No credit card data stored locally
- PCI compliance maintained
- Regular security audits

### Data Protection
- USD amounts stored as integers (cents)
- Audit logs for all financial transactions
- Access controls for sensitive operations
- Regular backup verification

## Future Enhancements

### Planned Features
- Multiple currency support
- Advanced allocation scheduling
- Creator funding goals
- Enhanced analytics dashboard

### Technical Debt
- Gradual removal of legacy token code
- Database cleanup of unused collections
- Component consolidation
- Performance optimizations

## Troubleshooting

### Common Issues
1. **Migration Data Inconsistencies**
   - Run verification script
   - Check audit logs
   - Manual data correction if needed

2. **Payment Processing Errors**
   - Check Stripe dashboard
   - Verify webhook configuration
   - Review error logs

3. **User Balance Discrepancies**
   - Compare with audit logs
   - Verify allocation calculations
   - Check for concurrent updates

### Support Contacts
- Engineering: engineering@wewrite.com
- DevOps: devops@wewrite.com
- Support: support@wewrite.com

## Conclusion

The USD migration represents a significant improvement to WeWrite's payment system, providing transparency and simplicity for users while maintaining robust functionality for creators. The migration has been designed with backward compatibility and safety in mind, ensuring a smooth transition for all users.

For questions or issues, please contact the engineering team or refer to the troubleshooting section above.
