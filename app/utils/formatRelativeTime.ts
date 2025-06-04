import { formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Formats a date as a relative time string (e.g., "5 minutes ago")
 */
export function formatRelativeTime(dateString: string | Date): string {
  if (!dateString) return '';

  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    // Get the formatted time string
    let timeString = formatDistanceToNow(date, { addSuffix: true });

    // Remove "about" from the string
    timeString = timeString.replace('about ', '');

    return timeString;
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return '';
  }
}
