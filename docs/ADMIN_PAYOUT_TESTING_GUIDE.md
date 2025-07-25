# Admin Payout Testing Guide

## Quick Start

### Access the Testing Interface

1. **Navigate to Admin Dashboard**: `/admin/dashboard`
2. **Locate Testing Tools**: Scroll to "Testing Tools" section
3. **Use PayoutFlowValidator**: Primary testing interface for payout validation

### Immediate Testing Steps

```bash
# 1. Open admin dashboard
http://localhost:3000/admin/dashboard

# 2. Configure test amount in PayoutFlowValidator
# Default: $100, Range: $1-$1000

# 3. Click "Validate Payout Flow"
# System runs comprehensive validation automatically

# 4. Review results in real-time
# Success/failure status for each component
```

## PayoutFlowValidator Interface

### Test Configuration

**Test Amount Input**:
- **Range**: $1 - $1000
- **Default**: $100
- **Purpose**: Tests fee calculations at different amounts
- **Validation**: Automatic minimum threshold checking

**Test Execution**:
- **Button**: "Validate Payout Flow"
- **Duration**: 2-5 seconds for complete validation
- **Output**: Real-time results with detailed breakdown

### Validation Steps

The PayoutFlowValidator executes these tests automatically:

1. **Fee Calculation API Test**
   - Validates `/api/payouts/calculate-fees` endpoint
   - Tests with configured amount and standard payout method
   - Verifies API response structure and data accuracy

2. **Mathematical Validation**
   - Confirms fee calculations are mathematically correct
   - Validates: `gross - (platform_fee + stripe_fee + tax) = net`
   - Ensures precision within 0.01 currency units

3. **Earnings API Test**
   - Validates `/api/payouts/earnings` endpoint
   - Confirms earnings data retrieval functionality
   - Tests authentication and authorization

4. **Minimum Threshold Validation**
   - Tests with amount below $25 minimum
   - Confirms proper error handling
   - Validates threshold enforcement logic

5. **Payout Method Comparison**
   - Tests both standard and instant payout fees
   - Confirms instant payouts charge higher fees
   - Validates fee structure differences

### Fee Breakdown Display

**Components Shown**:
- **Gross Earnings**: Total token value
- **WeWrite Platform Fee**: 7% deduction (highlighted in red)
- **Stripe Payout Fee**: Variable based on method
- **Net Payout Amount**: Final transfer amount (highlighted in green)

**Visual Indicators**:
- Green checkmarks for successful validations
- Red X marks for failed tests
- Yellow warnings for unclear results
- Detailed error messages for troubleshooting

## Connected Account Testing

### Embedded Bank Account Setup

**Access**: `/settings/earnings?tab=payouts`

**Test Flow**:
1. **Account Creation**: Stripe Connect embedded onboarding
2. **Bank Connection**: Multiple methods available
3. **Verification**: Real-time status updates
4. **Management**: Account settings and preferences

**Test Scenarios**:
- New account onboarding flow
- Existing account management
- Bank account verification process
- Error handling and recovery

### Financial Connections Testing

**Component**: `TestFinancialConnectionsButton`
**Location**: Available in payout management interfaces

**Features**:
- Stripe Financial Connections integration
- Instant bank account verification
- Real bank account linking (test mode)
- Connection status monitoring

## API Testing Endpoints

### Test Payout Flow API

**Endpoint**: `POST /api/admin/test-payout-flow`

**Request**:
```json
{
  "userEmail": "test@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "overallSuccess": true,
    "steps": [
      {
        "step": "Create Test Earnings",
        "success": true,
        "data": { "amount": 100 }
      },
      {
        "step": "Process Monthly Distribution",
        "success": true,
        "data": { "month": "2024-01" }
      },
      {
        "step": "Request Payout",
        "success": true,
        "data": { "payoutId": "payout_123" }
      }
    ]
  }
}
```

### Fee Calculation API

**Endpoint**: `POST /api/payouts/calculate-fees`

**Request**:
```json
{
  "amount": 100,
  "payoutMethod": "standard"
}
```

**Response**:
```json
{
  "success": true,
  "feeBreakdown": {
    "grossAmount": 100.00,
    "wewritePlatformFee": 7.00,
    "stripePayoutFee": 0.25,
    "netPayoutAmount": 92.75,
    "currency": "USD"
  }
}
```

## Test Data Management

### Creating Test Earnings

**Method 1: Admin API**
```bash
curl -X POST /api/admin/test-payout-flow \
  -H "Content-Type: application/json" \
  -d '{"userEmail": "writer@test.com"}'
```

**Method 2: Admin Dashboard**
- Use "Test Monthly Distribution" button
- Automatically creates earnings for current month
- Processes token allocation to earnings conversion

### Test User Accounts

**Automatic Creation**:
- Test users created automatically during payout flow testing
- Includes realistic earnings balances
- Connected account setup available
- Full payout flow functionality

**Manual Setup**:
- Create user via admin interface
- Add token earnings via monthly distribution
- Set up connected account via embedded components
- Test payout request through PayoutFlowValidator

## Monitoring and Verification

### Real-time Status Monitoring

**Admin Dashboard Widgets**:
- Payout system health status
- Recent transfer activity
- Fee calculation accuracy metrics
- Connected account statistics

**Stripe Dashboard Verification**:
- Monitor test transfers in Stripe Connect dashboard
- Verify transfer amounts match calculated values
- Check transfer timing and status updates
- Review webhook event processing

### Error Handling Testing

**Common Error Scenarios**:
- Insufficient balance for payout
- Unverified connected account
- Below minimum threshold
- Network connectivity issues

**Validation Points**:
- Appropriate error messages displayed
- User-friendly error handling
- Proper fallback mechanisms
- Retry logic functionality

## Best Practices

### Regular Testing Schedule

**Daily**:
- Quick validation using PayoutFlowValidator
- Verify fee calculations remain accurate
- Check connected account setup flow

**Weekly**:
- Complete payout flow testing
- Test error scenarios and edge cases
- Verify Stripe integration functionality

**Monthly**:
- Comprehensive system validation
- Review fee structure accuracy
- Update test data and scenarios

### Troubleshooting Guidelines

**Fee Calculation Issues**:
1. Use PayoutFlowValidator to isolate problem
2. Check fee structure configuration
3. Verify mathematical calculations
4. Review API response data

**Connected Account Problems**:
1. Check Stripe Connect account status
2. Verify embedded component loading
3. Test with different bank accounts
4. Review webhook processing logs

**Transfer Failures**:
1. Monitor Stripe dashboard for errors
2. Check connected account verification status
3. Verify sufficient balance availability
4. Review transfer amount calculations

---

*This guide provides comprehensive instructions for testing WeWrite's payout infrastructure using the built-in admin tools and interfaces.*
