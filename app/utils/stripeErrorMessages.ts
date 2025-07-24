/**
 * Stripe Error Message Utility
 * Provides detailed, user-friendly error messages for Stripe payment failures
 */

export interface DetailedStripeError {
  userMessage: string;
  technicalMessage: string;
  actionableSteps: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'card_declined' | 'insufficient_funds' | 'expired_card' | 'authentication' | 'processing' | 'network' | 'other';
  retryable: boolean;
}

/**
 * Maps Stripe decline codes to detailed user-friendly messages
 */
const DECLINE_CODE_MESSAGES: Record<string, DetailedStripeError> = {
  // Card declined codes
  'generic_decline': {
    userMessage: 'Your card was declined by your bank. This is often a temporary issue.',
    technicalMessage: 'Generic decline - no specific reason provided by issuer',
    actionableSteps: [
      'Try a different payment method',
      'Contact your bank to ensure the card is active',
      'Verify your billing information is correct',
      'Try again in a few minutes'
    ],
    severity: 'medium',
    category: 'card_declined',
    retryable: true
  },
  
  'insufficient_funds': {
    userMessage: 'Your card was declined due to insufficient funds in your account.',
    technicalMessage: 'Insufficient funds available on the payment method',
    actionableSteps: [
      'Add funds to your account',
      'Use a different payment method',
      'Contact your bank to verify available balance'
    ],
    severity: 'medium',
    category: 'insufficient_funds',
    retryable: true
  },
  
  'card_not_supported': {
    userMessage: 'This type of card is not supported for this transaction.',
    technicalMessage: 'Card type not supported by merchant or processor',
    actionableSteps: [
      'Try a different credit or debit card',
      'Use a Visa, Mastercard, or American Express card',
      'Contact support if you continue having issues'
    ],
    severity: 'medium',
    category: 'card_declined',
    retryable: false
  },
  
  'expired_card': {
    userMessage: 'Your card has expired. Please use a different payment method.',
    technicalMessage: 'Payment method has passed its expiration date',
    actionableSteps: [
      'Update your card information with a current expiration date',
      'Use a different, non-expired payment method',
      'Contact your bank for a replacement card'
    ],
    severity: 'medium',
    category: 'expired_card',
    retryable: false
  },
  
  'incorrect_cvc': {
    userMessage: 'The security code (CVC) you entered is incorrect.',
    technicalMessage: 'Card verification code does not match',
    actionableSteps: [
      'Check the 3-digit code on the back of your card (4 digits for Amex)',
      'Re-enter the security code carefully',
      'Try a different payment method if the issue persists'
    ],
    severity: 'low',
    category: 'authentication',
    retryable: true
  },
  
  'processing_error': {
    userMessage: 'A temporary processing error occurred. Please try again.',
    technicalMessage: 'Payment processor encountered an error',
    actionableSteps: [
      'Wait a few minutes and try again',
      'Try a different payment method',
      'Contact support if the problem continues'
    ],
    severity: 'medium',
    category: 'processing',
    retryable: true
  },
  
  'card_velocity_exceeded': {
    userMessage: 'You\'ve exceeded the number of allowed transactions for this card today.',
    technicalMessage: 'Card velocity limits exceeded',
    actionableSteps: [
      'Wait 24 hours before trying this card again',
      'Use a different payment method',
      'Contact your bank to discuss transaction limits'
    ],
    severity: 'medium',
    category: 'card_declined',
    retryable: true
  },
  
  'fraudulent': {
    userMessage: 'This transaction was flagged as potentially fraudulent by your bank.',
    technicalMessage: 'Transaction blocked due to fraud detection',
    actionableSteps: [
      'Contact your bank to verify the transaction',
      'Confirm your identity with your bank',
      'Try again after speaking with your bank',
      'Use a different payment method'
    ],
    severity: 'high',
    category: 'authentication',
    retryable: true
  },
  
  'lost_card': {
    userMessage: 'This card has been reported as lost. Please use a different payment method.',
    technicalMessage: 'Card reported as lost by cardholder',
    actionableSteps: [
      'Use a different, active payment method',
      'Contact your bank for a replacement card',
      'Update your payment information'
    ],
    severity: 'high',
    category: 'card_declined',
    retryable: false
  },
  
  'stolen_card': {
    userMessage: 'This card has been reported as stolen. Please use a different payment method.',
    technicalMessage: 'Card reported as stolen by cardholder',
    actionableSteps: [
      'Use a different, active payment method',
      'Contact your bank immediately if this is unexpected',
      'Update your payment information'
    ],
    severity: 'critical',
    category: 'card_declined',
    retryable: false
  },
  
  'pickup_card': {
    userMessage: 'Your bank has requested that this card be retained. Please contact your bank.',
    technicalMessage: 'Issuer requests card pickup',
    actionableSteps: [
      'Contact your bank immediately',
      'Use a different payment method',
      'Verify your account status with your bank'
    ],
    severity: 'critical',
    category: 'card_declined',
    retryable: false
  },
  
  'restricted_card': {
    userMessage: 'Your card has restrictions that prevent this transaction.',
    technicalMessage: 'Card has usage restrictions',
    actionableSteps: [
      'Contact your bank to understand the restrictions',
      'Use a different payment method',
      'Ask your bank to remove restrictions if appropriate'
    ],
    severity: 'medium',
    category: 'card_declined',
    retryable: true
  },
  
  'security_violation': {
    userMessage: 'This transaction violates your card\'s security policies.',
    technicalMessage: 'Security violation detected',
    actionableSteps: [
      'Contact your bank to verify the transaction',
      'Confirm your identity with your bank',
      'Use a different payment method'
    ],
    severity: 'high',
    category: 'authentication',
    retryable: true
  },
  
  'service_not_allowed': {
    userMessage: 'Your card doesn\'t support this type of transaction.',
    technicalMessage: 'Service not allowed for this card type',
    actionableSteps: [
      'Use a different payment method',
      'Contact your bank about transaction capabilities',
      'Try a different type of card (credit vs debit)'
    ],
    severity: 'medium',
    category: 'card_declined',
    retryable: false
  },
  
  'transaction_not_allowed': {
    userMessage: 'This transaction is not allowed on your card.',
    technicalMessage: 'Transaction type not permitted',
    actionableSteps: [
      'Contact your bank to understand restrictions',
      'Use a different payment method',
      'Verify your card supports online transactions'
    ],
    severity: 'medium',
    category: 'card_declined',
    retryable: true
  },
  
  'try_again_later': {
    userMessage: 'Your bank is temporarily unable to process this transaction. Please try again later.',
    technicalMessage: 'Temporary processing issue at issuer',
    actionableSteps: [
      'Wait 15-30 minutes and try again',
      'Use a different payment method',
      'Contact your bank if the issue persists'
    ],
    severity: 'low',
    category: 'processing',
    retryable: true
  }
};

