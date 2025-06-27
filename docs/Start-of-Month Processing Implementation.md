# Start-of-Month Processing Implementation

## Overview

This document describes the implementation of WeWrite's new "Start-of-Month" processing model, which replaces the previous 1-2-3 timing system to eliminate dead zones and provide a seamless user experience.

## Key Changes

### 1. Timing Model: Start-of-Month Processing

**Previous System Issues:**
- 1st: Token allocations finalized
- 2nd: Payouts processed  
- 3rd: New subscriptions billed
- **Problem**: 2-day dead zone where users couldn't allocate tokens

**New System Solution:**
- **1st of Month**: All processing happens together
  1. Finalize previous month's token allocations → send to writers
  2. Process payouts for writers
  3. Bill subscriptions for new month → users get new tokens immediately
  4. Users can start allocating new tokens (no dead zone!)

### 2. Pending Token Allocation System

**Implementation:**
- `PendingTokenAllocationService`: Handles adjustable allocations throughout the month
- `pendingTokenAllocations` collection: Stores pending allocations with status tracking
- Users can modify allocations until end-of-month deadline
- Allocations are finalized during start-of-month processing

**Key Features:**
- Real-time allocation adjustments
- Countdown timer showing deadline
- Automatic finalization at month-end
- Seamless transition to new month

### 3. Stripe Escrow System

**Purpose:** Separate user subscription funds from platform revenue for clean financial reporting

**Implementation:**
- `StripeEscrowService`: Manages fund segregation
- Two escrow accounts:
  - `user_funds`: Holds subscription payments until payout
  - `platform_revenue`: Platform fees and unallocated tokens
- Automatic fund transfers based on transaction type

**Benefits:**
- Clean financial reporting (WeWrite only shows legitimate revenue)
- Proper fund segregation for audit compliance
- Transparent fee handling

### 4. Fee Breakdown Display

**Components:**
- `PayoutFeeBreakdown`: Detailed fee breakdown component
- `CompactFeeBreakdown`: Inline fee display
- `PayoutSummary`: Summary for payout requests

**Fee Structure:**
- Stripe processing: 2.9% + $0.30
- Platform fee: 7%
- Clear breakdown shown to users before payout

### 5. UI Components

**Countdown Timer:**
- `AllocationCountdownTimer`: Shows time until allocation deadline
- `CompactAllocationTimer`: Compact version for smaller spaces
- Real-time updates with urgency indicators

**Explainer Components:**
- `StartOfMonthExplainer`: Explains the processing model
- Multiple variants (full, compact, minimal)
- Clear benefits and timeline explanation

## Technical Implementation

### API Endpoints

#### Token Allocations
- `POST /api/tokens/pending-allocations`: Create/update pending allocations
- `GET /api/tokens/pending-allocations`: Get user's allocation summary
- `DELETE /api/tokens/pending-allocations`: Remove allocation

#### Monthly Processing
- `POST /api/tokens/process-monthly`: Finalize allocations and process distributions
- `POST /api/payouts/process-monthly`: Process writer payouts
- `POST /api/subscription/process-new-billing`: Bill subscriptions and allocate tokens

#### Payout Management
- Enhanced fee breakdown in all payout responses
- Transparent fee calculation and display

### Database Schema

#### Pending Token Allocations
```typescript
interface PendingTokenAllocation {
  id: string;
  userId: string; // Allocator
  recipientUserId: string; // Recipient
  resourceType: 'page' | 'group' | 'user_bio' | 'group_about';
  resourceId: string;
  tokens: number;
  month: string; // YYYY-MM
  status: 'pending' | 'finalized' | 'cancelled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  finalizedAt?: Timestamp;
}
```

#### Escrow Accounts
```typescript
interface EscrowAccount {
  id: string;
  stripeAccountId: string;
  type: 'user_funds' | 'platform_revenue';
  balance: number;
  currency: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Escrow Transactions
```typescript
interface EscrowTransaction {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  type: 'subscription_payment' | 'platform_fee' | 'writer_payout' | 'unallocated_tokens';
  stripeTransferId?: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Processing Flow

### Start-of-Month Sequence

1. **Finalize Pending Allocations**
   - Query all pending allocations for previous month
   - Update status to 'finalized'
   - Create writer earnings records
   - Process through existing earnings service

2. **Process Writer Payouts**
   - Calculate earnings with fee deductions
   - Create payout records for eligible writers ($25+ minimum)
   - Execute Stripe transfers from user funds escrow
   - Update balances and transaction records

3. **Bill New Subscriptions**
   - Process active subscription renewals
   - Split payments: user funds vs platform fees
   - Transfer to appropriate escrow accounts
   - Allocate new tokens to users immediately

4. **Enable New Allocations**
   - Users can immediately start allocating new tokens
   - No waiting period or dead zone

### Cron Job Configuration

```bash
# Run on 1st of each month at 9 AM UTC
0 9 1 * * /usr/bin/node /path/to/scripts/process-monthly-payouts.cjs

# Dry run for testing (28th of each month)
0 9 28 * * /usr/bin/node /path/to/scripts/process-monthly-payouts.cjs --dry-run
```

## Benefits

### User Experience
- **No dead zones**: Immediate token allocation after renewal
- **Flexible adjustments**: Change allocations throughout month
- **Predictable timing**: All processing on same day
- **Transparent fees**: Clear breakdown before payout

### Financial Management
- **Clean reporting**: Separate user funds from platform revenue
- **Audit compliance**: Proper fund segregation and tracking
- **Fee transparency**: Clear breakdown of all charges
- **Automated processing**: Reduced manual intervention

### Technical Benefits
- **Simplified scheduling**: Single processing day
- **Better error handling**: Comprehensive retry and rollback
- **Improved monitoring**: Detailed logging and correlation IDs
- **Scalable architecture**: Batch processing with proper limits

## Migration Strategy

### Phase 1: Implementation (Current)
- Deploy new services and components
- Update API endpoints with fee breakdown
- Implement escrow system
- Add UI components for countdown and explanation

### Phase 2: Testing
- Comprehensive end-to-end testing
- Dry run processing validation
- Fee calculation verification
- Escrow fund flow testing

### Phase 3: Rollout
- Enable for payments feature flag users
- Monitor processing performance
- Validate financial reconciliation
- Gather user feedback

### Phase 4: Full Deployment
- Remove feature flag restrictions
- Complete migration from old system
- Archive legacy processing code
- Update all documentation

## Monitoring and Alerts

### Key Metrics
- Processing completion time
- Fee calculation accuracy
- Escrow balance reconciliation
- User allocation patterns
- Payout success rates

### Alert Conditions
- Processing failures or delays
- Escrow balance discrepancies
- Fee calculation errors
- High payout failure rates
- Unusual allocation patterns

## Future Enhancements

### Potential Improvements
- Real-time allocation preview
- Advanced fee optimization
- Multi-currency support
- Enhanced analytics dashboard
- Automated reconciliation reports

### Scalability Considerations
- Batch size optimization
- Parallel processing capabilities
- Database performance tuning
- Caching strategies
- Load balancing for high volume

This implementation provides a robust, user-friendly, and financially compliant system for managing token allocations and payouts in the WeWrite platform.
