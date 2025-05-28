"use client";
import React, { useState, useEffect, useContext } from "react";
import { Clock, AlertTriangle, Info } from "lucide-react";
import { AuthContext } from "../../providers/AuthProvider";
import ActivityCard from "../activity/ActivityCard";
import { Button } from "../ui/button";
import { collection, query, where, orderBy, limit, getDocs, Timestamp, getDoc, doc } from "firebase/firestore";
import { db } from "../../firebase/config";
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
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
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
        console.log("Fetching group activity for group:", group?.id);

        // If no group, return empty array
        if (!group) {
          console.log("No group provided");
          setActivities([]);
          setLoading(false);
          return;
        }

        // Check if group has pages
        if (!group.pages) {
          console.log("Group has no pages property");
          setActivities([]);
          setLoading(false);
          return;
        }

        // Get all page IDs from the group
        const pageIds = Object.keys(group.pages || {});
        console.log(`Found ${pageIds.length} pages in group:`, pageIds);

        if (pageIds.length === 0) {
          console.log("Group has no pages");
          setActivities([]);
          setLoading(false);
          return;
        }

        // Process pages in batches to avoid Firestore limitations (max 10 items in 'in' query)
        const batchSize = 10;
        let allPages = [];

        for (let i = 0; i < pageIds.length; i += batchSize) {
          const batchIds = pageIds.slice(i, i + batchSize);
          console.log(`Processing batch ${i/batchSize + 1} with ${batchIds.length} pages`);

          try {
            // Query pages collection for this batch of pages
            const pagesQuery = query(
              collection(db, "pages"),
              where("__name__", "in", batchIds),
              orderBy("lastModified", "desc")
            );

            const batchSnapshot = await getDocs(pagesQuery);
            console.log(`Batch ${i/batchSize + 1} returned ${batchSnapshot.size} pages`);

            // Add pages from this batch to our collection
            batchSnapshot.forEach(doc => {
              allPages.push({
                id: doc.id,
                ...doc.data()
              });
            });
          } catch (batchErr) {
            console.error(`Error fetching batch ${i/batchSize + 1}:`, batchErr);
            // Continue with next batch instead of failing completely
          }
        }

        console.log(`Total pages fetched: ${allPages.length}`);

        if (allPages.length === 0) {
          console.log("No pages found in Firestore for this group");
          setActivities([]);
          setLoading(false);
          return;
        }

        // Sort all pages by lastModified (newest first)
        allPages.sort((a, b) => {
          const dateA = a.lastModified instanceof Timestamp
            ? a.lastModified.toDate()
            : new Date(a.lastModified || 0);
          const dateB = b.lastModified instanceof Timestamp
            ? b.lastModified.toDate()
            : new Date(b.lastModified || 0);
          return dateB - dateA;
        });

        // Limit to the number we need
        const limitedPages = allPages.slice(0, limit * 2);
        console.log(`Limited to ${limitedPages.length} most recent pages`);

        // Process the pages into activity items
        const activityPromises = limitedPages.map(async (pageData) => {
          const pageId = pageData.id;

          try {
            // Get username for this page
            const { username } = await getUsernameById(pageData.userId);

            // Format the timestamp
            let timestamp;
            if (pageData.lastModified instanceof Timestamp) {
              timestamp = pageData.lastModified.toDate();
            } else if (typeof pageData.lastModified === 'string') {
              timestamp = new Date(pageData.lastModified);
            } else {
              timestamp = new Date();
            }

            return {
              pageId,
              pageName: pageData.title || "Untitled",
              userId: pageData.userId,
              username: username || "Unknown User",
              timestamp: timestamp,
              isNewPage: false,
              currentContent: pageData.content,
              previousContent: null,
              versionId: null,
              isPublic: pageData.isPublic,
              groupId: group.id,
              groupName: group.name
            };
          } catch (err) {
            console.error(`Error processing page ${pageId}:`, err);
            return null;
          }
        });

        const activityItems = await Promise.all(activityPromises);

        // Filter out null items (from errors)
        const validActivityItems = activityItems.filter(item => item !== null);
        console.log(`Valid activity items: ${validActivityItems.length}`);

        // Sort by timestamp (newest first)
        const sortedActivities = validActivityItems.sort((a, b) => {
          const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp || 0);
          const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp || 0);
          return dateB - dateA;
        });

        // Limit to requested number
        const limitedActivities = sortedActivities.slice(0, limit);
        console.log(`Final activities count: ${limitedActivities.length}`);

        setActivities(limitedActivities);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map((activity, index) => (
            <div key={`${activity.pageId}-${index}`} className="min-h-[180px] md:h-[200px]">
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
