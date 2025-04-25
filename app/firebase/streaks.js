import { db } from './database';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp,
  Timestamp,
  increment
} from 'firebase/firestore';

/**
 * Get a user's streak data
 * 
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The user's streak data
 */
export const getUserStreaks = async (userId) => {
  if (!userId) return null;

  try {
    // Get the user's streak document
    const streakDocRef = doc(db, 'userStreaks', userId);
    const streakDoc = await getDoc(streakDocRef);

    if (!streakDoc.exists()) {
      return null;
    }

    const streakData = streakDoc.data();
    
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
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
export const recordUserActivity = async (userId) => {
  if (!userId) return false;

  try {
    // Get today's date at midnight (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // Get the user's streak document
    const streakDocRef = doc(db, 'userStreaks', userId);
    const streakDoc = await getDoc(streakDocRef);

    if (!streakDoc.exists()) {
      // Create a new streak document if it doesn't exist
      await setDoc(streakDocRef, {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: Timestamp.fromDate(today),
        activityDates: [Timestamp.fromDate(today)],
        totalDaysActive: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return true;
    }

    // Get the streak data
    const streakData = streakDoc.data();
    
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
  } catch (error) {
    console.error('Error recording user activity:', error);
    return false;
  }
};

/**
 * Calculate the current streak based on activity dates
 * 
 * @param {Array<Timestamp>} activityDates - Array of activity date timestamps
 * @returns {number} - The current streak
 */
const calculateCurrentStreak = (activityDates) => {
  if (!activityDates || activityDates.length === 0) {
    return 0;
  }

  // Convert Firestore Timestamps to JavaScript Dates and sort in descending order
  const dates = activityDates
    .map(timestamp => timestamp.toDate())
    .sort((a, b) => b - a);

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
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} - Whether the dates are the same day
 */
const isSameDay = (date1, date2) => {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
};
