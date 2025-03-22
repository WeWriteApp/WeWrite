"use client";
import React, { useState, useEffect, useContext } from "react";
import { motion } from "framer-motion";
import { PillLink } from "./PillLink";
import { Button } from "./ui/button";
import { User, Clock, FileText, Lock, Plus, Loader } from "lucide-react";
import { AuthContext } from "../providers/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfilePagesContext } from "../providers/ProfilePageProvider";
import RecentActivity from "./RecentActivity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import usePages from "../hooks/usePages";

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
    <div className="flex flex-col gap-2 mt-4 w-full max-w-[600px] mx-auto">
      {pageList.map((page) => (
        <Link 
          key={page.id}
          href={`/pages/${page.id}`}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-full transition-colors w-full text-center"
        >
          {page.title || "Untitled"}
        </Link>
      ))}
    </div>
  );
}

// Bio section component
function BioSection() {
  return (
    <div className="prose prose-sm max-w-none">
      <p>
        This is where the user's bio would go. Currently, we don't have a bio field in the user profile.
      </p>
    </div>
  );
}

export default function UserProfileTabs({ profile }) {
  const [activeTab, setActiveTab] = useState("activity");
  const { user } = useContext(AuthContext);
  const isCurrentUser = user && profile && user.uid === profile.uid;
  
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
  const visibleTabs = ["activity", "bio", "pages"];
  if (isCurrentUser) {
    visibleTabs.push("private");
  }
  
  // Handle tab changes
  const handleTabChange = (newTab) => setActiveTab(newTab);
  
  // Load more pages
  const loadMorePages = () => {
    fetchMorePages();
  };
  
  // Load more private pages
  const loadMorePrivatePages = () => {
    fetchMorePrivatePages();
  };

  return (
    <div className="mt-6">
      <Tabs defaultValue="activity" onValueChange={handleTabChange}>
        <TabsList className="grid grid-cols-3 sm:grid-cols-4">
          <TabsTrigger value="activity" className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          
          <TabsTrigger value="bio" className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Bio</span>
          </TabsTrigger>
          
          <TabsTrigger value="pages" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Pages</span>
          </TabsTrigger>
          
          {isCurrentUser && (
            <TabsTrigger value="private" className="flex items-center gap-1">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Private</span>
            </TabsTrigger>
          )}
        </TabsList>
        
        <div className="mt-4">
          <TabsContent value="activity" className="mt-0">
            <AnimatedTabsContent activeTab={activeTab}>
              <RecentActivity limit={10} showViewAll={false} userId={profile?.uid} />
              <div className="flex justify-center mt-4">
                <Button 
                  variant="outline" 
                  className="rounded-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Load more
                </Button>
              </div>
            </AnimatedTabsContent>
          </TabsContent>
          
          <TabsContent value="bio" className="mt-0">
            <AnimatedTabsContent activeTab={activeTab}>
              <BioSection />
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
                  {hasMorePages && (
                    <div className="flex justify-center mt-4">
                      <Button 
                        variant="outline" 
                        className="rounded-full"
                        onClick={loadMorePages}
                        disabled={isMoreLoading}
                      >
                        {isMoreLoading ? (
                          <Loader className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
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
            <TabsContent value="private" className="mt-0">
              <AnimatedTabsContent activeTab={activeTab}>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <PageList pageList={privatePages} emptyMessage="No private pages yet" />
                    {hasMorePrivatePages && (
                      <div className="flex justify-center mt-4">
                        <Button 
                          variant="outline" 
                          className="rounded-full"
                          onClick={loadMorePrivatePages}
                          disabled={isMorePrivateLoading}
                        >
                          {isMorePrivateLoading ? (
                            <Loader className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          Load more
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </AnimatedTabsContent>
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