/**
 * Default error message for unknown decline codes
 */
const DEFAULT_DECLINE_ERROR: DetailedStripeError = {
  userMessage: 'Your payment was declined. Please try a different payment method or contact your bank.',
  technicalMessage: 'Unknown decline code',
  actionableSteps: [
    'Try a different payment method',
    'Contact your bank for more information',
    'Verify your card information is correct',
    'Contact support if you continue having issues'
  ],
  severity: 'medium',
  category: 'other',
  retryable: true
};

/**
 * Parse Stripe error and return detailed user-friendly information
 */
export function parseStripeError(error: any): DetailedStripeError {
  // Handle Stripe-specific error properties
  if (error?.decline_code) {
    const detailedError = DECLINE_CODE_MESSAGES[error.decline_code];
    if (detailedError) {
      return {
        ...detailedError,
        technicalMessage: `${detailedError.technicalMessage} (Code: ${error.decline_code})`
      };
    }
  }
  
  // Handle common Stripe error types
  if (error?.type) {
    switch (error.type) {
      case 'card_error':
        if (error.code) {
          const detailedError = DECLINE_CODE_MESSAGES[error.code];
          if (detailedError) {
            return {
              ...detailedError,
              technicalMessage: `${detailedError.technicalMessage} (Type: ${error.type}, Code: ${error.code})`
            };
          }
        }
        return {
          userMessage: error.message || 'Your card was declined. Please try a different payment method.',
          technicalMessage: `Card error: ${error.message || 'Unknown card error'} (Type: ${error.type})`,
          actionableSteps: [
            'Try a different payment method',
            'Verify your card information is correct',
            'Contact your bank for assistance'
          ],
          severity: 'medium',
          category: 'card_declined',
          retryable: true
        };
        
      case 'authentication_required':
        return {
          userMessage: 'Additional authentication is required for this payment. Please complete the verification process.',
          technicalMessage: `Authentication required: ${error.message || 'Additional verification needed'}`,
          actionableSteps: [
            'Complete the authentication process with your bank',
            'Check for text messages or app notifications from your bank',
            'Try the payment again after authentication'
          ],
          severity: 'medium',
          category: 'authentication',
          retryable: true
        };
        
      case 'api_error':
        return {
          userMessage: 'A temporary system error occurred. Please try again in a few minutes.',
          technicalMessage: `API error: ${error.message || 'Unknown API error'}`,
          actionableSteps: [
            'Wait a few minutes and try again',
            'Contact support if the problem persists'
          ],
          severity: 'medium',
          category: 'processing',
          retryable: true
        };
        
      case 'rate_limit_error':
        return {
          userMessage: 'Too many requests have been made. Please wait a moment and try again.',
          technicalMessage: `Rate limit exceeded: ${error.message || 'Too many requests'}`,
          actionableSteps: [
            'Wait a few minutes before trying again',
            'Contact support if you continue having issues'
          ],
          severity: 'low',
          category: 'processing',
          retryable: true
        };
    }
  }
  
  // Handle generic error messages
  const message = error?.message || error?.toString() || 'Unknown error';
  
  // Check for common error patterns in the message
  if (message.toLowerCase().includes('insufficient funds')) {
    return DECLINE_CODE_MESSAGES['insufficient_funds'];
  }
  
  if (message.toLowerCase().includes('expired')) {
    return DECLINE_CODE_MESSAGES['expired_card'];
  }
  
  if (message.toLowerCase().includes('declined')) {
    return DECLINE_CODE_MESSAGES['generic_decline'];
  }
  
  if (message.toLowerCase().includes('cvc') || message.toLowerCase().includes('security code')) {
    return DECLINE_CODE_MESSAGES['incorrect_cvc'];
  }
  
  // Return default error with original message
  return {
    ...DEFAULT_DECLINE_ERROR,
    technicalMessage: `${DEFAULT_DECLINE_ERROR.technicalMessage}: ${message}`
  };
}

