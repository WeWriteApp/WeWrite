import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/database';
import { format, addDays, subDays } from 'date-fns';

/**
 * Check if a title exactly matches the YYYY-MM-DD format for daily notes
 */
export function isExactDateFormat(title: string): boolean {
  if (!title || title.length !== 10) return false;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(title);
}

/**
 * Parse a YYYY-MM-DD string into a Date object
 */
export function parseDateString(dateString: string): Date | null {
  try {
    if (!isExactDateFormat(dateString)) return null;
    const date = new Date(dateString);
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
 * Find the previous existing daily note for a user
 * @param userId - The user ID
 * @param currentDate - The current date string (YYYY-MM-DD)
 * @returns Promise<string | null> - The date string of the previous note, or null if none found
 */
export async function findPreviousExistingDailyNote(userId: string, currentDate: string): Promise<string | null> {
  try {
    if (!userId || !isExactDateFormat(currentDate)) return null;

    // Query for daily notes before the current date
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),
      where('title', '<', currentDate),
      orderBy('title', 'desc'),
      limit(50) // Limit to avoid large queries
    );

    const snapshot = await getDocs(pagesQuery);
    
    // Find the most recent daily note
    for (const doc of snapshot.docs) {
      const pageData = doc.data();
      if (pageData.title && isExactDateFormat(pageData.title)) {
        return pageData.title;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding previous daily note:', error);
    return null;
  }
}

/**
 * Find the next existing daily note for a user
 * @param userId - The user ID
 * @param currentDate - The current date string (YYYY-MM-DD)
 * @returns Promise<string | null> - The date string of the next note, or null if none found
 */
export async function findNextExistingDailyNote(userId: string, currentDate: string): Promise<string | null> {
  try {
    if (!userId || !isExactDateFormat(currentDate)) return null;

    // Query for daily notes after the current date
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),
      where('title', '>', currentDate),
      orderBy('title', 'asc'),
      limit(50) // Limit to avoid large queries
    );

    const snapshot = await getDocs(pagesQuery);
    
    // Find the earliest daily note after current date
    for (const doc of snapshot.docs) {
      const pageData = doc.data();
      if (pageData.title && isExactDateFormat(pageData.title)) {
        return pageData.title;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding next daily note:', error);
    return null;
  }
}

/**
 * Get the previous calendar day (regardless of whether a note exists)
 * @param currentDate - The current date string (YYYY-MM-DD)
 * @returns string | null - The previous day's date string, or null if invalid input
 */
export function getPreviousCalendarDay(currentDate: string): string | null {
  try {
    const date = parseDateString(currentDate);
    if (!date) return null;
    
    const previousDay = subDays(date, 1);
    return formatDateToString(previousDay);
  } catch (error) {
    console.error('Error getting previous calendar day:', error);
    return null;
  }
}

/**
 * Get the next calendar day (regardless of whether a note exists)
 * @param currentDate - The current date string (YYYY-MM-DD)
 * @returns string | null - The next day's date string, or null if invalid input
 */
export function getNextCalendarDay(currentDate: string): string | null {
  try {
    const date = parseDateString(currentDate);
    if (!date) return null;
    
    const nextDay = addDays(date, 1);
    return formatDateToString(nextDay);
  } catch (error) {
    console.error('Error getting next calendar day:', error);
    return null;
  }
}

/**
 * Check if a daily note exists for a specific date and user
 * @param userId - The user ID
 * @param dateString - The date string (YYYY-MM-DD)
 * @returns Promise<boolean> - Whether the note exists
 */
export async function checkDailyNoteExists(userId: string, dateString: string): Promise<boolean> {
  try {
    if (!userId || !isExactDateFormat(dateString)) return false;

    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),
      where('title', '==', dateString),
      limit(1)
    );

    const snapshot = await getDocs(pagesQuery);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking if daily note exists:', error);
    return false;
  }
}

/**
 * Get the page ID for a specific daily note
 * @param userId - The user ID
 * @param dateString - The date string (YYYY-MM-DD)
 * @returns Promise<string | null> - The page ID if found, null otherwise
 */
export async function getDailyNotePageId(userId: string, dateString: string): Promise<string | null> {
  try {
    if (!userId || !isExactDateFormat(dateString)) return null;

    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),
      where('title', '==', dateString),
      limit(1)
    );

    const snapshot = await getDocs(pagesQuery);
    
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    return null;
  } catch (error) {
    console.error('Error getting daily note page ID:', error);
    return null;
  }
}

/**
 * Navigation result type
 */
export interface DailyNoteNavigationResult {
  dateString: string;
  pageId?: string;
  exists: boolean;
  shouldCreateNew: boolean;
}

/**
 * Navigate to previous daily note based on mode
 * @param userId - The user ID
 * @param currentDate - The current date string (YYYY-MM-DD)
 * @param isEditMode - Whether we're in edit mode
 * @returns Promise<DailyNoteNavigationResult | null>
 */
export async function navigateToPreviousDailyNote(
  userId: string, 
  currentDate: string, 
  isEditMode: boolean
): Promise<DailyNoteNavigationResult | null> {
  try {
    if (isEditMode) {
      // Edit mode: navigate to literal previous calendar day
      const previousDay = getPreviousCalendarDay(currentDate);
      if (!previousDay) return null;

      const exists = await checkDailyNoteExists(userId, previousDay);
      const pageId = exists ? await getDailyNotePageId(userId, previousDay) : undefined;

      return {
        dateString: previousDay,
        pageId,
        exists,
        shouldCreateNew: !exists
      };
    } else {
      // View mode: navigate to previous existing daily note
      const previousExistingDate = await findPreviousExistingDailyNote(userId, currentDate);
      if (!previousExistingDate) return null;

      const pageId = await getDailyNotePageId(userId, previousExistingDate);

      return {
        dateString: previousExistingDate,
        pageId,
        exists: true,
        shouldCreateNew: false
      };
    }
  } catch (error) {
    console.error('Error navigating to previous daily note:', error);
    return null;
  }
}

/**
 * Navigate to next daily note based on mode
 * @param userId - The user ID
 * @param currentDate - The current date string (YYYY-MM-DD)
 * @param isEditMode - Whether we're in edit mode
 * @returns Promise<DailyNoteNavigationResult | null>
 */
export async function navigateToNextDailyNote(
  userId: string, 
  currentDate: string, 
  isEditMode: boolean
): Promise<DailyNoteNavigationResult | null> {
  try {
    if (isEditMode) {
      // Edit mode: navigate to literal next calendar day
      const nextDay = getNextCalendarDay(currentDate);
      if (!nextDay) return null;

      const exists = await checkDailyNoteExists(userId, nextDay);
      const pageId = exists ? await getDailyNotePageId(userId, nextDay) : undefined;

      return {
        dateString: nextDay,
        pageId,
        exists,
        shouldCreateNew: !exists
      };
    } else {
      // View mode: navigate to next existing daily note
      const nextExistingDate = await findNextExistingDailyNote(userId, currentDate);
      if (!nextExistingDate) return null;

      const pageId = await getDailyNotePageId(userId, nextExistingDate);

      return {
        dateString: nextExistingDate,
        pageId,
        exists: true,
        shouldCreateNew: false
      };
    }
  } catch (error) {
    console.error('Error navigating to next daily note:', error);
    return null;
  }
}
