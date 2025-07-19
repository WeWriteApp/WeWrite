/**
 * Calculate Past Streaks Script
 * 
 * This script calculates and updates streak data for users based on their
 * historical page creation activity. It's used by the admin tools interface.
 */

import { db } from '../firebase/config';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';

/**
 * Calculate past streaks for all users
 * @returns {Promise<{success: boolean, message: string, stats?: object}>}
 */
export async function calculatePastStreaks() {
  try {
    console.log('🔥 Starting past streak calculation...');
    
    const stats = {
      usersProcessed: 0,
      streaksCalculated: 0,
      errors: 0
    };

    // Get all users
    const usersQuery = query(collection(db, getCollectionName('users')));
    const usersSnapshot = await getDocs(usersQuery);
    
    console.log(`📊 Found ${usersSnapshot.size} users to process`);

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        console.log(`Processing user: ${userData.username || userId}`);
        
        // Get all pages for this user, ordered by creation date
        const pagesQuery = query(
          collection(db, getCollectionName('pages')),
          where('authorId', '==', userId),
          where('deleted', '!=', true),
          orderBy('createdAt', 'asc')
        );
        
        const pagesSnapshot = await getDocs(pagesQuery);
        const pages = pagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));

        if (pages.length === 0) {
          console.log(`  No pages found for user ${userId}`);
          continue;
        }

        // Calculate streaks
        const streakData = calculateUserStreaks(pages);
        
        // Update user document with streak data
        const userRef = doc(db, getCollectionName('users'), userId);
        await updateDoc(userRef, {
          streakData: {
            currentStreak: streakData.currentStreak,
            longestStreak: streakData.longestStreak,
            totalDaysActive: streakData.totalDaysActive,
            lastActiveDate: streakData.lastActiveDate,
            streakHistory: streakData.streakHistory,
            updatedAt: new Date()
          }
        });

        stats.usersProcessed++;
        stats.streaksCalculated += streakData.streakHistory.length;
        
        console.log(`  ✅ Updated streaks for ${userData.username || userId}: current=${streakData.currentStreak}, longest=${streakData.longestStreak}`);
        
      } catch (userError) {
        console.error(`Error processing user ${userDoc.id}:`, userError);
        stats.errors++;
      }
    }

    const message = `Streak calculation completed! Processed ${stats.usersProcessed} users, calculated ${stats.streaksCalculated} streak periods, ${stats.errors} errors.`;
    console.log('🎉 ' + message);

    return {
      success: true,
      message,
      stats
    };

  } catch (error) {
    console.error('Error calculating past streaks:', error);
    return {
      success: false,
      message: `Error calculating streaks: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Calculate streak data for a single user based on their pages
 * @param {Array} pages - Array of page objects with createdAt dates
 * @returns {Object} Streak data object
 */
function calculateUserStreaks(pages) {
  if (!pages || pages.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalDaysActive: 0,
      lastActiveDate: null,
      streakHistory: []
    };
  }

  // Group pages by date (YYYY-MM-DD)
  const pagesByDate = {};
  pages.forEach(page => {
    if (page.createdAt) {
      const dateKey = page.createdAt.toISOString().split('T')[0];
      if (!pagesByDate[dateKey]) {
        pagesByDate[dateKey] = [];
      }
      pagesByDate[dateKey].push(page);
    }
  });

  const activeDates = Object.keys(pagesByDate).sort();
  const totalDaysActive = activeDates.length;
  const lastActiveDate = activeDates.length > 0 ? new Date(activeDates[activeDates.length - 1]) : null;

  // Calculate streaks
  const streakHistory = [];
  let currentStreakStart = null;
  let currentStreakEnd = null;
  let longestStreak = 0;

  for (let i = 0; i < activeDates.length; i++) {
    const currentDate = new Date(activeDates[i]);
    
    if (currentStreakStart === null) {
      // Start new streak
      currentStreakStart = currentDate;
      currentStreakEnd = currentDate;
    } else {
      const previousDate = new Date(activeDates[i - 1]);
      const daysDiff = Math.floor((currentDate - previousDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Continue streak
        currentStreakEnd = currentDate;
      } else {
        // End current streak and start new one
        const streakLength = Math.floor((currentStreakEnd - currentStreakStart) / (1000 * 60 * 60 * 24)) + 1;
        streakHistory.push({
          start: currentStreakStart,
          end: currentStreakEnd,
          length: streakLength
        });
        
        longestStreak = Math.max(longestStreak, streakLength);
        
        // Start new streak
        currentStreakStart = currentDate;
        currentStreakEnd = currentDate;
      }
    }
  }

  // Don't forget the last streak
  if (currentStreakStart !== null) {
    const streakLength = Math.floor((currentStreakEnd - currentStreakStart) / (1000 * 60 * 60 * 24)) + 1;
    streakHistory.push({
      start: currentStreakStart,
      end: currentStreakEnd,
      length: streakLength
    });
    longestStreak = Math.max(longestStreak, streakLength);
  }

  // Calculate current streak (only if the last active date is recent)
  let currentStreak = 0;
  if (lastActiveDate) {
    const today = new Date();
    const daysSinceLastActive = Math.floor((today - lastActiveDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastActive <= 1) {
      // User is still active, calculate current streak
      const lastStreak = streakHistory[streakHistory.length - 1];
      if (lastStreak) {
        currentStreak = lastStreak.length;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalDaysActive,
    lastActiveDate,
    streakHistory
  };
}
