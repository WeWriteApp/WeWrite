import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../firebase/config";

/**
 * Debug utility to check recent activity in the database
 * This helps identify if the sparkline issue is due to lack of data or data processing problems
 */
export const debugRecentActivity = async () => {
  try {
    console.log('=== DEBUG: Checking recent activity in database ===');
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    console.log('Current time:', now.toISOString());
    console.log('24 hours ago:', twentyFourHoursAgo.toISOString());
    
    // Check recent pages with both Timestamp and ISO string queries
    console.log('\n--- Checking recent pages (Timestamp query) ---');
    try {
      const recentPagesQuery = query(
        collection(db, "pages"),
        where("lastModified", ">=", Timestamp.fromDate(twentyFourHoursAgo)),
        orderBy("lastModified", "desc"),
        limit(20)
      );
      
      const recentPagesSnapshot = await getDocs(recentPagesQuery);
      console.log(`Found ${recentPagesSnapshot.size} recent pages (Timestamp query)`);
      
      recentPagesSnapshot.forEach((doc, index) => {
        const data = doc.data();
        const lastModified = data.lastModified instanceof Timestamp 
          ? data.lastModified.toDate() 
          : new Date(data.lastModified);
        
        console.log(`${index + 1}. Page ${doc.id} by ${data.userId} - ${data.title} - Modified: ${lastModified.toISOString()}`);
      });
    } catch (timestampError) {
      console.log('Timestamp query failed:', timestampError.message);
    }
    
    console.log('\n--- Checking recent pages (ISO string query) ---');
    try {
      const recentPagesQueryISO = query(
        collection(db, "pages"),
        where("lastModified", ">=", twentyFourHoursAgo.toISOString()),
        orderBy("lastModified", "desc"),
        limit(20)
      );
      
      const recentPagesSnapshotISO = await getDocs(recentPagesQueryISO);
      console.log(`Found ${recentPagesSnapshotISO.size} recent pages (ISO string query)`);
      
      recentPagesSnapshotISO.forEach((doc, index) => {
        const data = doc.data();
        const lastModified = data.lastModified instanceof Timestamp 
          ? data.lastModified.toDate() 
          : new Date(data.lastModified);
        
        console.log(`${index + 1}. Page ${doc.id} by ${data.userId} - ${data.title} - Modified: ${lastModified.toISOString()}`);
      });
    } catch (isoError) {
      console.log('ISO string query failed:', isoError.message);
    }
    
    // Check all pages to see lastModified format
    console.log('\n--- Checking lastModified format in recent pages ---');
    const allRecentQuery = query(
      collection(db, "pages"),
      orderBy("lastModified", "desc"),
      limit(10)
    );
    
    const allRecentSnapshot = await getDocs(allRecentQuery);
    console.log(`Checking format of ${allRecentSnapshot.size} most recent pages`);
    
    allRecentSnapshot.forEach((doc, index) => {
      const data = doc.data();
      const lastModified = data.lastModified;
      const type = lastModified instanceof Timestamp ? 'Timestamp' : typeof lastModified;
      
      console.log(`${index + 1}. Page ${doc.id} - lastModified type: ${type}, value: ${lastModified}`);
    });
    
    console.log('\n=== DEBUG: Activity check complete ===');
    
  } catch (error) {
    console.error('Error in debugRecentActivity:', error);
  }
};

/**
 * Debug utility to check a specific user's activity
 */
export const debugUserActivity = async (userId) => {
  try {
    console.log(`=== DEBUG: Checking activity for user ${userId} ===`);
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    // Check user's pages
    const userPagesQuery = query(
      collection(db, "pages"),
      where("userId", "==", userId),
      orderBy("lastModified", "desc"),
      limit(10)
    );
    
    const userPagesSnapshot = await getDocs(userPagesQuery);
    console.log(`User has ${userPagesSnapshot.size} total pages`);
    
    let recentCount = 0;
    userPagesSnapshot.forEach((doc) => {
      const data = doc.data();
      const lastModified = data.lastModified instanceof Timestamp 
        ? data.lastModified.toDate() 
        : new Date(data.lastModified);
      
      const isRecent = lastModified >= twentyFourHoursAgo;
      if (isRecent) recentCount++;
      
      console.log(`Page ${doc.id} - ${data.title} - Modified: ${lastModified.toISOString()} - Recent: ${isRecent}`);
    });
    
    console.log(`User has ${recentCount} pages modified in last 24 hours`);
    console.log(`=== DEBUG: User activity check complete ===`);
    
  } catch (error) {
    console.error('Error in debugUserActivity:', error);
  }
};
