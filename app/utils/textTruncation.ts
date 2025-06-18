/**
 * Text truncation utilities for WeWrite
 * Provides consistent text truncation across the application
 */

export interface TruncationOptions {
  maxLength: number;
  ellipsis?: string;
  preserveWords?: boolean;
}

/**
 * Truncates text to a specified length with optional word preservation
 * @param text - The text to truncate
 * @param options - Truncation options
 * @returns The truncated text
 */
export function truncateText(
  text: string,
  options: TruncationOptions
): string {
  const { maxLength, ellipsis = '...', preserveWords = true } = options;

  if (!text || text.length <= maxLength) {
    return text;
  }

  if (!preserveWords) {
    return text.substring(0, maxLength - ellipsis.length) + ellipsis;
  }

  // Find the last space before the max length
  const truncated = text.substring(0, maxLength - ellipsis.length);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  if (lastSpaceIndex > 0) {
    return truncated.substring(0, lastSpaceIndex) + ellipsis;
  }

  // If no space found, truncate at character level
  return truncated + ellipsis;
}

/**
 * Truncates link display text specifically for pill links
 * Uses sensible defaults for link text
 */
export function truncateLinkText(text: string, maxLength: number = 50): string {
  return truncateText(text, {
    maxLength,
    ellipsis: '...',
    preserveWords: true
  });
}

/**
 * Truncates URL text for display purposes
 * Removes protocol and www for cleaner display
 */
export function truncateUrl(url: string, maxLength: number = 40): string {
  if (!url) return '';

  // Remove protocol and www for display
  let displayUrl = url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');

  return truncateText(displayUrl, {
    maxLength,
    ellipsis: '...',
    preserveWords: false // URLs don't need word preservation
  });
}

/**
 * Smart truncation for external link display text
 * If custom text is provided, truncate it. Otherwise, truncate the URL.
 */
export function truncateExternalLinkText(
  displayText: string,
  url: string,
  maxLength: number = 50
): string {
  // If display text is different from URL, it's custom text
  if (displayText && displayText !== url) {
    return truncateLinkText(displayText, maxLength);
  }

  // Otherwise, truncate the URL
  return truncateUrl(url, maxLength);
}
