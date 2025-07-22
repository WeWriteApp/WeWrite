/**
 * Client-side username validation utilities
 * Provides real-time validation for username inputs and centralized username detection logic
 */

export interface UsernameValidationResult {
  isValid: boolean;
  error: string | null;
  message: string | null;
}

export interface UserData {
  uid?: string;
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  [key: string]: any;
}

export interface UsernameCheckResult {
  hasUsername: boolean;
  username: string | null;
  source: 'username' | 'displayName' | 'email' | 'none';
  needsUsername: boolean;
  reason?: string;
}

/**
 * Validates username format on the client side
 * @param username - The username to validate
 * @returns Validation result with error details
 */
export const validateUsernameFormat = (username: string): UsernameValidationResult => {
  // Check minimum length
  if (!username || username.length < 3) {
    return {
      isValid: false,
      error: "TOO_SHORT",
      message: "Username must be at least 3 characters"
    };
  }

  // Check for whitespace characters (comprehensive Unicode whitespace detection)
  if (/\s/.test(username)) {
    return {
      isValid: false,
      error: "CONTAINS_WHITESPACE",
      message: "Usernames cannot contain spaces or whitespace characters. Try using underscores (_) instead."
    };
  }

  // Check if username contains only alphanumeric characters and underscores
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      isValid: false,
      error: "INVALID_CHARACTERS",
      message: "Username can only contain letters, numbers, and underscores"
    };
  }

  // Check maximum length (optional, can be adjusted)
  if (username.length > 30) {
    return {
      isValid: false,
      error: "TOO_LONG",
      message: "Username cannot be longer than 30 characters"
    };
  }

  return {
    isValid: true,
    error: null,
    message: null
  };
};

/**
 * Checks if a username contains whitespace characters
 * @param username - The username to check
 * @returns True if username contains whitespace
 */
export const containsWhitespace = (username: string): boolean => {
  return /\s/.test(username);
};

/**
 * Validates if input is a valid email format
 * @param email - The email to validate
 * @returns True if valid email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates login input (email or username)
 * @param input - The email or username input
 * @returns Validation result with specific error messages
 */
export const validateLoginInput = (input: string): UsernameValidationResult => {
  // Check if input is empty or only whitespace
  if (!input || input.trim().length === 0) {
    return {
      isValid: false,
      error: "EMPTY_INPUT",
      message: "Please enter your email or username"
    };
  }

  const trimmedInput = input.trim();

  // If it contains @ symbol, treat it as an email
  if (trimmedInput.includes('@')) {
    if (isValidEmail(trimmedInput)) {
      return {
        isValid: true,
        error: null,
        message: null
      };
    } else {
      return {
        isValid: false,
        error: "INVALID_EMAIL",
        message: "Please enter a valid email address"
      };
    }
  }

  // Otherwise, validate as username
  return validateUsernameFormat(trimmedInput);
};

/**
 * Suggests a cleaned version of the username by removing/replacing invalid characters
 * @param username - The original username
 * @returns Cleaned username suggestion
 */
export const suggestCleanUsername = (username: string): string => {
  if (!username) return '';

  // Replace all types of whitespace with underscores (spaces, tabs, newlines, etc.)
  let cleaned = username.replace(/\s+/g, '_');

  // Remove any characters that aren't alphanumeric or underscores
  cleaned = cleaned.replace(/[^a-zA-Z0-9_]/g, '');

  // Remove multiple consecutive underscores
  cleaned = cleaned.replace(/_+/g, '_');

  // Remove leading/trailing underscores
  cleaned = cleaned.replace(/^_+|_+$/g, '');

  // Ensure minimum length
  if (cleaned.length < 3) {
    // If we have some content, append numbers
    if (cleaned.length > 0) {
      cleaned = cleaned + '123';
    } else {
      // If no valid characters, suggest a default
      cleaned = 'user123';
    }
  }

  // Ensure maximum length
  if (cleaned.length > 30) {
    cleaned = cleaned.substring(0, 30);
    // Remove trailing underscore if truncation created one
    cleaned = cleaned.replace(/_+$/, '');
  }

  return cleaned;
};

