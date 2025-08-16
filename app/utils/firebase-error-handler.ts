/**
 * Enhanced Firebase Error Handler
 * 
 * Provides detailed, actionable error messages for Firebase errors
 * instead of generic "Missing or insufficient permissions" messages.
 */

interface FirebaseError extends Error {
  code?: string;
  details?: any;
  customData?: any;
}

interface EnhancedErrorInfo {
  userMessage: string;
  technicalDetails: string;
  suggestedActions: string[];
  errorCategory: 'permission' | 'network' | 'data' | 'auth' | 'quota' | 'unknown';
  shouldRetry: boolean;
}

/**
 * Enhanced Firebase error handler that provides detailed, actionable error messages
 */
export function enhanceFirebaseError(error: any, context?: string): EnhancedErrorInfo {
  const errorCode = error?.code || 'unknown';
  const errorMessage = error?.message || 'Unknown error';
  const contextInfo = context ? ` (Context: ${context})` : '';

  // Permission-related errors
  if (errorCode === 'permission-denied' || errorMessage.includes('Missing or insufficient permissions')) {
    return analyzePermissionError(error, context);
  }

  // Authentication errors
  if (errorCode.startsWith('auth/')) {
    return analyzeAuthError(error, context);
  }

  // Network and connectivity errors
  if (errorCode === 'unavailable' || errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return analyzeNetworkError(error, context);
  }

  // Data and validation errors
  if (errorCode === 'invalid-argument' || errorCode === 'not-found' || errorCode === 'already-exists') {
    return analyzeDataError(error, context);
  }

  // Quota and rate limiting errors
  if (errorCode === 'resource-exhausted' || errorMessage.includes('quota')) {
    return analyzeQuotaError(error, context);
  }

  // Context-specific fallbacks before generic fallback
  if (context?.includes('Password Reset')) {
    return {
      userMessage: `Password reset failed due to an unexpected error`,
      technicalDetails: `Firebase Error [${errorCode}]: ${errorMessage}${contextInfo}`,
      suggestedActions: [
        'Check that your email address is correct',
        'Try again in a few minutes',
        'Check your spam folder for the reset email',
        'Contact support with the error details if this persists'
      ],
      errorCategory: 'auth',
      shouldRetry: true
    };
  }

  // Generic fallback
  return {
    userMessage: `An unexpected error occurred${contextInfo}`,
    technicalDetails: `Firebase Error [${errorCode}]: ${errorMessage}`,
    suggestedActions: [
      'Try refreshing the page',
      'Check your internet connection',
      'Contact support if the problem persists'
    ],
    errorCategory: 'unknown',
    shouldRetry: true
  };
}

/**
 * Analyze permission-denied errors and provide specific guidance
 */
function analyzePermissionError(error: any, context?: string): EnhancedErrorInfo {
  const contextInfo = context ? ` (Context: ${context})` : '';
  
  // Analyze the context to provide specific guidance
  if (context?.includes('earnings') || context?.includes('token') || context?.includes('payout')) {
    return {
      userMessage: 'You need to be a verified writer to access earnings data',
      technicalDetails: `Permission denied accessing writer earnings${contextInfo}. User may not have writer permissions or may not have any earnings yet.`,
      suggestedActions: [
        'Create and publish some pages to start earning',
        'Verify your account if you haven\'t already',
        'Check if you have any published content'
      ],
      errorCategory: 'permission',
      shouldRetry: false
    };
  }

  if (context?.includes('admin')) {
    return {
      userMessage: 'Admin access required for this operation',
      technicalDetails: `Permission denied for admin operation${contextInfo}. User does not have admin privileges.`,
      suggestedActions: [
        'Contact an administrator for access',
        'Verify you are logged in with the correct account'
      ],
      errorCategory: 'permission',
      shouldRetry: false
    };
  }

  if (context?.includes('page') || context?.includes('content')) {
    return {
      userMessage: 'You don\'t have permission to view this content',
      technicalDetails: `Permission denied accessing page content${contextInfo}. Page may be private or user may not have read access.`,
      suggestedActions: [
        'Check if the page is public',
        'Verify you are logged in',
        'Contact the page owner for access'
      ],
      errorCategory: 'permission',
      shouldRetry: false
    };
  }

  if (context?.includes('write') || context?.includes('update') || context?.includes('create')) {
    return {
      userMessage: 'You don\'t have permission to modify this content',
      technicalDetails: `Permission denied for write operation${contextInfo}. User may not be the owner or may not have write permissions.`,
      suggestedActions: [
        'Verify you are the owner of this content',
        'Check if you are logged in',
        'Contact the content owner for edit access'
      ],
      errorCategory: 'permission',
      shouldRetry: false
    };
  }

  // Generic permission error
  return {
    userMessage: `Access denied${contextInfo}`,
    technicalDetails: `Firebase permission denied${contextInfo}. User lacks required permissions for this operation.`,
    suggestedActions: [
      'Verify you are logged in',
      'Check if you have the required permissions',
      'Contact support if you believe this is an error'
    ],
    errorCategory: 'permission',
    shouldRetry: false
  };
}

