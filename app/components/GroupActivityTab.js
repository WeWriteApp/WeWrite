"use client";
import React, { useState, useEffect, useContext } from "react";
import { Clock, AlertTriangle, Info } from "lucide-react";
import { AuthContext } from "../providers/AuthProvider";
import ActivityCard from "./ActivityCard";
import { Button } from "./ui/button";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { getDatabase, ref, get } from "firebase/database";

/**
 * GroupActivityTab Component
 * 
 * Displays recent activity for pages owned by a specific group
 * 
 * @param {Object} props
 * @param {Object} props.group - The group object
 * @param {number} props.limit - Maximum number of activities to display (default: 10)
 */
export default function GroupActivityTab({ group, limit = 10 }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);

  // Helper function to get username from Firestore or RTDB
  const getUsernameById = async (userId) => {
    try {
      if (!userId) return { username: null };

      let username = null;
      
      // Try Firestore first
      const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", userId)));
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        username = userData.username || userData.displayName;
      }

      // Fallback to RTDB if Firestore doesn't have the username
      if (!username) {
        const rtdb = getDatabase();
        const userRef = ref(rtdb, `users/${userId}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();
          username = userData.username || userData.displayName || (userData.email ? userData.email.split('@')[0] : null);
        }
      }

      return { username };
    } catch (err) {
      console.error("Error fetching user data:", err);
      return { username: null };
    }
  };

  // Fetch activity data for the group
  useEffect(() => {
    const fetchGroupActivity = async () => {
      try {
        setLoading(true);
        
        // If no group or no pages, return empty array
        if (!group || !group.pages || Object.keys(group.pages).length === 0) {
          setActivities([]);
          setLoading(false);
          return;
        }

        // Get all page IDs from the group
        const pageIds = Object.keys(group.pages);
        
        // Query pages collection for these pages
        const pagesQuery = query(
          collection(db, "pages"),
          where("__name__", "in", pageIds),
          orderBy("lastModified", "desc"),
          limit(limit * 2) // Fetch more to account for filtering
        );

        const pagesSnapshot = await getDocs(pagesQuery);
        
        if (pagesSnapshot.empty) {
          setActivities([]);
          setLoading(false);
          return;
        }

        // Process the pages into activity items
        const activityPromises = pagesSnapshot.docs.map(async (doc) => {
          const pageData = doc.data();
          const pageId = doc.id;
          
          // Get username for this page
          const { username } = await getUsernameById(pageData.userId);
          
          return {
            pageId,
            pageName: pageData.title || "Untitled",
            userId: pageData.userId,
            username: username || "Unknown User",
            timestamp: pageData.lastModified,
            isNewPage: false, // We don't have this info directly
            currentContent: pageData.content,
            previousContent: null, // We don't have previous content
            versionId: null, // We don't track version IDs directly
            isPublic: pageData.isPublic
          };
        });

        const activityItems = await Promise.all(activityPromises);
        
        // Sort by timestamp (newest first)
        const sortedActivities = activityItems.sort((a, b) => {
          const dateA = a.timestamp instanceof Timestamp 
            ? a.timestamp.toDate() 
            : new Date(a.timestamp);
          const dateB = b.timestamp instanceof Timestamp 
            ? b.timestamp.toDate() 
            : new Date(b.timestamp);
          return dateB - dateA;
        });

        setActivities(sortedActivities.slice(0, limit));
      } catch (err) {
        console.error("Error fetching group activity:", err);
        setError("Failed to load group activity. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchGroupActivity();
  }, [group, limit]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Group Activity</h2>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center">
            <Clock className="h-8 w-8 animate-pulse text-primary mb-4" />
            <p className="text-muted-foreground">Loading activity data...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex items-center gap-2 p-4 text-sm bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg">
          <AlertTriangle className="h-4 w-4" />
          <p>{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && activities.length === 0 && (
        <div className="flex items-center justify-center flex-col py-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No activity yet</h3>
          <p className="text-muted-foreground mb-4">
            When pages in this group are created or edited, activity will appear here.
          </p>
        </div>
      )}

      {/* Activity grid */}
      {!loading && !error && activities.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activities.map((activity, index) => (
            <div key={`${activity.pageId}-${index}`} className="h-[180px]">
              <ActivityCard
                activity={activity}
                isCarousel={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