/**
 * Format error for display in UI components
 */
export function formatStripeErrorForDisplay(error: any): {
  title: string;
  message: string;
  steps: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
} {
  const detailedError = parseStripeError(error);

  return {
    title: getErrorTitle(detailedError.category, detailedError.severity),
    message: detailedError.userMessage,
    steps: detailedError.actionableSteps,
    severity: detailedError.severity,
    retryable: detailedError.retryable
  };
}

/**
 * Get appropriate error title based on category and severity
 */
function getErrorTitle(category: string, severity: string): string {
  if (severity === 'critical') {
    return 'Payment Blocked';
  }

  switch (category) {
    case 'card_declined':
      return 'Card Declined';
    case 'insufficient_funds':
      return 'Insufficient Funds';
    case 'expired_card':
      return 'Card Expired';
    case 'authentication':
      return 'Authentication Required';
    case 'processing':
      return 'Processing Error';
    case 'network':
      return 'Connection Error';
    default:
      return 'Payment Failed';
  }
}

/**
 * Create a detailed error message for logging purposes
 */
export function createDetailedErrorLog(error: any, context?: Record<string, any>): string {
  const detailedError = parseStripeError(error);

  const logData = {
    timestamp: new Date().toISOString(),
    userMessage: detailedError.userMessage,
    technicalMessage: detailedError.technicalMessage,
    category: detailedError.category,
    severity: detailedError.severity,
    retryable: detailedError.retryable,
    originalError: {
      message: error?.message,
      type: error?.type,
      code: error?.code,
      decline_code: error?.decline_code,
      param: error?.param
    },
    context: context || {}
  };

  return JSON.stringify(logData, null, 2);
}
