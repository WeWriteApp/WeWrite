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
 * Calculate streaks from past activity data
 * This script analyzes page versions and follows to calculate user streaks
 */
export async function calculatePastStreaks() {
  try {
    console.log('Starting past streak calculation...');
    
    // Get all pages to analyze versions
    const pagesRef = collection(db, 'pages');
    const pagesSnapshot = await getDocs(pagesRef);
    
    // Map to store user activity dates
    const userActivityMap = new Map();
    
    // Process all pages and their versions
    console.log(`Processing ${pagesSnapshot.size} pages for version history...`);
    
    let processedPages = 0;
    for (const pageDoc of pagesSnapshot.docs) {
      const pageData = pageDoc.data();
      const userId = pageData.userId;
      
      if (!userId) continue;
      
      // Get all versions for this page
      const versionsRef = collection(db, 'pages', pageDoc.id, 'versions');
      const versionsQuery = query(versionsRef, orderBy('createdAt', 'asc'));
      const versionsSnapshot = await getDocs(versionsQuery);
      
      // Process each version
      for (const versionDoc of versionsSnapshot.docs) {
        const versionData = versionDoc.data();
        const createdAt = versionData.createdAt;
        
        if (!createdAt) continue;
        
        // Convert to Date object if it's a Timestamp
        let activityDate;
        if (typeof createdAt === 'object' && createdAt.toDate) {
          activityDate = createdAt.toDate();
        } else if (createdAt.seconds && createdAt.nanoseconds) {
          activityDate = new Date(createdAt.seconds * 1000);
        } else {
          activityDate = new Date(createdAt);
        }
        
        // Normalize to midnight UTC
        activityDate.setUTCHours(0, 0, 0, 0);
        
        // Add to user's activity dates
        if (!userActivityMap.has(userId)) {
          userActivityMap.set(userId, new Set());
        }
        userActivityMap.get(userId).add(activityDate.getTime());
      }
      
      processedPages++;
      if (processedPages % 100 === 0) {
        console.log(`Processed ${processedPages} pages...`);
      }
    }
    
    console.log('Finished processing page versions');
    console.log(`Found activity for ${userActivityMap.size} users`);
    
    // Calculate and update streaks for each user
    let processedUsers = 0;
    for (const [userId, activityDatesSet] of userActivityMap.entries()) {
      // Convert Set of timestamps to array of Dates, sorted ascending
      const activityDates = Array.from(activityDatesSet)
        .map(timestamp => new Date(timestamp))
        .sort((a, b) => a - b);
      
      if (activityDates.length === 0) continue;
      
      // Calculate longest streak
      let currentStreak = 1;
      let longestStreak = 1;
      let lastDate = activityDates[0];
      
      for (let i = 1; i < activityDates.length; i++) {
        const currentDate = activityDates[i];
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
      today.setUTCHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const lastActivityDate = activityDates[activityDates.length - 1];
      const isActiveToday = lastActivityDate.getTime() === today.getTime();
      const isActiveYesterday = lastActivityDate.getTime() === yesterday.getTime();
      
      // If not active today or yesterday, current streak is broken
      if (!isActiveToday && !isActiveYesterday) {
        currentStreak = 0;
      }
      
      // Convert activity dates to Firestore Timestamps for storage
      const activityTimestamps = activityDates.map(date => Timestamp.fromDate(date));
      
      // Update or create streak document
      const streakDocRef = doc(db, 'userStreaks', userId);
      const streakDoc = await getDoc(streakDocRef);
      
      if (streakDoc.exists()) {
        // Update existing document
        await updateDoc(streakDocRef, {
          currentStreak,
          longestStreak,
          lastActiveDate: Timestamp.fromDate(lastActivityDate),
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
          lastActiveDate: Timestamp.fromDate(lastActivityDate),
          activityDates: activityTimestamps,
          totalDaysActive: activityDates.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      processedUsers++;
      if (processedUsers % 50 === 0) {
        console.log(`Updated streaks for ${processedUsers} users...`);
      }
    }
    
    console.log(`Successfully updated streaks for ${processedUsers} users`);
    return { success: true, usersProcessed: processedUsers };
  } catch (error) {
    console.error('Error calculating past streaks:', error);
    return { success: false, error: error.message };
  }
}
