/**
 * Username Security Utilities
 * 
 * CRITICAL SECURITY: These utilities ensure that email addresses are NEVER
 * exposed as usernames in the UI. This is a serious privacy/security concern.
 */

/**
 * Sanitizes a username to ensure email addresses are never displayed
 * @param username - The username to sanitize
 * @param loadingText - Text to show when username is loading (default: "Loading...")
 * @param fallbackText - Text to show when username is missing (default: "Missing username")
 * @returns Sanitized username that is safe to display
 */
export function sanitizeUsername(
  username: string | null | undefined,
  loadingText: string = "Loading...",
  fallbackText: string = "Missing username"
): string {
  // Handle null/undefined
  if (!username) {
    return fallbackText;
  }

  // Handle empty string or whitespace
  if (typeof username !== 'string' || username.trim() === '') {
    return fallbackText;
  }

  // SECURITY: Never display email addresses
  if (username.includes('@')) {
    return loadingText;
  }

  // Handle other invalid username patterns
  const invalidPatterns = [
    'anonymous',
    'missing username',
    'user',
    'undefined',
    'null'
  ];

  const lowerUsername = username.toLowerCase().trim();
  if (invalidPatterns.includes(lowerUsername)) {
    return fallbackText;
  }

  // Return the sanitized username
  return username.trim();
}

/**
 * Checks if a username is potentially an email address
 * @param username - The username to check
 * @returns True if the username appears to be an email address
 */
export function isEmailAddress(username: string | null | undefined): boolean {
  if (!username || typeof username !== 'string') {
    return false;
  }
  
  return username.includes('@');
}

/**
 * Checks if a username needs to be refreshed from the API
 * @param username - The username to check
 * @returns True if the username should be refreshed
 */
export function needsUsernameRefresh(username: string | null | undefined): boolean {
  if (!username || typeof username !== 'string') {
    return true;
  }

  const trimmed = username.trim();
  
  // Needs refresh if empty
  if (trimmed === '') {
    return true;
  }

  // SECURITY: Needs refresh if it's an email address
  if (trimmed.includes('@')) {
    return true;
  }

  // Needs refresh if it's a placeholder value
  const placeholderValues = [
    'missing username',
    'anonymous',
    'loading...',
    'user'
  ];

  return placeholderValues.includes(trimmed.toLowerCase());
}

/**
 * Gets a safe display username with proper fallbacks
 * @param username - The username to display
 * @param isLoading - Whether the username is currently being loaded
 * @returns Safe username for display
 */
export function getDisplayUsername(
  username: string | null | undefined,
  isLoading: boolean = false
): string {
  if (isLoading) {
    return "Loading...";
  }

  return sanitizeUsername(username);
}

/**
 * Validates that a username is safe for display
 * @param username - The username to validate
 * @returns Validation result with safe display value
 */
export function validateDisplayUsername(username: string | null | undefined): {
  isSafe: boolean;
  displayValue: string;
  needsRefresh: boolean;
} {
  const needsRefresh = needsUsernameRefresh(username);
  const isEmail = isEmailAddress(username);
  
  return {
    isSafe: !isEmail && !needsRefresh,
    displayValue: sanitizeUsername(username),
    needsRefresh
  };
}
