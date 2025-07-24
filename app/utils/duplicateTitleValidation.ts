/**
 * Utility functions for validating duplicate page titles
 */

export interface ExistingPage {
  id: string;
  title: string;
  lastModified?: string;
  createdAt?: string;
}

export interface DuplicateTitleCheckResult {
  isDuplicate: boolean;
  existingPage: ExistingPage | null;
  error?: string;
}

export interface DuplicateTitleValidationResult {
  isValid: boolean;
  isDuplicate: boolean;
  existingPage: ExistingPage | null;
  error?: string;
  message?: string;
}

/**
 * Check if a title is a duplicate for the current user
 * @param title - The title to check
 * @param excludePageId - Optional page ID to exclude from the check (for editing)
 * @returns Promise with duplicate check result
 */
export const checkDuplicateTitle = async (
  title: string,
  excludePageId?: string
): Promise<DuplicateTitleCheckResult> => {
  try {
    // Validate title input
    if (!title || title.trim() === '') {
      return {
        isDuplicate: false,
        existingPage: null,
        error: 'Title is required'
      };
    }

    const trimmedTitle = title.trim();

    // Build API URL with parameters
    const params = new URLSearchParams({
      title: trimmedTitle
    });

    if (excludePageId) {
      params.set('excludePageId', excludePageId);
    }

    console.log('🔍 DUPLICATE_VALIDATION: Checking title for duplicates', {
      title: trimmedTitle,
      excludePageId: excludePageId || 'none'
    });

    const response = await fetch(`/api/pages/check-duplicate?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('🔴 DUPLICATE_VALIDATION: API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      return {
        isDuplicate: false,
        existingPage: null,
        error: errorData.message || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    console.log('🔍 DUPLICATE_VALIDATION: API response', data);

    return {
      isDuplicate: data.isDuplicate || false,
      existingPage: data.existingPage || null,
      error: undefined
    };

  } catch (error) {
    console.error('🔴 DUPLICATE_VALIDATION: Network error checking duplicate title:', error);
    return {
      isDuplicate: false,
      existingPage: null,
      error: 'Failed to check for duplicate title. Please try again.'
    };
  }
};

/**
 * Validate a title for duplicates and return user-friendly validation result
 * @param title - The title to validate
 * @param excludePageId - Optional page ID to exclude from the check (for editing)
 * @returns Promise with validation result including user-friendly messages
 */
export const validateTitleForDuplicates = async (
  title: string,
  excludePageId?: string
): Promise<DuplicateTitleValidationResult> => {
  // First check basic title validation
  if (!title || title.trim() === '') {
    return {
      isValid: false,
      isDuplicate: false,
      existingPage: null,
      error: 'EMPTY_TITLE',
      message: 'Please enter a title'
    };
  }

  const trimmedTitle = title.trim();

  // Check for duplicates
  const duplicateCheck = await checkDuplicateTitle(trimmedTitle, excludePageId);

  if (duplicateCheck.error) {
    return {
      isValid: false,
      isDuplicate: false,
      existingPage: null,
      error: 'CHECK_FAILED',
      message: duplicateCheck.error
    };
  }

  if (duplicateCheck.isDuplicate && duplicateCheck.existingPage) {
    return {
      isValid: false,
      isDuplicate: true,
      existingPage: duplicateCheck.existingPage,
      error: 'DUPLICATE_TITLE',
      message: `You already have a page titled "${trimmedTitle}"`
    };
  }

  // Title is valid and not a duplicate
  return {
    isValid: true,
    isDuplicate: false,
    existingPage: null
  };
};

/**
 * Debounced version of duplicate title checking for real-time validation
 * @param title - The title to check
 * @param excludePageId - Optional page ID to exclude from the check
 * @param delay - Debounce delay in milliseconds (default: 500)
 * @returns Promise with validation result
 */
export const debouncedValidateTitleForDuplicates = (() => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (
    title: string,
    excludePageId?: string,
    delay: number = 500
  ): Promise<DuplicateTitleValidationResult> => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        const result = await validateTitleForDuplicates(title, excludePageId);
        resolve(result);
      }, delay);
    });
  };
})();
