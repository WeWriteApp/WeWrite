"use client";
import React, { useState, useEffect, useContext } from "react";
import { motion } from "framer-motion";
import { PillLink } from "./PillLink";
import { Button } from "./ui/button";
import { User, Clock, FileText, Lock, Plus, Loader, Info } from "lucide-react";
import { AuthContext } from "../providers/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfilePagesContext } from "../providers/ProfilePageProvider";
import RecentActivity from "./RecentActivity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import usePages from "../hooks/usePages";
import UsernameHistory from "./UsernameHistory";

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
          <div key={page.id} className="flex-none">
            <PillLink 
              href={`/pages/${page.id}`}
              variant="primary"
              isPublic={page.isPublic}
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
  const visibleTabs = ["activity", "pages", "about"];
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
      <Tabs defaultValue="activity" onValueChange={handleTabChange} className="w-full">
        <div className="relative border-b border-border/40 mb-4">
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="flex w-full min-w-max border-0 bg-transparent p-0 justify-start">
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
              
              <TabsTrigger 
                value="about" 
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <Info className="h-4 w-4" />
                <span>About</span>
              </TabsTrigger>
              
              {isCurrentUser && (
                <TabsTrigger 
                  value="private" 
                  className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
                >
                  <Lock className="h-4 w-4" />
                  <span>Private</span>
                </TabsTrigger>
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
          
          <TabsContent value="about" className="mt-0">
            <AnimatedTabsContent activeTab={activeTab}>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Username History</h3>
                  {/* Debug profile object */}
                  {console.log('Profile in About tab:', profile)}
                  {profile?.uid ? (
                    <UsernameHistory userId={profile.uid} />
                  ) : (
                    <div className="text-center py-8 border border-dashed border-border rounded-lg">
                      <p className="text-muted-foreground">User profile not available.</p>
                    </div>
                  )}
                </div>
              </div>
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