/**
 * Generates multiple username suggestions based on the original input
 * @param username - The original username
 * @returns Array of suggested usernames
 */
export const generateUsernameSuggestions = (username: string): string[] => {
  const suggestions: string[] = [];
  const baseClean = suggestCleanUsername(username);

  if (baseClean && baseClean !== username) {
    suggestions.push(baseClean);

    // Add variations with numbers
    suggestions.push(baseClean + '2024');
    suggestions.push(baseClean + '123');

    // Add variation with underscore and year
    if (!baseClean.endsWith('_')) {
      suggestions.push(baseClean + '_2024');
    }
  }

  // Remove duplicates and return up to 3 suggestions
  return Array.from(new Set(suggestions)).slice(0, 3);
};

/**
 * CENTRALIZED USERNAME DETECTION LOGIC
 * This is the single source of truth for determining if a user has a valid username
 * All components should use this function instead of implementing their own logic
 */

/**
 * Checks if a user has a valid username from any available source
 * @param user - User data object from any auth system
 * @returns Comprehensive username check result
 */
export const checkUserHasUsername = (user: UserData | null): UsernameCheckResult => {
  if (!user) {
    return {
      hasUsername: false,
      username: null,
      source: 'none',
      needsUsername: false, // Not logged in, so no username needed
      reason: 'User not logged in'
    };
  }

  // Helper function to check if a string is a valid username
  const isValidUsernameString = (str: string | null | undefined): boolean => {
    if (!str || typeof str !== 'string') return false;

    const trimmed = str.trim();
    if (trimmed.length === 0) return false;

    // Check for invalid placeholder values
    const invalidValues = [
      'anonymous',
      'missing username',
      'user',
      'undefined',
      'null'
    ];

    if (invalidValues.includes(trimmed.toLowerCase())) return false;

    // Check for generated usernames (user_xxxxx pattern)
    if (/^user_[a-zA-Z0-9]+$/i.test(trimmed)) return false;

    return true;
  };

  // Check username field first (highest priority)
  if (isValidUsernameString(user.username)) {
    return {
      hasUsername: true,
      username: user.username!.trim(),
      source: 'username',
      needsUsername: false
    };
  }

  // Check displayName field (medium priority) - but never use if it contains @
  if (isValidUsernameString(user.displayName) && !user.displayName!.includes('@')) {
    return {
      hasUsername: true,
      username: user.displayName!.trim(),
      source: 'displayName',
      needsUsername: false
    };
  }

  // SECURITY: Never use email prefix as username fallback - always require explicit username

  // No valid username found
  return {
    hasUsername: false,
    username: null,
    source: 'none',
    needsUsername: true,
    reason: 'No valid username found in any field'
  };
};

/**
 * Simple helper function for components that just need to know if username is needed
 * @param user - User data object from any auth system
 * @returns True if user needs to set a username
 */
export const userNeedsUsername = (user: UserData | null): boolean => {
  return checkUserHasUsername(user).needsUsername;
};

/**
 * Gets the best available username for a user
 * @param user - User data object from any auth system
 * @returns The best username or null if none available
 */
export const getBestUsername = (user: UserData | null): string | null => {
  return checkUserHasUsername(user).username;
};

/**
 * Gets a user-friendly error message for username validation
 * @param error - The error code
 * @returns User-friendly error message with suggestions
 */
export const getUsernameErrorMessage = (error: string | null): string => {
  switch (error) {
    case "TOO_SHORT":
      return "Username must be at least 3 characters";
    case "CONTAINS_WHITESPACE":
      return "Usernames cannot contain spaces or whitespace characters. Try using underscores (_) instead.";
    case "INVALID_CHARACTERS":
      return "Username can only contain letters, numbers, and underscores. Try removing special characters.";
    case "TOO_LONG":
      return "Username cannot be longer than 30 characters";
    case "USERNAME_TAKEN":
      return "Username already taken. Try a different variation.";
    case "CHECK_ERROR":
      return "Could not verify username availability. Please try again.";
    default:
      return "Please enter a valid username";
  }
};