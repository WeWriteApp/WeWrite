/**
 * Comprehensive clipboard utilities for WeWrite application
 * 
 * Provides robust copy-to-clipboard functionality with fallbacks
 * for older browsers and error handling.
 */

/**
 * Copies text to clipboard with comprehensive fallback support
 * 
 * @param text - The text to copy to clipboard
 * @returns Promise<boolean> - Whether the copy operation was successful
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    console.warn('Clipboard API not available in this environment');
    return false;
  }

  try {
    // Try modern Clipboard API first (preferred method)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback to document.execCommand for older browsers
    return fallbackCopyToClipboard(text);
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    
    // Try fallback method if modern API fails
    try {
      return fallbackCopyToClipboard(text);
    } catch (fallbackErr) {
      console.error("Fallback copy also failed:", fallbackErr);
      return false;
    }
  }
};

/**
 * Fallback copy method using document.execCommand
 * 
 * @param text - The text to copy
 * @returns boolean - Whether the copy operation was successful
 */
const fallbackCopyToClipboard = (text: string): boolean => {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea invisible and out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    textArea.style.zIndex = '-1';
    
    document.body.appendChild(textArea);
    
    // Select and copy
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return successful;
  } catch (err) {
    console.error("Fallback copy failed:", err);
    return false;
  }
};

/**
 * Copies text to clipboard and returns a result object with success status and message
 * 
 * @param text - The text to copy
 * @param successMessage - Custom success message (optional)
 * @param errorMessage - Custom error message (optional)
 * @returns Promise<{success: boolean, message: string}> - Result object
 */
export const copyWithFeedback = async (
  text: string,
  successMessage: string = 'Copied to clipboard',
  errorMessage: string = 'Failed to copy to clipboard'
): Promise<{ success: boolean; message: string }> => {
  const success = await copyToClipboard(text);
  return {
    success,
    message: success ? successMessage : errorMessage
  };
};

/**
 * Checks if clipboard functionality is available in the current environment
 * 
 * @returns boolean - Whether clipboard functionality is available
 */
export const isClipboardAvailable = (): boolean => {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  
  // Check for modern Clipboard API or fallback execCommand support
  return !!(
    (navigator.clipboard && navigator.clipboard.writeText) ||
    document.execCommand
  );
};

/**
 * Formats error details for copying
 *
 * @param error - Error object or string
 * @param additionalInfo - Additional context information
 * @returns string - Formatted error text
 */
export const formatErrorForClipboard = (
  error: Error | string,
  additionalInfo?: Record<string, any>
): string => {
  const timestamp = new Date().toISOString();
  const url = typeof window !== 'undefined' ? window.location.href : 'Unknown';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'object' && error.stack ? error.stack : '';

  let formattedText = `
Error Details:
-------------
Timestamp: ${timestamp}
URL: ${url}
User Agent: ${userAgent}
Message: ${errorMessage}`;

  if (errorStack) {
    formattedText += `\n\nStack Trace:\n${errorStack}`;
  }

  if (additionalInfo) {
    formattedText += `\n\nAdditional Info:\n${JSON.stringify(additionalInfo, null, 2)}`;
  }

  return formattedText.trim();
};

/**
 * Enhanced error toast function that automatically includes copy functionality
 *
 * @param message - The error message to display
 * @param options - Additional options for the toast
 * @returns Promise<void>
 */
export const showErrorToastWithCopy = async (
  message: string,
  options?: {
    description?: string;
    copyText?: string;
    enableCopy?: boolean;
    additionalInfo?: Record<string, any>;
  }
): Promise<void> => {
  try {
    const { toast } = await import('../components/ui/use-toast');

    // Validate message
    if (!message || typeof message !== 'string') {
      console.warn('showErrorToastWithCopy: Invalid message provided:', message);
      message = 'An error occurred';
    }

    const {
      description,
      copyText,
      enableCopy = true,
      additionalInfo
    } = options || {};

    // Format the text to copy (include additional context if available)
    let textToCopy = copyText || message;
    if (additionalInfo && enableCopy) {
      try {
        textToCopy = formatErrorForClipboard(message, additionalInfo);
      } catch (formatError) {
        console.warn('Error formatting error details for clipboard:', formatError);
        textToCopy = message; // Fallback to just the message
      }
    }

    toast.error(message, {
      description,
      enableCopy,
      copyText: textToCopy,
    });
  } catch (error) {
    console.error('Error in showErrorToastWithCopy:', error);
    // Fallback to basic error display
    try {
      const { toast } = await import('../components/ui/use-toast');
      toast.error(message || 'An error occurred', { enableCopy: false });
    } catch (fallbackError) {
      console.error('Fallback error toast also failed:', fallbackError);
    }
  }
};
