# Enhanced Payment Error Messaging

This document describes the comprehensive payment error messaging system implemented to provide detailed, user-friendly explanations for card declines and payment failures.

## Overview

The enhanced payment error messaging system provides:

- **Detailed Error Analysis**: Parses Stripe error codes and decline reasons to provide specific explanations
- **User-Friendly Messages**: Converts technical error codes into clear, actionable language
- **Actionable Steps**: Provides specific steps users can take to resolve payment issues
- **Severity Classification**: Categorizes errors by severity (low, medium, high, critical)
- **Retry Intelligence**: Indicates whether errors are retryable and provides appropriate guidance
- **Technical Details**: Optional detailed technical information for debugging

## Key Components

### 1. Stripe Error Message Utility (`app/utils/stripeErrorMessages.ts`)

The core utility that parses and enhances Stripe error messages:

```typescript
// Parse any Stripe error and get detailed information
const detailedError = parseStripeError(stripeError);

// Format for UI display
const displayInfo = formatStripeErrorForDisplay(stripeError);

// Create detailed log for debugging
const errorLog = createDetailedErrorLog(stripeError, context);
```

#### Supported Error Types

- **Card Declined Errors**: `generic_decline`, `insufficient_funds`, `card_not_supported`, etc.
- **Authentication Errors**: `incorrect_cvc`, `fraudulent`, `security_violation`
- **Card Status Errors**: `expired_card`, `lost_card`, `stolen_card`, `restricted_card`
- **Processing Errors**: `processing_error`, `try_again_later`, `card_velocity_exceeded`
- **API Errors**: `api_error`, `rate_limit_error`, `authentication_required`

### 2. Payment Error Display Component (`app/components/payments/PaymentErrorDisplay.tsx`)

A comprehensive UI component for displaying payment errors:

```typescript
<PaymentErrorDisplay
  error={stripeError}
  onRetry={handleRetry}
  showRetry={true}
  showTechnicalDetails={true}
  context={{ userId, amount, subscriptionId }}
/>
```

#### Features

- **Severity-based styling**: Visual indicators based on error severity
- **Actionable steps**: Clear list of actions users can take
- **Retry functionality**: Built-in retry button for retryable errors
- **Technical details**: Collapsible section with detailed error information
- **Copy functionality**: Easy copying of error details for support
- **Compact mode**: Simplified display for space-constrained areas

### 3. Enhanced Payment Processing

#### Checkout Flow (`app/components/payments/checkout-steps/PaymentStep.tsx`)

The payment step now captures and displays detailed error information:

- Parses Stripe errors during payment processing
- Shows specific decline reasons and actionable steps
- Provides retry guidance based on error type
- Logs detailed error information for debugging

#### Webhook Processing (`app/api/webhooks/stripe-subscription/route.ts`)

Enhanced webhook handling for failed payments:

- Extracts detailed failure information from Stripe webhooks
- Parses error codes and decline reasons
- Logs comprehensive error details
- Records failure information for retry scheduling

#### Payment Retry API (`app/api/subscription/retry-payment/route.ts`)

New API endpoint for manual payment retries:

- Attempts to retry failed subscription payments
- Provides detailed error information on retry failures
- Integrates with payment recovery service
- Returns actionable error messages

## Error Categories and Handling

### Card Declined Errors

**Examples**: `generic_decline`, `insufficient_funds`, `card_not_supported`

**User Experience**:
- Clear explanation of why the card was declined
- Specific steps to resolve the issue
- Alternative payment method suggestions
- Bank contact information when appropriate

### Authentication Errors

**Examples**: `incorrect_cvc`, `fraudulent`, `security_violation`

**User Experience**:
- Explanation of authentication requirements
- Steps to complete verification
- Guidance on contacting bank for fraud issues
- Clear instructions for re-entering information

### Card Status Errors

**Examples**: `expired_card`, `lost_card`, `stolen_card`

**User Experience**:
- Clear indication of card status issue
- Instructions to use different payment method
- Guidance on obtaining replacement cards
- Security-focused messaging for lost/stolen cards

### Processing Errors

**Examples**: `processing_error`, `try_again_later`

**User Experience**:
- Explanation of temporary processing issues
- Specific wait times before retrying
- Alternative payment method suggestions
- System status information when available

## Implementation Examples

### Basic Error Parsing

```typescript
import { parseStripeError } from '../utils/stripeErrorMessages';

try {
  // Stripe payment processing
  const result = await stripe.confirmPayment(/* ... */);
} catch (error) {
  const detailedError = parseStripeError(error);
  
  console.log('User message:', detailedError.userMessage);
  console.log('Actionable steps:', detailedError.actionableSteps);
  console.log('Retryable:', detailedError.retryable);
}
```

### UI Error Display

```typescript
import { PaymentErrorDisplay } from '../components/payments/PaymentErrorDisplay';

function CheckoutForm() {
  const [paymentError, setPaymentError] = useState(null);
  
  return (
    <div>
      {/* Payment form */}
      
      {paymentError && (
        <PaymentErrorDisplay
          error={paymentError}
          onRetry={() => setPaymentError(null)}
          showRetry={true}
          context={{ amount: 29.99, tier: 'premium' }}
        />
      )}
    </div>
  );
}
```

### Webhook Error Handling

```typescript
import { parseStripeError, createDetailedErrorLog } from '../utils/stripeErrorMessages';

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const rawError = invoice.last_finalization_error || 
                   invoice.charge?.failure_message ||
                   { message: 'Payment failed - reason unknown' };
  
  const detailedError = parseStripeError(rawError);
  
  // Log detailed error information
  console.log('Payment failed:', createDetailedErrorLog(rawError, {
    invoiceId: invoice.id,
    userId: subscription.metadata.firebaseUID,
    amount: invoice.amount_due / 100
  }));
  
  // Use user-friendly message for notifications
  await createFailedPaymentNotification(userId, detailedError.userMessage);
}
```

## Benefits

### For Users

- **Clear Understanding**: Users know exactly why their payment failed
- **Actionable Guidance**: Specific steps to resolve payment issues
- **Reduced Frustration**: Less confusion and support requests
- **Faster Resolution**: Direct guidance leads to quicker problem solving

### For Support Teams

- **Detailed Logs**: Comprehensive error information for debugging
- **Reduced Tickets**: Users can self-resolve many issues
- **Better Context**: Clear error categorization and severity levels
- **Improved Metrics**: Better tracking of payment failure types

### For Development

- **Consistent Handling**: Standardized error processing across the application
- **Easy Integration**: Simple API for adding enhanced error handling
- **Comprehensive Coverage**: Handles all major Stripe error types
- **Extensible Design**: Easy to add new error types and handling

## Testing

The system includes comprehensive tests (`app/utils/__tests__/stripeErrorMessages.test.ts`) covering:

- All major Stripe error types
- Edge cases and error patterns
- UI formatting functions
- Logging functionality

## Future Enhancements

- **Localization**: Multi-language error messages
- **Smart Retry**: Automatic retry scheduling based on error type
- **Analytics Integration**: Error tracking and reporting
- **Machine Learning**: Predictive error prevention
- **Custom Error Pages**: Dedicated pages for specific error types
