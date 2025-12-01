# Payment Flow Testing Guide

This guide provides comprehensive instructions for testing all payment flows in the WeWrite application to prepare for release.

## Overview

The payment flow testing suite covers all aspects of the token-based payment system:

- **Subscription Management**: Setup, activation, cancellation, and billing cycles
- **Token Economy**: Purchasing, allocation, and balance management
- **Token States**: Unfunded (logged-out, no subscription, over-budget) and funded (pending, locked)
- **Earnings System**: Writer earnings tracking, dashboard, and calculations
- **Payout Processing**: Requests, fee calculations, bank transfers, and status tracking
- **Integration**: End-to-end flows and cross-service communication

## ✅ Recent Updates

**Payment Feature Flags Removed** (2025-01-24): All payment functionality is now always enabled. No feature flags control payment access.

**Theme Switching Optimized** (2025-01-24): Stripe Elements and payment forms now switch themes instantly in dark mode.

## Quick Start

### Run All Payment Flow Tests

```bash
npm run test:payment-flows
```

This will execute all test suites in the correct dependency order and provide a comprehensive report.

### List Available Test Suites

```bash
npm run test:payment-flows:list
```

### Run Specific Test Suites

```bash
# Subscription flow testing
npm run test:payment-flows:subscription

# Token allocation testing
npm run test:payment-flows:tokens

# Earnings dashboard testing
npm run test:payment-flows:earnings

# Payout system testing
npm run test:payment-flows:payouts

# End-to-end integration testing
npm run test:payment-flows:e2e
```

## Test Suites

### 1. Payment Flow Setup
**File**: `app/tests/setup/paymentFlowTestSetup.ts`
**Purpose**: Test environment setup and utilities
**Coverage**:
- Mock services and data
- User state simulation
- Test utilities and helpers

### 2. Subscription Flow
**File**: `app/tests/subscriptionFlow.test.ts`
**Purpose**: Subscription creation, activation, and management
**Coverage**:
- Subscription creation via Stripe Checkout
- Subscription activation and token allocation
- Subscription state changes (active, cancelled, failed)
- Billing cycle processing
- Token balance updates
- Upgrade/downgrade proration (upgrade charges only prorated delta; downgrade defers to next cycle without refund)
- Funding gate: allocations only on `invoice.payment_succeeded`; allocations cleared on `invoice.payment_failed` and restored on recovery

### 3. Token Allocation
**File**: `app/tests/tokenAllocation.test.ts`
**Purpose**: Token purchasing, allocation, and validation
**Coverage**:
- Token allocation validation and limits
- Composition bar functionality
- Plus/minus button interactions
- Custom token input handling
- Allocation persistence and updates

### 4. Unfunded Token States
**File**: `app/tests/unfundedTokenStates.test.ts`
**Purpose**: Testing all unfunded token states
**Coverage**:
- Logged-out users (simulated tokens in localStorage)
- Users without subscription (simulated tokens)
- Over-budget allocations (exceeding subscription limits)
- Warning messages and UI indicators
- Token conversion when users activate subscriptions

### 5. Funded Token States
**File**: `app/tests/fundedTokenStates.test.ts`
**Purpose**: Testing funded token states and earnings tracking
**Coverage**:
- Pending amounts (current month allocations)
- Locked amounts (previous month allocations)
- Month-end processing and state transitions
- Earnings calculations and tracking
- Writer earnings dashboard updates

### 6. Earnings Dashboard
**File**: `app/tests/earningsDashboard.test.ts`
**Purpose**: Writer earnings dashboard functionality
**Coverage**:
- Display of all token states
- Earnings history and charts
- Balance calculations and breakdowns
- Real-time updates and refresh functionality
- Payout request integration

### 7. Payout System
**File**: `app/tests/payoutSystem.test.ts`
**Purpose**: Payout requests, validation, and processing
**Coverage**:
- Payout request validation (minimum threshold, balance, verification)
- Fee calculations and breakdowns
- Bank transfer processing via Stripe Connect
- Payout status tracking and updates
- Error handling and recovery

### 8. Fee Breakdown & Bank Transfer
**File**: `app/tests/feeBreakdownBankTransfer.test.ts`
**Purpose**: Fee calculations and Stripe Connect integration
**Coverage**:
- Comprehensive fee breakdown display
- Different currencies and regions
- Standard vs instant payout fees
- Stripe Connect account management
- Bank transfer simulation and processing
- International payment support

### 9. End-to-End Integration
**File**: `app/tests/endToEndPaymentFlow.test.ts`
**Purpose**: Complete payment flows and integration testing
**Coverage**:
- Full user journey from signup to payout
- Month-end processing integration
- Cross-service integration and data consistency
- Error recovery and rollback scenarios
- Performance and scalability testing

## Test Scenarios

### User States Tested

