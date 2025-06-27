# WeWrite Token-Based Writer Payout System

## Overview

The WeWrite Token-Based Writer Payout System enables content creators to earn money from token allocations made by subscribers. This system is completely hidden behind the payments feature flag and provides a comprehensive earnings tracking and payout management solution.

## System Architecture

### Token Economy Flow

1. **Subscribers Purchase Tokens**: $10/month = 100 tokens
2. **Token Allocation**: Subscribers allocate tokens to writers' pages/content
3. **Monthly Processing**: At month end, pending tokens become available for payout
4. **Payout Requests**: Writers can request payouts of available funds ($25 minimum)
5. **Bank Transfer**: Funds transferred via Stripe Connect

### Token States

- **Pending**: Current month tokens (not yet available for payout)
- **Available**: Previous months' tokens (ready for payout)
- **Paid Out**: Tokens that have been converted to USD and paid out

## Implementation Details

### Database Schema

#### WriterTokenEarnings Collection
```typescript
interface WriterTokenEarnings {
  id: string; // {userId}_{month}
  userId: string; // Writer/recipient
  month: string; // YYYY-MM format
  totalTokensReceived: number;
  totalUsdValue: number; // Tokens / 10
  status: 'pending' | 'available' | 'paid_out';
  allocations: Array<{
    allocationId: string;
    fromUserId: string;
    fromUsername?: string;
    resourceType: 'page' | 'group';
    resourceId: string;
    resourceTitle?: string;
    tokens: number;
    usdValue: number;
  }>;
  processedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### WriterTokenBalance Collection
```typescript
interface WriterTokenBalance {
  userId: string;
  totalTokensEarned: number;
  totalUsdEarned: number;
  pendingTokens: number; // Current month
  pendingUsdValue: number;
  availableTokens: number; // Previous months
  availableUsdValue: number;
  paidOutTokens: number;
  paidOutUsdValue: number;
  lastProcessedMonth: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### TokenPayout Collection
```typescript
interface TokenPayout {
  id: string;
  userId: string; // Writer requesting payout
  amount: number; // USD amount
  tokens: number; // Number of tokens
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripePayoutId?: string;
  stripeTransferId?: string;
  earningsIds: string[]; // References to WriterTokenEarnings
  requestedAt: Timestamp;
  processedAt?: Timestamp;
  completedAt?: Timestamp;
  failureReason?: string;
  minimumThresholdMet: boolean;
}
```

### Key Services

#### TokenEarningsService
- `getWriterTokenBalance(userId)`: Get writer's complete balance
- `getWriterEarningsForMonth(userId, month)`: Get earnings for specific month
- `getWriterEarningsHistory(userId, limit)`: Get earnings history
- `processTokenAllocation(allocation)`: Process new token allocation
- `updateWriterBalance(userId)`: Recalculate writer's balance
- `processMonthlyDistribution(month)`: Move pending to available
- `requestPayout(userId, amount?)`: Request payout
- `getPayoutHistory(userId, limit)`: Get payout history

#### WriterTokenDashboard Component
- Real-time earnings display
- Pending vs available balance breakdown
- Monthly earnings history
- Payout request functionality
- Payout history tracking

### API Endpoints

#### GET /api/tokens/earnings
- Get writer's complete earnings data
- Query params: `month` (optional), `limit` (optional)
- Returns: balance, earnings history, payout history

#### POST /api/tokens/earnings
- Request payout for available tokens
- Body: `{ action: 'request_payout', amount?: number }`
- Returns: payout ID and status

#### POST /api/tokens/process-writer-earnings
- Monthly processing endpoint (cron job)
- Protected by API key
- Moves pending tokens to available status

### Start-of-Month Processing Schedule

#### 1st of Month (Automated - All Steps Together)
1. **Finalize Token Allocations**: Convert pending allocations to writer earnings
2. **Process Writer Payouts**: Enable writers to request payouts
3. **Bill New Subscriptions**: Renew subscriptions and allocate new tokens
4. **Enable New Allocations**: Users can immediately start allocating new tokens

**Key Benefits:**
- **No dead zones**: Users can allocate tokens immediately after renewal
- **Predictable timing**: Everything happens on the same day each month
- **Flexible adjustments**: Users can change allocations throughout the month
- **Clean accounting**: Clear monthly cycles for all users

#### Processing Steps
1. Query all `WriterTokenEarnings` with status 'pending' for target month
2. Update status to 'available' and set `processedAt`
3. Recalculate all affected `WriterTokenBalance` records
4. Send notifications to writers with available funds

### Feature Flag Integration

All writer earnings functionality is hidden behind the `payments` feature flag:

```typescript
const paymentsEnabled = useFeatureFlag('payments', user?.email);

// Only show when payments enabled
{paymentsEnabled && (
  <WriterEarningsFeatureGuard>
    <WriterTokenDashboard />
  </WriterEarningsFeatureGuard>
)}
```

### Integration Points

#### Token Allocation Integration
- When users allocate tokens via `TokenService.allocateTokens()`
- Automatically calls `TokenEarningsService.processTokenAllocation()`
- Creates/updates monthly earnings records for recipients

#### Settings Page Integration
- Writer Token Dashboard added to settings page
- Positioned between subscription and payouts sections
- Only visible when payments feature flag is enabled

#### Real-time Updates
- Dashboard uses real-time data fetching
- Automatic refresh when earnings change
- Live balance updates

## User Experience

### Writer Dashboard Features

1. **Balance Overview**
   - Available balance (green) - ready for payout
   - Pending balance (yellow) - current month tokens
   - Total earned (blue) - lifetime earnings
   - Paid out (gray) - historical payouts

2. **Monthly Earnings Tab**
   - Earnings by month with status badges
   - Token count and USD value
   - Number of allocations received

3. **Payout History Tab**
   - Past payout requests and status
   - Processing dates and amounts
   - Failure reasons if applicable

4. **Payout Request**
   - $25 minimum threshold
   - One-click payout request
   - Real-time status updates

### Error Handling

- Graceful fallback when no earnings exist
- Clear error messages for failed operations
- Loading states during data fetching
- Minimum threshold warnings

## Security & Validation

- All endpoints require authentication
- User can only access their own earnings data
- Payout requests validated against available balance
- Minimum threshold enforcement
- API key protection for cron endpoints

## Testing

### Manual Testing
1. Enable payments feature flag
2. Create token allocations to test user
3. Verify earnings appear in dashboard
4. Test monthly processing (simulate month end)
5. Verify pending tokens become available
6. Test payout request functionality

### Automated Testing
- Unit tests for TokenEarningsService methods
- Integration tests for API endpoints
- End-to-end tests for dashboard functionality

## Deployment Considerations

1. **Database Indexes**: Ensure proper indexes on earnings queries
2. **Cron Jobs**: Set up monthly processing automation
3. **Monitoring**: Track earnings processing and payout success rates
4. **Backup**: Regular backups of earnings and payout data
5. **Feature Flag**: Coordinate feature flag enablement with stakeholders

## Future Enhancements

1. **Analytics**: Detailed earnings analytics and trends
2. **Notifications**: Email/push notifications for earnings milestones
3. **Tax Reporting**: Generate tax documents for writers
4. **Multi-currency**: Support for international payouts
5. **Instant Payouts**: Faster payout processing options
