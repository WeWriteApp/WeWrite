import { formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Formats a date as a relative time string (e.g., "5 minutes ago")
 */
export function formatRelativeTime(dateInput: string | Date | any): string {
  if (!dateInput) return '';

  try {
    let date: Date;

    // Handle different input types
    if (typeof dateInput === 'string') {
      date = parseISO(dateInput);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else if (dateInput && typeof dateInput === 'object') {
      // Handle Firestore Timestamp objects
      if (typeof dateInput.toDate === 'function') {
        date = dateInput.toDate();
      } else if (typeof dateInput.seconds === 'number') {
        // Handle Firestore Timestamp-like objects
        date = new Date(dateInput.seconds * 1000);
      } else if (dateInput._seconds) {
        // Handle other Firestore Timestamp formats
        date = new Date(dateInput._seconds * 1000);
      } else {
        // Try to create a Date from the object
        date = new Date(dateInput);
      }
    } else {
      // Try to create a Date from whatever we have
      date = new Date(dateInput);
    }

    // Validate that the date is valid before passing to formatDistanceToNow
    if (!date || isNaN(date.getTime())) {
      console.warn('Invalid date provided to formatRelativeTime:', dateInput);
      return '';
    }

    // Get the formatted time string
    let timeString = formatDistanceToNow(date, { addSuffix: true });

    // Remove "about" from the string
    timeString = timeString.replace('about ', '');

    return timeString;
  } catch (error) {
    console.error('Error formatting relative time:', error, 'Input:', dateInput);
    return '';
  }
}