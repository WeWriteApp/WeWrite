"use client";
import React, { useState, useEffect, useContext } from "react";
import { motion } from "framer-motion";
import { PillLink } from "./PillLink";
import { Button } from "./ui/button";
import { User, Clock, FileText, Lock, Plus, Loader, Info, Heart, UserMinus } from "lucide-react";
import { AuthContext } from "../providers/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfilePagesContext } from "../providers/ProfilePageProvider";
import RecentActivity from "./RecentActivity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import usePages from "../hooks/usePages";
import UsernameHistory from "./UsernameHistory";
import FollowedPages from "./FollowedPages";
import { unfollowAllPagesByUser } from "../firebase/follows";
import { toast } from "sonner";

// Wrapper component for animated tabs content
function AnimatedTabsContent({ children, activeTab }) {
  const variants = {
    enter: {
      opacity: 0
    },
    center: {
      opacity: 1
    },
    exit: {
      opacity: 0
    }
  };

  return (
    <motion.div
      key={activeTab}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{
        opacity: { duration: 0.2 }
      }}
    >
      {children}
    </motion.div>
  );
}

// Component to display a list of pages
function PageList({ pageList, emptyMessage }) {
  if (!pageList || pageList.length === 0) {
    return <div className="text-center text-muted-foreground py-8">{emptyMessage}</div>;
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 justify-start items-start content-start mt-4">
        {pageList.map((page) => (
          <div key={page.id} className="flex-none max-w-full">
            <PillLink
              href={`/pages/${page.id}`}
              variant="primary"
              isPublic={page.isPublic}
              className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
            >
              {page.title || "Untitled"}
            </PillLink>
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
    </div>
  );
}

export default function UserProfileTabs({ profile }) {
  const [activeTab, setActiveTab] = useState("activity");
  const { user } = useContext(AuthContext);
  const isCurrentUser = user && profile && user.uid === profile.uid;
  const [loadingError, setLoadingError] = useState(null);
  const [isUnfollowingAll, setIsUnfollowingAll] = useState(false);

  // Use the usePages hook to get the user's pages
  const {
    pages,
    privatePages,
    loading: isLoading,
    error,
    hasMorePages,
    hasMorePrivatePages,
    isMoreLoading,
    isMorePrivateLoading,
    fetchMorePages,
    fetchMorePrivatePages
  } = usePages(profile?.uid, true, user?.uid);

  // Determine which tabs to show
  const visibleTabs = ["activity", "pages"];
  if (isCurrentUser) {
    visibleTabs.push("private");
    visibleTabs.push("following");
  }

  // Handle tab changes
  const handleTabChange = (newTab) => setActiveTab(newTab);

  // Load more pages with error handling
  const loadMorePages = async () => {
    try {
      setLoadingError(null);
      await fetchMorePages();
    } catch (err) {
      console.error("Error loading more pages:", err);
      setLoadingError("Failed to load more pages. Please try again.");
    }
  };

  // Load more private pages with error handling
  const loadMorePrivatePages = async () => {
    try {
      setLoadingError(null);
      await fetchMorePrivatePages();
    } catch (err) {
      console.error("Error loading more private pages:", err);
      setLoadingError("Failed to load more private pages. Please try again.");
    }
  };

  // Unfollow all self-followed pages
  const handleUnfollowAll = async () => {
    if (!user || !isCurrentUser) return;

    try {
      setIsUnfollowingAll(true);
      const result = await unfollowAllPagesByUser(user.uid);

      if (result.success) {
        if (result.count > 0) {
          toast({
            title: "Pages unfollowed",
            description: `Successfully unfollowed ${result.count} of your own pages`,
            variant: "success"
          });

          // Force refresh the following tab
          if (activeTab === "following") {
            // Switch to another tab and back to trigger a refresh
            setActiveTab("activity");
            setTimeout(() => setActiveTab("following"), 100);
          }
        } else {
          toast({
            title: "No self-follows found",
            description: "You are not following any of your own pages",
            variant: "info"
          });
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to unfollow pages. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error unfollowing all pages:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUnfollowingAll(false);
    }
  };

  return (
    <div className="mt-6">
      <Tabs defaultValue="activity" onValueChange={handleTabChange} className="w-full">
        <div className="relative border-b border-border/40 mb-4">
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="flex w-max border-0 bg-transparent p-0 justify-start">
              <TabsTrigger
                value="activity"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <Clock className="h-4 w-4" />
                <span>Activity</span>
              </TabsTrigger>

              <TabsTrigger
                value="pages"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <FileText className="h-4 w-4" />
                <span>Pages</span>
              </TabsTrigger>

              {isCurrentUser && (
                <>
                  <TabsTrigger
                    value="private"
                    className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Private</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="following"
                    className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
                  >
                    <Heart className="h-4 w-4" />
                    <span>Following</span>
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-border/40"></div>
        </div>

        <div className="mt-4">
          <TabsContent value="activity" className="mt-0">
            <AnimatedTabsContent activeTab={activeTab}>
              <RecentActivity limit={10} showViewAll={false} userId={profile?.uid} />
            </AnimatedTabsContent>
          </TabsContent>

          <TabsContent value="pages" className="mt-0">
            <AnimatedTabsContent activeTab={activeTab}>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <PageList pageList={pages} emptyMessage="No public pages yet" />
                  {loadingError && (
                    <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                      {loadingError}
                    </div>
                  )}
                  {hasMorePages && (
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMorePages}
                        disabled={isMoreLoading}
                        className="gap-2"
                      >
                        {isMoreLoading ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Load more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </AnimatedTabsContent>
          </TabsContent>

          {isCurrentUser && (
            <>
              <TabsContent value="private" className="mt-0">
                <AnimatedTabsContent activeTab={activeTab}>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <PageList pageList={privatePages} emptyMessage="No private pages yet" />
                      {loadingError && (
                        <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                          {loadingError}
                        </div>
                      )}
                      {hasMorePrivatePages && (
                        <div className="flex justify-center mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={loadMorePrivatePages}
                            disabled={isMorePrivateLoading}
                            className="gap-2"
                          >
                            {isMorePrivateLoading ? (
                              <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            Load more
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </AnimatedTabsContent>
              </TabsContent>

              <TabsContent value="following" className="mt-0">
                <AnimatedTabsContent activeTab={activeTab}>
                  <div className="mb-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnfollowAll}
                      disabled={isUnfollowingAll}
                      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {isUnfollowingAll ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserMinus className="h-4 w-4" />
                      )}
                      Unfollow my pages
                    </Button>
                  </div>
                  <FollowedPages userId={profile?.uid} limit={20} />
                </AnimatedTabsContent>
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
