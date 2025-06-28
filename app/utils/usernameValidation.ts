/**
 * Client-side username validation utilities
 * Provides real-time validation for username inputs
 */

export interface UsernameValidationResult {
  isValid: boolean;
  error: string | null;
  message: string | null;
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
  return [...new Set(suggestions)].slice(0, 3);
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