/**
 * Analyze authentication errors
 */
function analyzeAuthError(error: any, context?: string): EnhancedErrorInfo {
  const errorCode = error?.code || '';
  const contextInfo = context ? ` (Context: ${context})` : '';

  switch (errorCode) {
    case 'auth/user-not-found':
      return {
        userMessage: 'No account found with this email or username',
        technicalDetails: `Authentication failed: user not found${contextInfo}`,
        suggestedActions: ['Check your email/username spelling', 'Create a new account if needed'],
        errorCategory: 'auth',
        shouldRetry: false
      };

    case 'auth/wrong-password':
      return {
        userMessage: 'Incorrect password',
        technicalDetails: `Authentication failed: wrong password${contextInfo}`,
        suggestedActions: ['Check your password', 'Use the "Forgot Password" option if needed'],
        errorCategory: 'auth',
        shouldRetry: false
      };

    case 'auth/too-many-requests':
      return {
        userMessage: 'Too many failed attempts. Please try again later',
        technicalDetails: `Authentication rate limited${contextInfo}`,
        suggestedActions: ['Wait a few minutes before trying again', 'Use password reset if needed'],
        errorCategory: 'auth',
        shouldRetry: true
      };

    default:
      return {
        userMessage: 'Authentication error occurred',
        technicalDetails: `Auth error [${errorCode}]${contextInfo}: ${error?.message}`,
        suggestedActions: ['Try logging in again', 'Clear browser cache', 'Contact support'],
        errorCategory: 'auth',
        shouldRetry: true
      };
  }
}

/**
 * Analyze network and connectivity errors
 */
function analyzeNetworkError(error: any, context?: string): EnhancedErrorInfo {
  const contextInfo = context ? ` (Context: ${context})` : '';
  
  return {
    userMessage: 'Connection problem occurred',
    technicalDetails: `Network error${contextInfo}: ${error?.message || 'Connection failed'}`,
    suggestedActions: [
      'Check your internet connection',
      'Try refreshing the page',
      'Wait a moment and try again'
    ],
    errorCategory: 'network',
    shouldRetry: true
  };
}

/**
 * Analyze data and validation errors
 */
function analyzeDataError(error: any, context?: string): EnhancedErrorInfo {
  const errorCode = error?.code || '';
  const contextInfo = context ? ` (Context: ${context})` : '';

  switch (errorCode) {
    case 'not-found':
      return {
        userMessage: 'The requested content was not found',
        technicalDetails: `Data not found${contextInfo}`,
        suggestedActions: ['Check if the content still exists', 'Try refreshing the page'],
        errorCategory: 'data',
        shouldRetry: false
      };

    case 'already-exists':
      return {
        userMessage: 'This content already exists',
        technicalDetails: `Duplicate data${contextInfo}`,
        suggestedActions: ['Use a different name or identifier', 'Check existing content'],
        errorCategory: 'data',
        shouldRetry: false
      };

    default:
      return {
        userMessage: 'Data validation error',
        technicalDetails: `Data error [${errorCode}]${contextInfo}: ${error?.message}`,
        suggestedActions: ['Check your input data', 'Try again with different values'],
        errorCategory: 'data',
        shouldRetry: false
      };
  }
}

/**
 * Analyze quota and rate limiting errors
 */
function analyzeQuotaError(error: any, context?: string): EnhancedErrorInfo {
  const contextInfo = context ? ` (Context: ${context})` : '';
  
  return {
    userMessage: 'Service temporarily unavailable due to high usage',
    technicalDetails: `Quota exceeded${contextInfo}: ${error?.message}`,
    suggestedActions: [
      'Wait a few minutes and try again',
      'Try again during off-peak hours',
      'Contact support if this persists'
    ],
    errorCategory: 'quota',
    shouldRetry: true
  };
}

/**
 * Log enhanced error information
 */
export function logEnhancedFirebaseError(error: any, context?: string): void {
  const enhanced = enhanceFirebaseError(error, context);
  
  console.group(`🔥 Enhanced Firebase Error${context ? ` (${context})` : ''}`);
  console.error('User Message:', enhanced.userMessage);
  console.error('Technical Details:', enhanced.technicalDetails);
  console.error('Suggested Actions:', enhanced.suggestedActions);
  console.error('Category:', enhanced.errorCategory);
  console.error('Should Retry:', enhanced.shouldRetry);
  console.error('Original Error:', error);
  console.groupEnd();
}

/**
 * Create a user-friendly error message from a Firebase error
 */
export function createUserFriendlyErrorMessage(error: any, context?: string): string {
  const enhanced = enhanceFirebaseError(error, context);
  return enhanced.userMessage;
}