1. **Logged-Out Users**
   - Can allocate simulated tokens
   - Tokens persist in localStorage
   - Warning messages displayed
   - Conversion to real tokens on signup

2. **Users Without Subscription**
   - Can allocate simulated tokens
   - Subscription prompts displayed
   - Token conversion on subscription activation

3. **Active Subscribers**
   - Can allocate real tokens
   - Token balance management
   - Composition bar functionality

4. **Over-Budget Users**
   - Cannot allocate more tokens
   - Warning messages and upgrade prompts
   - Can reduce existing allocations

5. **Writers/Content Creators**
   - Receive token allocations as earnings
   - Track earnings in dashboard
   - Request payouts when threshold met

### Token States Tested

1. **Unfunded States**
   - `unfunded_logged_out`: Tokens from logged-out users
   - `unfunded_no_subscription`: Tokens from users without subscription
   - `unfunded_over_budget`: Tokens exceeding subscription limits

2. **Funded States**
   - `funded_pending`: Current month allocations
   - `funded_locked`: Previous month allocations ready for payout

### Payment Flows Tested

1. **Subscription Flow**
   - Stripe Checkout session creation
   - Webhook processing for successful payments
   - Token allocation to user accounts
   - Subscription state management

2. **Token Allocation Flow**
   - User selects tokens to allocate
   - Validation against available balance
   - Real-time UI updates
   - Writer earnings updates

3. **Month-End Processing**
   - Pending tokens become locked
   - Writer earnings calculations
   - Balance updates
   - New billing cycle initiation

4. **Payout Flow**
   - Writer requests payout
   - Fee calculation and display
   - Stripe Connect transfer
   - Status tracking and notifications

## Environment Setup

### Prerequisites

1. **Node.js and npm** installed
2. **Jest** testing framework
3. **TypeScript** support
4. **Mock services** for Stripe, Firebase, etc.

### Environment Variables

Set these environment variables for testing:

```bash
NODE_ENV=test
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=test-project
```

### Test Data

The test suite uses predefined test data including:
- Test users with different subscription states
- Test pages for token allocation
- Mock Stripe responses
- Simulated token allocations

## Running Tests

### Development Testing

```bash
# Run all payment flow tests
npm run test:payment-flows

# Run specific test suite
npm run test:payment-flows:subscription

# List all available test suites
npm run test:payment-flows:list
```

### CI/CD Integration

Add to your CI/CD pipeline:

```yaml
- name: Run Payment Flow Tests
  run: npm run test:payment-flows
  env:
    NODE_ENV: test
    STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
    STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_TEST_WEBHOOK_SECRET }}
```

### Production Readiness Testing

Before release, ensure all tests pass:

```bash
# Run comprehensive test suite
npm run test:payment-flows

# Check test coverage
npm run test:coverage

# Run performance tests
npm run test:flows:performance
```

## Interpreting Results

### Success Indicators

- ✅ All test suites pass
- ✅ No critical errors in logs
- ✅ Performance metrics within acceptable ranges
- ✅ Error handling scenarios work correctly

### Common Issues

1. **Mock Service Failures**
   - Check mock configurations
   - Verify test data setup
   - Review service dependencies

2. **Timing Issues**
   - Increase test timeouts if needed
   - Check for race conditions
   - Verify async/await usage

3. **Data Consistency**
   - Ensure test data is properly reset
   - Check cross-service communication
   - Verify transaction rollbacks

## Troubleshooting

### Debug Individual Tests

```bash
# Run with verbose output
npx jest app/tests/subscriptionFlow.test.ts --verbose

# Run specific test case
npx jest app/tests/subscriptionFlow.test.ts -t "should create basic subscription"

# Run with debugging
npx jest app/tests/subscriptionFlow.test.ts --detectOpenHandles --forceExit
```

### Common Solutions

1. **Test Timeouts**: Increase timeout in jest.config.js
2. **Mock Issues**: Check mock implementations in test setup
3. **Environment Issues**: Verify all required environment variables
4. **Database Issues**: Ensure test database is properly configured

## Best Practices

1. **Run tests frequently** during development
2. **Test edge cases** and error scenarios
3. **Verify cross-service integration** points
4. **Monitor performance** metrics
5. **Keep test data** up to date with production scenarios

## Support

For issues with payment flow testing:

1. Check the test output for specific error messages
2. Review the test setup and mock configurations
3. Verify environment variables and dependencies
4. Run individual test suites to isolate issues
5. Check the payment system documentation for API changes

## Release Checklist

Before releasing payment features:

- [ ] All payment flow tests pass
- [ ] Performance tests meet requirements
- [ ] Error handling scenarios tested
- [ ] Security tests pass
- [ ] Integration tests with external services work
- [ ] User acceptance testing completed
- [ ] Documentation updated
- [ ] Monitoring and alerting configured
