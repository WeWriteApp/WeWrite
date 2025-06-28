"use client";

import { db } from './database';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  increment,
  type DocumentSnapshot,
  type DocumentData
} from 'firebase/firestore';

// Type definitions for streak operations
interface StreakData {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Timestamp;
  activityDates: Timestamp[];
  totalDaysActive: number;
  createdAt?: any;
  updatedAt?: any;
}

interface UserStreakResult {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  totalDaysActive: number;
}

/**
 * Get a user's streak data
 *
 * @param userId - The user ID
 * @returns The user's streak data
 */
export const getUserStreaks = async (userId: string): Promise<UserStreakResult | null> => {
  if (!userId) return null;

  try {
    // Get the user's streak document
    const streakDocRef = doc(db, 'userStreaks', userId);
    const streakDoc: DocumentSnapshot<DocumentData> = await getDoc(streakDocRef);

    if (!streakDoc.exists()) {
      return null;
    }

    const streakData = streakDoc.data() as StreakData;

    // Calculate current streak based on activity dates
    const currentStreak = calculateCurrentStreak(streakData.activityDates || []);

    return {
      currentStreak,
      longestStreak: streakData.longestStreak || 0,
      lastActiveDate: streakData.lastActiveDate?.toDate().toISOString() || null,
      totalDaysActive: streakData.totalDaysActive || 0
    };
  } catch (error) {
    console.error('Error getting user streaks:', error);
    throw error;
  }
};

/**
 * Record user activity for streak tracking
 *
 * @param userId - The user ID
 * @returns Whether the operation was successful
 */
export const recordUserActivity = async (userId: string): Promise<boolean> => {
  if (!userId) return false;

  try {
    // Get today's date at midnight (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // Get the user's streak document
    const streakDocRef = doc(db, 'userStreaks', userId);
    const streakDoc: DocumentSnapshot<DocumentData> = await getDoc(streakDocRef);

    if (!streakDoc.exists()) {
      // Create a new streak document if it doesn't exist
      const newStreakData: StreakData = {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: Timestamp.fromDate(today),
        activityDates: [Timestamp.fromDate(today)],
        totalDaysActive: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(streakDocRef, newStreakData);

      return true;
    }

    // Get the streak data
    const streakData = streakDoc.data() as StreakData;
    
    // Check if the user has already been active today
    const lastActiveDate = streakData.lastActiveDate?.toDate();
    if (lastActiveDate && isSameDay(lastActiveDate, today)) {
      // User has already been active today, no need to update
      return true;
    }

    // Check if this activity continues a streak
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isConsecutive = lastActiveDate && isSameDay(lastActiveDate, yesterday);
    
    // Calculate the new current streak
    let newCurrentStreak = 1; // Default to 1 if starting fresh
    
    if (isConsecutive) {
      // Continue the streak
      newCurrentStreak = (streakData.currentStreak || 0) + 1;
    }
    
    // Calculate the new longest streak
    const newLongestStreak = Math.max(newCurrentStreak, streakData.longestStreak || 0);
    
    // Update the streak document
    await updateDoc(streakDocRef, {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastActiveDate: Timestamp.fromDate(today),
      activityDates: arrayUnion(Timestamp.fromDate(today)),
      totalDaysActive: increment(1),
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error: any) {
    // Handle permission denied errors gracefully - this is expected in some environments
    if (error?.code === 'permission-denied') {
      console.log('Permission denied recording user activity - this is expected in some environments');
      return false;
    } else {
      console.error('Error recording user activity:', error);
      return false;
    }
  }
};

/**
 * Calculate the current streak based on activity dates
 *
 * @param activityDates - Array of activity date timestamps
 * @returns The current streak
 */
const calculateCurrentStreak = (activityDates: Timestamp[]): number => {
  if (!activityDates || activityDates.length === 0) {
    return 0;
  }

  // Convert Firestore Timestamps to JavaScript Dates and sort in descending order
  const dates: Date[] = activityDates
    .map(timestamp => timestamp.toDate())
    .sort((a, b) => b.getTime() - a.getTime());

  // Get today's date at midnight (UTC)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  // Get yesterday's date
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Check if the most recent activity was today or yesterday
  const mostRecentDate = dates[0];
  const isActiveToday = isSameDay(mostRecentDate, today);
  const isActiveYesterday = isSameDay(mostRecentDate, yesterday);
  
  // If not active today or yesterday, streak is broken
  if (!isActiveToday && !isActiveYesterday) {
    return 0;
  }
  
  // Count consecutive days
  let streak = isActiveToday ? 1 : 0;
  let currentDate = isActiveToday ? yesterday : new Date(yesterday);
  currentDate.setDate(currentDate.getDate() - 1);
  
  // Start from index 1 if active today (we already counted today)
  const startIndex = isActiveToday ? 1 : 0;
  
  for (let i = startIndex; i < dates.length; i++) {
    const activityDate = dates[i];
    
    // Check if this date is consecutive with the current date we're checking
    if (isSameDay(activityDate, currentDate)) {
      streak++;
      // Move to the previous day
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (activityDate < currentDate) {
      // If we've passed this date already, skip it
      continue;
    } else {
      // Streak is broken
      break;
    }
  }
  
  return streak;
};

/**
 * Check if two dates are the same day
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Whether the dates are the same day
 */
const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
};
