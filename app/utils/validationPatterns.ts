/**
 * Centralized Validation Patterns
 *
 * Single source of truth for all validation patterns used across the codebase.
 * Import from this file instead of duplicating regex patterns.
 *
 * @module validationPatterns
 */

// =============================================================================
// EMAIL VALIDATION
// =============================================================================

/**
 * Standard email regex pattern - matches most valid email addresses
 * Used for client-side validation (lenient)
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Strict email regex pattern - RFC-compliant validation
 * Used for server-side validation (strict)
 */
export const EMAIL_REGEX_STRICT = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates an email address (client-side, lenient)
 * @param email - The email to validate
 * @returns True if valid email format
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
};

/**
 * Validates an email address (server-side, strict)
 * @param email - The email to validate
 * @returns True if valid email format
 */
export const isValidEmailStrict = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX_STRICT.test(email.trim());
};

/**
 * Checks if a string looks like an email (contains @)
 * @param str - The string to check
 * @returns True if string appears to be an email
 */
export const looksLikeEmail = (str: string | null | undefined): boolean => {
  if (!str || typeof str !== 'string') return false;
  return str.includes('@');
};

// =============================================================================
// USERNAME VALIDATION
// =============================================================================

/**
 * Username format regex - alphanumeric, underscores, dashes, periods
 */
export const USERNAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

/**
 * Simple username regex (no periods) - for API validation
 */
export const USERNAME_REGEX_SIMPLE = /^[a-zA-Z0-9_-]{3,30}$/;

/**
 * Username constraints
 */
export const USERNAME_CONSTRAINTS = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 30,
  ALLOWED_CHARS: 'letters, numbers, underscores, dashes, and periods',
} as const;

/**
 * Reserved usernames that cannot be used
 * Includes system accounts, common routes, and placeholder values
 */
export const RESERVED_USERNAMES = [
  // System accounts
  'admin', 'administrator', 'root', 'system', 'support', 'help',
  'wewrite', 'official', 'moderator', 'mod',
  // Routes and pages
  'home', 'about', 'contact', 'settings', 'profile', 'dashboard',
  'login', 'logout', 'register', 'signup', 'signin', 'signout',
  'api', 'app', 'www', 'mail', 'email', 'ftp', 'smtp',
  // Placeholder values
  'anonymous', 'user', 'guest', 'undefined', 'null', 'missing username',
  // Common spam/abuse patterns
  'test', 'demo', 'example', 'sample',
] as const;

/**
 * Invalid username placeholder values
 */
export const INVALID_USERNAME_VALUES = [
  'anonymous',
  'missing username',
  'user',
  'undefined',
  'null',
  'loading...',
] as const;

export interface UsernameValidationResult {
  isValid: boolean;
  error: string | null;
  message: string | null;
}

/**
 * Validates username format
 * @param username - The username to validate
 * @returns Validation result with error details
 */
export const validateUsernameFormat = (username: string): UsernameValidationResult => {
  // Check minimum length
  if (!username || username.length < USERNAME_CONSTRAINTS.MIN_LENGTH) {
    return {
      isValid: false,
      error: "TOO_SHORT",
      message: `Username must be at least ${USERNAME_CONSTRAINTS.MIN_LENGTH} characters`
    };
  }

  // Check maximum length
  if (username.length > USERNAME_CONSTRAINTS.MAX_LENGTH) {
    return {
      isValid: false,
      error: "TOO_LONG",
      message: `Username cannot be longer than ${USERNAME_CONSTRAINTS.MAX_LENGTH} characters`
    };
  }

  // Check for whitespace characters
  if (/\s/.test(username)) {
    return {
      isValid: false,
      error: "CONTAINS_WHITESPACE",
      message: "Usernames cannot contain spaces or whitespace characters. Try using underscores (_) instead."
    };
  }

  // Check if username contains only allowed characters
  if (!USERNAME_REGEX.test(username)) {
    return {
      isValid: false,
      error: "INVALID_CHARACTERS",
      message: `Username can only contain ${USERNAME_CONSTRAINTS.ALLOWED_CHARS}`
    };
  }

  // Cannot start or end with a period, dash, or underscore
  if (/^[._\-]|[._\-]$/.test(username)) {
    return {
      isValid: false,
      error: "INVALID_START_END",
      message: "Username cannot start or end with a period, dash, or underscore"
    };
  }

  // Cannot have consecutive special characters
  if (/[._\-]{2,}/.test(username)) {
    return {
      isValid: false,
      error: "CONSECUTIVE_SPECIAL",
      message: "Username cannot have consecutive periods, dashes, or underscores"
    };
  }

  // Check for reserved usernames
  if (RESERVED_USERNAMES.includes(username.toLowerCase() as any)) {
    return {
      isValid: false,
      error: "RESERVED",
      message: "This username is reserved and cannot be used"
    };
  }

  return {
    isValid: true,
    error: null,
    message: null
  };
};

