# WeWrite Platform Fee Management System

## Overview

WeWrite has a comprehensive platform fee management system that allows real-time configuration of the platform fee percentage through the admin interface. This system ensures that fee changes take effect immediately in production without requiring code deployments.

**Current Platform Fee: 10%** (Updated from 7% as of August 2025)

## System Architecture

### 1. **Admin Interface Location**
- **URL**: `/admin/tools`
- **Tab**: "Fees" tab in the admin tools interface
- **Component**: `FeeManagementSection` (`app/components/admin/FeeManagementSection.tsx`)

### 2. **Database Storage**
- **Collection**: `systemConfig`
- **Document**: `feeStructure`
- **Fields**:
  - `platformFeePercentage` (number): Fee as decimal (e.g., 0.05 for 5%)
  - `lastUpdated` (timestamp): When the fee was last changed
  - `updatedBy` (string): Who made the change (e.g., 'admin')

### 3. **Real-Time Updates**
- Uses Firestore's `onSnapshot` for real-time synchronization
- Changes propagate immediately to all connected clients
- No caching delays or manual refresh required

## Key Components

### Fee Service (`app/services/feeService.ts`)
- **Singleton pattern** for consistent state management
- **Real-time listener** using Firestore `onSnapshot`
- **Automatic fallback** to default values if database is unavailable
- **Type-safe interfaces** for fee structure

### Fee Calculations (`app/utils/feeCalculations.ts`)
- **Async functions** that fetch current fee structure from database
- **Backward compatibility** with static fallback functions
- **Comprehensive fee breakdown** including platform, Stripe, and tax calculations

### Payout Service Integration (`app/services/payoutService.ts`)
- **Dynamic fee fetching** in `getPayoutConfig()` method
- **Automatic conversion** between decimal and percentage formats
- **Fallback handling** for database errors

## Admin Interface Features

### Current Fee Display
- Shows the active platform fee percentage
- Real-time updates when changes are made
- Clear indication of creator retention percentage

### Fee Configuration
- Input validation (0-100% range)
- Step increment of 0.1% for precise control
- Preview calculations showing payout impact
- Reset functionality to undo changes

### Safety Features
- **Validation**: Prevents invalid fee percentages
- **Error handling**: Graceful fallback on database errors
- **Audit trail**: Tracks who made changes and when
- **Warning messages**: Clear communication about fee change impacts

## Usage Instructions

### For Administrators

1. **Access the Admin Interface**:
   - Navigate to `/admin/tools`
   - Click on the "Fees" tab

2. **View Current Fee**:
   - The current platform fee is displayed prominently
   - Shows creator retention percentage

3. **Change the Fee**:
   - Enter new percentage in the input field (0-100%)
   - Review the preview calculation
   - Click "Save Changes"
   - Confirm success message

4. **Monitor Changes**:
   - Changes take effect immediately
   - All future payouts use the new fee rate
   - Existing pending payouts use their original fee rate

### For Developers

#### Getting Current Fee Structure
```javascript
import { getCurrentFeeStructure } from '../utils/feeCalculations';

const feeStructure = await getCurrentFeeStructure();
console.log('Platform fee:', feeStructure.platformFeePercentage * 100 + '%');
```

#### Calculating Fees with Dynamic Structure
```javascript
import { calculateFeeBreakdownAsync } from '../utils/feeCalculations';

const breakdown = await calculateFeeBreakdownAsync(100, 'USD', 'standard');
console.log('Platform fee:', breakdown.wewritePlatformFee);
console.log('Net payout:', breakdown.netPayoutAmount);
```

#### Subscribing to Fee Changes
```javascript
import { subscribeFeeChanges } from '../services/feeService';

const unsubscribe = subscribeFeeChanges((feeStructure) => {
  console.log('Fee updated:', feeStructure.platformFeePercentage * 100 + '%');
});

// Don't forget to cleanup
// unsubscribe();
```

## Technical Implementation

### Real-Time Synchronization
The system uses Firestore's real-time capabilities to ensure immediate propagation:

```javascript
// Fee service automatically listens for changes
onSnapshot(feeDocRef, (doc) => {
  // Update cached fee structure
  // Notify all subscribers
});
```

### Backward Compatibility
Legacy functions are maintained with deprecation warnings:
- `calculateFeeBreakdown()` - Static version (deprecated)
- `calculateFeeBreakdownAsync()` - Dynamic version (recommended)

### Error Handling
- Database connection failures fall back to static defaults
- Invalid fee percentages are rejected with clear error messages
- Retry logic for transient failures

## Security Considerations

### Access Control
- Only admin users can access the fee management interface
- Admin status verified server-side for all fee update operations

### Data Validation
- Client-side validation for immediate feedback
- Server-side validation for security
- Range checking (0-100%) with appropriate error messages

### Audit Trail
- All fee changes are logged with timestamp and user information
- Historical tracking for compliance and debugging

## Testing

### Manual Testing
1. Access `/admin/tools` and navigate to "Fees" tab
2. Change the fee percentage and verify immediate update
3. Check that payout calculations reflect the new fee
4. Verify real-time updates across multiple browser tabs

### Automated Testing
Run the test script:
```bash
node app/test/fee-management-test.js
```

## Troubleshooting

### Common Issues

1. **Fee changes not taking effect**:
   - Check browser console for JavaScript errors
   - Verify admin permissions
   - Ensure database connectivity

2. **Real-time updates not working**:
   - Check Firestore connection
   - Verify listener subscriptions are active
   - Look for network connectivity issues

3. **Calculation discrepancies**:
   - Ensure using async fee calculation functions
   - Check for cached values in legacy code
   - Verify decimal/percentage conversion

### Debug Information
- Check browser console for fee service logs
- Monitor Firestore document changes in Firebase console
- Use the test script to verify system functionality

## Future Enhancements

### Planned Features
- **Fee scheduling**: Set future fee changes
- **Graduated fees**: Different rates based on earning tiers
- **Regional fees**: Location-based fee structures
- **Fee history**: Complete audit log interface

### Performance Optimizations
- **Caching strategies** for high-traffic scenarios
- **Batch updates** for multiple configuration changes
- **Connection pooling** for database efficiency

## Conclusion

The WeWrite platform fee management system provides a robust, real-time solution for adjusting platform fees without code deployments. The system prioritizes reliability, security, and ease of use while maintaining backward compatibility and comprehensive error handling.
