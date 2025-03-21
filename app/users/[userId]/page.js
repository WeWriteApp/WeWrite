"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { getDatabase, ref, get } from "firebase/database";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import ActivityCard from "../../components/ActivityCard";
import { Loader, User } from "lucide-react";

export default function UserProfilePage() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const rtdb = getDatabase();
        const userRef = ref(rtdb, `users/${userId}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          setUser(snapshot.val());
        } else {
          setError("User not found");
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Error loading user data");
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  // Fetch user's recent activities
  useEffect(() => {
    const fetchUserActivities = async () => {
      try {
        setActivityLoading(true);
        
        // Get pages where user has contributed
        const pagesQuery = query(
          collection(db, "pages"),
          where("contributors", "array-contains", userId)
        );
        
        const pagesSnapshot = await getDocs(pagesQuery);
        
        if (pagesSnapshot.empty) {
          setActivities([]);
          return;
        }
        
        // Process each page to get versions by this user
        const activitiesPromises = pagesSnapshot.docs.map(async (doc) => {
          const pageData = { id: doc.id, ...doc.data() };
          
          // Get versions collection for this page
          const versionsQuery = query(
            collection(db, "pages", pageData.id, "versions"),
            where("userId", "==", userId)
          );
          
          const versionsSnapshot = await getDocs(versionsQuery);
          
          if (versionsSnapshot.empty) {
            return [];
          }
          
          // Convert to activity objects
          return versionsSnapshot.docs.map((versionDoc) => {
            const versionData = versionDoc.data();
            return {
              pageId: pageData.id,
              pageTitle: pageData.title || "Untitled Page",
              lastModified: versionData.createdAt?.toDate ? 
                versionData.createdAt.toDate() : 
                (versionData.createdAt ? new Date(versionData.createdAt) : new Date()),
              currentContent: versionData.content || "",
              previousContent: "", // We don't have previous content in this context
              editedBy: user?.username || user?.displayName || "Unknown",
              userId: userId,
              isPublic: pageData.isPublic || false,
              versionId: versionDoc.id
            };
          });
        });
        
        const activitiesArrays = await Promise.all(activitiesPromises);
        
        // Flatten arrays and sort by date
        const flattenedActivities = activitiesArrays
          .flat()
          .sort((a, b) => b.lastModified - a.lastModified)
          .slice(0, 10); // Limit to 10 most recent
        
        setActivities(flattenedActivities);
      } catch (err) {
        console.error("Error fetching user activities:", err);
      } finally {
        setActivityLoading(false);
      }
    };

    if (userId && !loading && user) {
      fetchUserActivities();
    }
  }, [userId, loading, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-xl font-semibold text-red-500 mb-2">{error}</div>
        <p className="text-muted-foreground">The user you're looking for might not exist.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-xl font-semibold mb-2">User not found</div>
        <p className="text-muted-foreground">The user you're looking for might not exist.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
        <div className="bg-primary/10 rounded-full p-6 flex items-center justify-center">
          <User className="h-12 w-12 text-primary" />
        </div>
        
        <div>
          <h1 className="text-3xl font-bold">{user.username || user.displayName}</h1>
          {user.email && <p className="text-muted-foreground">{user.email}</p>}
          {user.bio && <p className="mt-2">{user.bio}</p>}
          <div className="flex gap-4 mt-4">
            <div>
              <span className="text-lg font-semibold">{activities.length}</span>
              <span className="text-muted-foreground ml-1">contributions</span>
            </div>
            <div>
              <span className="text-lg font-semibold">{user.pagesCreated || 0}</span>
              <span className="text-muted-foreground ml-1">pages created</span>
            </div>
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
        </TabsList>
        
        <TabsContent value="activity" className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          
          {activityLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          
          {!activityLoading && activities.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No activity found for this user.
            </div>
          )}
          
          {!activityLoading && activities.length > 0 && (
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <ActivityCard key={`${activity.pageId}-${activity.versionId || index}`} activity={activity} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="pages" className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Pages</h2>
          <div className="text-center py-8 text-muted-foreground">
            Page listing coming soon.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
