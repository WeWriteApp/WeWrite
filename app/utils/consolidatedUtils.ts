/**
 * Consolidated Utilities - Removes duplicate utility functions
 * 
 * Consolidates:
 * - Text processing functions (from text-extraction.ts, textExtraction.ts)
 * - Date formatting functions (from formatRelativeTime.ts, DateFormatContext.tsx, dailyNoteNavigation.ts)
 * - Currency formatting functions (from formatCurrency.ts)
 * - Link formatting functions (from linkFormatters.ts)
 * - Content validation functions (from contentValidation.ts)
 * - Common utilities (from common.ts, utils/common.ts)
 * 
 * Provides:
 * - Single source of truth for common utilities
 * - Consistent implementations
 * - Reduced code duplication
 * - Better maintainability
 */

import { formatDistanceToNow, parseISO, format } from 'date-fns';

// =============================================================================
// TEXT PROCESSING UTILITIES
// =============================================================================

/**
 * Extract plain text from various editor content formats
 */
export function extractTextContent(contentJsonString: string | object): string {
  try {
    if (!contentJsonString) return '';

    // If it's already a string and not JSON, return it
    if (typeof contentJsonString === 'string' &&
        (contentJsonString.trim()[0] !== '{' && contentJsonString.trim()[0] !== '[')) {
      return contentJsonString;
    }

    // Handle empty content
    if (contentJsonString === '' || contentJsonString === '[]' || contentJsonString === '{}') {
      return '';
    }

    let content;
    if (typeof contentJsonString === 'string') {
      content = JSON.parse(contentJsonString);
    } else {
      content = contentJsonString;
    }

    if (Array.isArray(content)) {
      return content.map(extractTextFromNode).join(' ').trim();
    } else if (typeof content === 'object') {
      return extractTextFromNode(content);
    }

    return String(content);
  } catch (error) {
    console.warn('Error extracting text content:', error);
    return typeof contentJsonString === 'string' ? contentJsonString : '';
  }
}

function extractTextFromNode(node: any): string {
  if (!node) return '';
  
  if (typeof node === 'string') return node;
  
  let text = '';
  
  // Handle text property
  if (node.text) {
    text += node.text;
  }
  
  // Handle children recursively
  if (node.children && Array.isArray(node.children)) {
    text += node.children.map(extractTextFromNode).join(' ');
  }
  
  return text;
}

/**
 * Clean up extracted text for display
 */
export function cleanupText(text: string): string {
  if (!text) return '';

  return text
    .replace(/[\r\n]+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/,\s*,+/g, ', ')
    .replace(/,\s*$/, '');
}

/**
 * Create a page description from page data
 */
export function createPageDescription(pageData: any, maxLength: number = 160): string {
  if (!pageData) return 'A WeWrite page';
  
  let description = pageData.title ? `${pageData.title}` : 'A WeWrite page';
  
  if (pageData.username) {
    description += ` by ${pageData.username}`;
  }
  
  if (pageData.content) {
    const contentText = extractTextContent(pageData.content);
    const remainingLength = maxLength - description.length - 3;
    if (contentText.trim().length > 0 && remainingLength > 0) {
      const excerpt = contentText.substring(0, remainingLength);
      description += `: ${excerpt}`;
    }
  }
  
  return description.length > maxLength ? description.substring(0, maxLength - 3) + '...' : description;
}

// =============================================================================
// DATE FORMATTING UTILITIES
// =============================================================================

/**
 * Format a date as relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(dateInput: string | Date | any): string {
  if (!dateInput) return '';

  try {
    let date: Date;

    if (typeof dateInput === 'string') {
      date = parseISO(dateInput);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else if (dateInput && typeof dateInput === 'object') {
      if (typeof dateInput.toDate === 'function') {
        date = dateInput.toDate();
      } else if (typeof dateInput.seconds === 'number') {
        date = new Date(dateInput.seconds * 1000);
      } else if (dateInput._seconds) {
        date = new Date(dateInput._seconds * 1000);
      } else {
        date = new Date(dateInput);
      }
    } else {
      date = new Date(dateInput);
    }

    if (!date || isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatRelativeTime:', dateInput);
      return '';
    }

    let timeString = formatDistanceToNow(date, { addSuffix: true });
    return timeString.replace('about ', '');
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return '';
  }
}

/**
 * Parse a YYYY-MM-DD string into a Date object
 */
export function parseDateString(dateString: string): Date | null {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('Error parsing date string:', error);
    return null;
  }
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateToString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format date by type
 */
export function formatDateByType(date: Date, formatType: string): string {
  switch (formatType) {
    case 'ISO':
      return date.toISOString().split('T')[0];
    case 'FULL_DAY':
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    case 'SHORT_DAY':
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    case 'MONTH_DAY_YEAR':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'DAY_MONTH_YEAR':
      return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    default:
      return date.toLocaleDateString();
  }
}

// =============================================================================
// CURRENCY FORMATTING UTILITIES
// =============================================================================

/**
 * Format USD amount to display format ($X.XX)
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format USD cents to display format ($X.XX)
 */
export function formatUsdCents(cents: number, currency: string = 'USD'): string {
  const dollars = cents / 100;
  return formatCurrency(dollars, currency);
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

// =============================================================================
// LINK FORMATTING UTILITIES
// =============================================================================

/**
 * Format a page title (remove @ symbol)
 */
export function formatPageTitle(title: string): string {
  if (!title) return "Untitled";
  return title.startsWith('@') ? title.substring(1) : title;
}

/**
 * Format a username (remove @ symbol for UI)
 */
export function formatUsername(username: string): string {
  if (!username) return "Anonymous";
  return username.startsWith('@') ? username.substring(1) : username;
}

// =============================================================================
// CONTENT VALIDATION UTILITIES
// =============================================================================

/**
 * Check if content item has valid username data
 */
export function hasValidUsernameData(contentItem: any, logMissingData: boolean = true): boolean {
  if (!contentItem) return false;
  
  const hasMissingUsername = contentItem.userId && 
    (!contentItem.username || 
     contentItem.username === 'undefined' || 
     contentItem.username === 'null' || 
     contentItem.username === 'Missing username');

  if (hasMissingUsername && logMissingData) {
    console.warn('Content item has userId but missing username:', contentItem);
  }

  return !hasMissingUsername;
}

// =============================================================================
// COMMON UTILITIES
// =============================================================================

/**
 * Get supported programming languages
 */
export function getLanguages(): string[] {
  return [
    'javascript',
    'python',
    'java',
    'typescript',
    'html',
    'css',
    'json',
    'markdown',
    'plaintext',
  ];
}

/**
 * Debounce function utility
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

/**
 * Throttle function utility
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Generate a random ID
 */
export function generateId(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

// Legacy exports for backward compatibility
export const extractTextFromEditor = extractTextContent;
export const extractTextFromSlate = extractTextContent;
export const extractDescription = extractTextContent;