/**
 * Checks if a string is a valid username (not a placeholder)
 * @param str - The string to check
 * @returns True if valid username string
 */
export const isValidUsernameString = (str: string | null | undefined): boolean => {
  if (!str || typeof str !== 'string') return false;

  const trimmed = str.trim();
  if (trimmed.length === 0) return false;

  // Check for invalid placeholder values
  if (INVALID_USERNAME_VALUES.includes(trimmed.toLowerCase() as any)) return false;

  // Check for generated usernames (user_xxxxx pattern)
  if (/^user_[a-zA-Z0-9]+$/i.test(trimmed)) return false;

  return true;
};

// =============================================================================
// URL VALIDATION
// =============================================================================

/**
 * URL regex pattern
 */
export const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/**
 * Validates a URL
 * @param url - The URL to validate
 * @returns True if valid URL
 */
export const isValidUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  return URL_REGEX.test(url.trim());
};

// =============================================================================
// PAGE/ID VALIDATION
// =============================================================================

/**
 * Page ID regex pattern
 */
export const PAGE_ID_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;

/**
 * User ID regex pattern
 */
export const USER_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * UUID regex pattern
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates a page ID
 * @param pageId - The page ID to validate
 * @returns True if valid page ID
 */
export const isValidPageId = (pageId: string): boolean => {
  if (!pageId || typeof pageId !== 'string') return false;
  return PAGE_ID_REGEX.test(pageId);
};

/**
 * Validates a user ID
 * @param userId - The user ID to validate
 * @returns True if valid user ID
 */
export const isValidUserId = (userId: string): boolean => {
  if (!userId || typeof userId !== 'string') return false;
  return USER_ID_REGEX.test(userId);
};

// =============================================================================
// SEARCH VALIDATION
// =============================================================================

/**
 * Search term regex pattern
 */
export const SEARCH_TERM_REGEX = /^[a-zA-Z0-9\s\-_.,!?'"()]{1,200}$/;

/**
 * Validates a search term
 * @param term - The search term to validate
 * @returns True if valid search term
 */
export const isValidSearchTerm = (term: string): boolean => {
  if (!term || typeof term !== 'string') return false;
  return SEARCH_TERM_REGEX.test(term);
};

// =============================================================================
// PASSWORD VALIDATION
// =============================================================================

/**
 * Password constraints
 */
export const PASSWORD_CONSTRAINTS = {
  MIN_LENGTH: 6,
  MAX_LENGTH: 128,
} as const;

/**
 * Validates a password meets minimum requirements
 * @param password - The password to validate
 * @returns Validation result
 */
export const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (!password || password.length < PASSWORD_CONSTRAINTS.MIN_LENGTH) {
    return {
      isValid: false,
      message: `Password must be at least ${PASSWORD_CONSTRAINTS.MIN_LENGTH} characters`
    };
  }
  if (password.length > PASSWORD_CONSTRAINTS.MAX_LENGTH) {
    return {
      isValid: false,
      message: `Password cannot exceed ${PASSWORD_CONSTRAINTS.MAX_LENGTH} characters`
    };
  }
  return { isValid: true };
};

// =============================================================================
// EXPORTS - Grouped for convenience
// =============================================================================

export const ValidationPatterns = {
  email: EMAIL_REGEX,
  emailStrict: EMAIL_REGEX_STRICT,
  username: USERNAME_REGEX,
  usernameSimple: USERNAME_REGEX_SIMPLE,
  url: URL_REGEX,
  pageId: PAGE_ID_REGEX,
  userId: USER_ID_REGEX,
  uuid: UUID_REGEX,
  searchTerm: SEARCH_TERM_REGEX,
} as const;

export const ValidationFunctions = {
  isValidEmail,
  isValidEmailStrict,
  looksLikeEmail,
  validateUsernameFormat,
  isValidUsernameString,
  isValidUrl,
  isValidPageId,
  isValidUserId,
  isValidSearchTerm,
  validatePassword,
} as const;
