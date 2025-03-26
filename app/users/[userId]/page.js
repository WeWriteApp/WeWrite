"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { getDatabase, ref, get, update } from "firebase/database";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import ActivityCard from "../../components/ActivityCard";
import { Loader, User, Edit, FileText, History } from "lucide-react";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import Link from "next/link";
import { useAuth } from "../../providers/AuthProvider";
import { toast } from "sonner";
import { Textarea } from "../../components/ui/textarea";
import UsernameHistory from "../../components/UsernameHistory";

export default function UserProfilePage() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user: currentUser } = useAuth();
  const [pages, setPages] = useState([]);
  const [privatePages, setPrivatePages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(true);

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

  // Fetch user's pages (both public and private)
  useEffect(() => {
    const fetchUserPages = async () => {
      try {
        setPagesLoading(true);
        
        // Get pages where user has contributed
        const pagesQuery = query(
          collection(db, "pages"),
          where("contributors", "array-contains", userId)
        );
        
        const pagesSnapshot = await getDocs(pagesQuery);
        
        if (pagesSnapshot.empty) {
          setPages([]);
          setPrivatePages([]);
          return;
        }
        
        const allPages = pagesSnapshot.docs.map(doc => {
          const pageData = { id: doc.id, ...doc.data() };
          return {
            id: doc.id,
            title: pageData.title || "Untitled Page",
            isPublic: pageData.isPublic || false,
            createdAt: pageData.createdAt?.toDate ? 
              pageData.createdAt.toDate() : 
              (pageData.createdAt ? new Date(pageData.createdAt) : new Date()),
            updatedAt: pageData.updatedAt?.toDate ? 
              pageData.updatedAt.toDate() : 
              (pageData.updatedAt ? new Date(pageData.updatedAt) : new Date())
          };
        });
        
        // Sort by updated date
        allPages.sort((a, b) => b.updatedAt - a.updatedAt);
        
        // Split into public and private pages
        setPages(allPages.filter(page => page.isPublic));
        setPrivatePages(allPages.filter(page => !page.isPublic));
      } catch (err) {
        console.error("Error fetching user pages:", err);
      } finally {
        setPagesLoading(false);
      }
    };

    if (userId && !loading && user) {
      fetchUserPages();
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
        <div className="relative">
          <TabsList className="mb-4 relative overflow-x-auto flex w-full justify-start md:justify-center">
            <TabsTrigger value="activity" className="relative flex-shrink-0">
              Activity
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" 
                initial={false}
                animate={{ opacity: activeTab === "activity" ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              />
            </TabsTrigger>
            <TabsTrigger value="pages" className="relative flex-shrink-0">
              Pages
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" 
                initial={false}
                animate={{ opacity: activeTab === "pages" ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              />
            </TabsTrigger>
            {currentUser && currentUser.uid === userId && (
              <TabsTrigger value="privatePages" className="relative flex-shrink-0">
                Private Pages
                <motion.div 
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" 
                  initial={false}
                  animate={{ opacity: activeTab === "privatePages" ? 1 : 0 }}
                  transition={{ duration: 0.2 }}
                />
              </TabsTrigger>
            )}
            <TabsTrigger value="about" className="relative flex-shrink-0">
              About
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" 
                initial={false}
                animate={{ opacity: activeTab === "about" ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              />
            </TabsTrigger>
            <TabsTrigger value="bio" className="relative flex-shrink-0">
              Bio
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" 
                initial={false}
                animate={{ opacity: activeTab === "bio" ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              />
            </TabsTrigger>
          </TabsList>
          
          {/* Swipe indicator - only visible on mobile */}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex items-center gap-1 md:hidden">
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.5,
                delay: 0 
              }}
            />
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.5,
                delay: 0.5 
              }}
            />
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ 
                repeat: Infinity, 
                duration: 1.5,
                delay: 1 
              }}
            />
          </div>
        </div>
        
        <AnimatedTabsContent>
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
            <h2 className="text-xl font-semibold mb-4">Public Pages</h2>
            
            {pagesLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            
            {!pagesLoading && pages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                This user hasn't created any public pages yet.
              </div>
            )}
            
            {!pagesLoading && pages.length > 0 && (
              <div className="space-y-3">
                {pages.map((page) => (
                  <Link 
                    href={`/pages/${page.id}`}
                    key={page.id} 
                    className="block p-4 border border-border rounded-lg hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="font-medium">{page.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Last updated: {new Date(page.updatedAt).toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
          
          {currentUser && currentUser.uid === userId && (
            <TabsContent value="privatePages" className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Private Pages</h2>
              
              {pagesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              
              {!pagesLoading && privatePages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  You haven't created any private pages yet.
                </div>
              )}
              
              {!pagesLoading && privatePages.length > 0 && (
                <div className="space-y-3">
                  {privatePages.map((page) => (
                    <Link 
                      href={`/pages/${page.id}`}
                      key={page.id} 
                      className="block p-4 border border-border rounded-lg hover:bg-accent/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h3 className="font-medium">{page.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Last updated: {new Date(page.updatedAt).toLocaleDateString()}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
          
          <TabsContent value="about" className="space-y-4">
            <div className="flex items-center mb-4">
              <h2 className="text-xl font-semibold">About</h2>
            </div>
            
            <div className="space-y-6">
              <div className="p-4 border border-border rounded-lg bg-card">
                <h3 className="text-lg font-medium mb-4">Username History</h3>
                <UsernameHistory userId={userId} />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="bio" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Bio</h2>
              <BioEditor userId={userId} currentBio={user.bio} />
            </div>
            
            {!user.bio ? (
              <div className="text-center py-8 border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">No bio available.</p>
                {currentUser && currentUser.uid === userId && (
                  <p className="text-sm mt-2">
                    Click the edit button to add your bio.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 border border-border rounded-lg bg-card">
                <p className="whitespace-pre-wrap">{user.bio}</p>
              </div>
            )}
          </TabsContent>
        </AnimatedTabsContent>
      </Tabs>
    </div>
  );
}

// Wrapper component for animated tabs content
function AnimatedTabsContent({ children }) {
  const { user: currentUser } = useAuth();
  const { userId } = useParams();
  const [activeTab, setActiveTab] = useState("activity");
  const [direction, setDirection] = useState(0);
  
  // Get tab order based on whether user is viewing their own profile
  const getTabOrder = useCallback(() => {
    const isOwnProfile = currentUser && currentUser.uid === userId;
    return isOwnProfile 
      ? ["activity", "pages", "privatePages", "about", "bio"] 
      : ["activity", "pages", "about", "bio"];
  }, [currentUser, userId]);
  
  // Update active tab when tab selection changes
  useEffect(() => {
    const tabsContent = document.querySelector('[data-state="active"]');
    if (tabsContent) {
      const newActiveTab = tabsContent.getAttribute('value');
      if (newActiveTab !== activeTab) {
        // Determine direction based on tab order
        const tabOrder = getTabOrder();
        const oldIndex = tabOrder.indexOf(activeTab);
        const newIndex = tabOrder.indexOf(newActiveTab);
        setDirection(newIndex > oldIndex ? 1 : -1);
        setActiveTab(newActiveTab);
      }
    }
  }, [activeTab, getTabOrder]);
  
  // Add swipe handlers
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const tabOrder = getTabOrder();
      const currentIndex = tabOrder.indexOf(activeTab);
      if (currentIndex < tabOrder.length - 1) {
        const nextTab = tabOrder[currentIndex + 1];
        const tabTrigger = document.querySelector(`[data-state="inactive"][value="${nextTab}"]`);
        if (tabTrigger) tabTrigger.click();
      }
    },
    onSwipedRight: () => {
      const tabOrder = getTabOrder();
      const currentIndex = tabOrder.indexOf(activeTab);
      if (currentIndex > 0) {
        const prevTab = tabOrder[currentIndex - 1];
        const tabTrigger = document.querySelector(`[data-state="inactive"][value="${prevTab}"]`);
        if (tabTrigger) tabTrigger.click();
      }
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: false
  });
  
  const variants = {
    enter: (direction) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };
  
  return (
    <div {...handlers} className="overflow-hidden">
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={activeTab}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 }
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Bio editor component
function BioEditor({ userId, currentBio }) {
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(currentBio || "");
  const [isSaving, setIsSaving] = useState(false);
  
  const isCurrentUser = currentUser && currentUser.uid === userId;
  
  const handleSave = async () => {
    if (!isCurrentUser) return;
    
    try {
      setIsSaving(true);
      
      // Update bio in Firestore
      const userDocRef = doc(db, "users", userId);
      await getDoc(userDocRef).then(async (docSnap) => {
        if (docSnap.exists()) {
          await updateDoc(userDocRef, { bio });
        } else {
          await setDoc(userDocRef, { bio });
        }
      });
      
      // Also update in RTDB for backward compatibility
      const rtdb = getDatabase();
      const userRef = ref(rtdb, `users/${userId}`);
      await update(userRef, { bio });
      
      toast({
        title: "Bio updated",
        variant: "success",
        duration: 2000,
      });
      
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating bio:", error);
      toast({
        title: "Error updating bio",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!isCurrentUser) return null;
  
  return (
    <>
      {isEditing ? (
        <div className="w-full mt-2">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Write something about yourself..."
            className="w-full min-h-[150px]"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setBio(currentBio || "");
                setIsEditing(false);
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsEditing(true)}
          className="gap-2"
        >
          <Edit className="h-4 w-4" />
          Edit Bio
        </Button>
      )}
    </>
  );
}
