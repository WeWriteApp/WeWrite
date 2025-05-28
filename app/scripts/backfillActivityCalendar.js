"use client";

import { db } from "../../firebase/database";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Backfill activity calendar data based on actual user activity
 * This script analyzes page versions and creates activity calendar data
 *
 * @param {string} userId - Optional user ID to process only one user
 * @param {boolean} logProgress - Whether to log progress to console
 * @returns {Promise<Object>} - Result of the operation
 */
export async function backfillActivityCalendar(userId = null, logProgress = true) {
  try {
    if (logProgress) console.log('Starting activity calendar backfill...');

    // Map to store user activity dates with counts
    const userActivityMap = new Map();

    // If a specific user is provided, only process that user
    if (userId) {
      if (logProgress) console.log(`Processing activity for user: ${userId}`);
      await processUserActivity(userId, userActivityMap);
    } else {
      // Process all users
      if (logProgress) console.log('Processing activity for all users...');

      // Get all pages to analyze versions
      const pagesRef = collection(db, 'pages');
      const pagesSnapshot = await getDocs(pagesRef);

      if (logProgress) console.log(`Found ${pagesSnapshot.size} pages to process`);

      // Process all pages and their versions
      let processedPages = 0;
      for (const pageDoc of pagesSnapshot.docs) {
        const pageData = pageDoc.data();
        const pageUserId = pageData.userId;

        if (!pageUserId) continue;

        await processPageVersions(pageDoc.id, pageUserId, userActivityMap);

        processedPages++;
        if (logProgress && processedPages % 100 === 0) {
          console.log(`Processed ${processedPages} pages...`);
        }
      }

      if (logProgress) console.log(`Finished processing ${processedPages} pages`);
    }

    if (logProgress) console.log(`Found activity for ${userActivityMap.size} users`);

    // Update activity calendar data for each user
    let processedUsers = 0;
    for (const [userId, activityDatesMap] of userActivityMap.entries()) {
      await updateUserActivityCalendar(userId, activityDatesMap);

      processedUsers++;
      if (logProgress && processedUsers % 50 === 0) {
        console.log(`Updated activity calendar for ${processedUsers} users...`);
      }
    }

    if (logProgress) console.log(`Successfully updated activity calendar for ${processedUsers} users`);
    return { success: true, usersProcessed: processedUsers };
  } catch (error) {
    if (logProgress) console.error('Error backfilling activity calendar:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Process activity for a specific user
 *
 * @param {string} userId - The user ID to process
 * @param {Map} userActivityMap - Map to store user activity dates
 */
async function processUserActivity(userId, userActivityMap) {
  try {
    // Get all pages for this user
    const pagesRef = collection(db, 'pages');
    const pagesQuery = query(pagesRef, where('userId', '==', userId));
    const pagesSnapshot = await getDocs(pagesQuery);

    console.log(`Found ${pagesSnapshot.size} pages for user ${userId}`);

    // Process each page
    for (const pageDoc of pagesSnapshot.docs) {
      await processPageVersions(pageDoc.id, userId, userActivityMap);
    }
  } catch (error) {
    console.error(`Error processing user ${userId}:`, error);
  }
}

/**
 * Process versions for a specific page
 *
 * @param {string} pageId - The page ID
 * @param {string} userId - The user ID
 * @param {Map} userActivityMap - Map to store user activity dates
 */
async function processPageVersions(pageId, userId, userActivityMap) {
  try {
    // Get all versions for this page
    const versionsRef = collection(db, 'pages', pageId, 'versions');
    const versionsQuery = query(versionsRef, orderBy('createdAt', 'asc'));
    const versionsSnapshot = await getDocs(versionsQuery);

    // Process each version
    for (const versionDoc of versionsSnapshot.docs) {
      const versionData = versionDoc.data();
      const versionUserId = versionData.userId || userId; // Use version's userId if available
      const createdAt = versionData.createdAt;

      if (!createdAt || !versionUserId) continue;

      // Convert to Date object if it's a Timestamp
      let activityDate;
      if (typeof createdAt === 'object' && createdAt.toDate) {
        activityDate = createdAt.toDate();
      } else if (createdAt.seconds && createdAt.nanoseconds) {
        activityDate = new Date(createdAt.seconds * 1000);
      } else {
        activityDate = new Date(createdAt);
      }

      // Format date as YYYY-MM-DD for activity calendar
      const formattedDate = activityDate.toISOString().slice(0, 10);

      // Initialize user's activity map if not exists
      if (!userActivityMap.has(versionUserId)) {
        userActivityMap.set(versionUserId, new Map());
      }

      // Increment count for this date
      const userDates = userActivityMap.get(versionUserId);
      userDates.set(formattedDate, (userDates.get(formattedDate) || 0) + 1);
    }
  } catch (error) {
    console.error(`Error processing versions for page ${pageId}:`, error);
  }
}

/**
 * Update activity calendar data for a user
 *
 * @param {string} userId - The user ID
 * @param {Map} activityDatesMap - Map of dates to activity counts
 */
async function updateUserActivityCalendar(userId, activityDatesMap) {
  try {
    // Convert map to array of objects for activity calendar
    const activityData = Array.from(activityDatesMap.entries()).map(([date, count]) => ({
      date,
      count,
      level: 0 // Let the calendar component calculate levels
    }));

    // Sort by date
    activityData.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate streak data
    const { currentStreak, longestStreak, lastActiveDate, activityDates } = calculateStreakData(activityDatesMap);

    // Update user's activity calendar data
    const activityCalendarRef = doc(db, 'userActivityCalendar', userId);
    const activityCalendarDoc = await getDoc(activityCalendarRef);

    if (activityCalendarDoc.exists()) {
      // Update existing document
      await updateDoc(activityCalendarRef, {
        activityData,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new document
      await setDoc(activityCalendarRef, {
        userId,
        activityData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // Also update the user's streak data
    const streakDocRef = doc(db, 'userStreaks', userId);
    const streakDoc = await getDoc(streakDocRef);

    // Convert activity dates to Firestore Timestamps for storage
    const activityTimestamps = activityDates.map(date => {
      const [year, month, day] = date.split('-').map(Number);
      return Timestamp.fromDate(new Date(year, month - 1, day));
    });

    if (streakDoc.exists()) {
      // Update existing document
      await updateDoc(streakDocRef, {
        currentStreak,
        longestStreak,
        lastActiveDate: lastActiveDate ? Timestamp.fromDate(new Date(lastActiveDate)) : null,
        activityDates: activityTimestamps,
        totalDaysActive: activityDates.length,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new document
      await setDoc(streakDocRef, {
        userId,
        currentStreak,
        longestStreak,
        lastActiveDate: lastActiveDate ? Timestamp.fromDate(new Date(lastActiveDate)) : null,
        activityDates: activityTimestamps,
        totalDaysActive: activityDates.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error(`Error updating activity calendar for user ${userId}:`, error);
  }
}

/**
 * Calculate streak data from activity dates
 *
 * @param {Map} activityDatesMap - Map of dates to activity counts
 * @returns {Object} - Streak data
 */
function calculateStreakData(activityDatesMap) {
  // Convert map keys to array of dates
  const activityDates = Array.from(activityDatesMap.keys()).sort();

  if (activityDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      activityDates: []
    };
  }

  // Calculate longest streak
  let currentStreak = 1;
  let longestStreak = 1;
  let lastDate = new Date(activityDates[0]);

  for (let i = 1; i < activityDates.length; i++) {
    const currentDate = new Date(activityDates[i]);
    const dayDiff = Math.floor((currentDate - lastDate) / (24 * 60 * 60 * 1000));

    if (dayDiff === 1) {
      // Consecutive day
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (dayDiff > 1) {
      // Streak broken
      currentStreak = 1;
    }

    lastDate = currentDate;
  }

  // Calculate if current streak is still active
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastActivityDate = activityDates[activityDates.length - 1];
  const lastActivityDateTime = new Date(lastActivityDate);

  const isActiveToday = lastActivityDateTime.getTime() === today.getTime();
  const isActiveYesterday = lastActivityDateTime.getTime() === yesterday.getTime();

  // If not active today or yesterday, current streak is broken
  if (!isActiveToday && !isActiveYesterday) {
    currentStreak = 0;
  }

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: lastActivityDate,
    activityDates
  };
}
