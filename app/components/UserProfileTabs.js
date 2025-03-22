"use client";
import React, { useState, useEffect, useContext } from "react";
import { motion } from "framer-motion";
import { PillLink } from "./PillLink";
import { Button } from "./ui/button";
import { User, Clock, FileText, Lock, Plus, Loader } from "lucide-react";
import { AuthContext } from "../providers/AuthProvider";
import { getUserPages } from "../firebase/database";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfilePagesContext } from "../providers/ProfilePageProvider";
import RecentActivity from "./RecentActivity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      {pageList.map((page) => (
        <PillLink
          key={page.id}
          href={`/pages/${page.id}`}
          label={page.title || "Untitled"}
          description={page.description || "No description"}
          icon={<FileText className="h-4 w-4" />}
        />
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
  const [activeTab, setActiveTab] = useState("bio");
  const [pages, setPages] = useState([]);
  const [privatePages, setPrivatePages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [hasMorePrivatePages, setHasMorePrivatePages] = useState(true);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [isMorePrivateLoading, setIsMorePrivateLoading] = useState(false);
  const { user } = useContext(AuthContext);
  
  const isCurrentUser = user && profile && user.uid === profile.uid;
  
  // Determine which tabs to show
  const visibleTabs = ["bio", "activity", "pages"];
  if (isCurrentUser) {
    visibleTabs.push("private");
  }
  
  // Handle tab changes
  const handleTabChange = (newTab) => setActiveTab(newTab);
  
  // Load user pages
  useEffect(() => {
    const loadPages = async () => {
      if (!profile) return;
      
      try {
        setIsLoading(true);
        const publicPages = await getUserPages(profile.uid, 0, 10, false);
        setPages(publicPages);
        setHasMorePages(publicPages.length === 10);
        
        if (isCurrentUser) {
          const privatePages = await getUserPages(profile.uid, 0, 10, true);
          setPrivatePages(privatePages);
          setHasMorePrivatePages(privatePages.length === 10);
        }
      } catch (error) {
        console.error("Error loading pages:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPages();
  }, [profile, isCurrentUser]);
  
  // Load more pages
  const loadMorePages = async () => {
    if (!profile || isMoreLoading) return;
    
    try {
      setIsMoreLoading(true);
      const morePages = await getUserPages(profile.uid, pages.length, 10, false);
      setPages([...pages, ...morePages]);
      setHasMorePages(morePages.length === 10);
    } catch (error) {
      console.error("Error loading more pages:", error);
    } finally {
      setIsMoreLoading(false);
    }
  };
  
  // Load more private pages
  const loadMorePrivatePages = async () => {
    if (!profile || !isCurrentUser || isMorePrivateLoading) return;
    
    try {
      setIsMorePrivateLoading(true);
      const morePrivatePages = await getUserPages(profile.uid, privatePages.length, 10, true);
      setPrivatePages([...privatePages, ...morePrivatePages]);
      setHasMorePrivatePages(morePrivatePages.length === 10);
    } catch (error) {
      console.error("Error loading more private pages:", error);
    } finally {
      setIsMorePrivateLoading(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full h-auto bg-transparent border-b border-border/40 rounded-none p-0 justify-start overflow-x-auto hide-scrollbar">
          {visibleTabs.map((tab) => (
            <TabsTrigger 
              key={tab} 
              value={tab}
              className="px-4 py-3 font-medium text-sm relative whitespace-nowrap data-[state=active]:text-primary data-[state=active]:font-semibold"
            >
              <div className="flex items-center gap-1.5">
                {tab === "bio" && <User className="h-4 w-4" />}
                {tab === "activity" && <Clock className="h-4 w-4" />}
                {tab === "pages" && <FileText className="h-4 w-4" />}
                {tab === "private" && <Lock className="h-4 w-4" />}
                
                {tab === "bio" && "Bio"}
                {tab === "activity" && "Activity"}
                {tab === "pages" && `Pages (${pages ? pages.length : 0})`}
                {tab === "private" && `Private (${privatePages ? privatePages.length : 0})`}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>
        
        <div className="overflow-hidden mt-4">
          <TabsContent value="bio" className="mt-0">
            <AnimatedTabsContent activeTab={activeTab}>
              <BioSection />
            </AnimatedTabsContent>
          </TabsContent>
          
          <TabsContent value="activity" className="mt-0">
            <AnimatedTabsContent activeTab={activeTab}>
              <RecentActivity limit={10} showViewAll={false} />
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
          
          <TabsContent value="pages" className="mt-0">
            <AnimatedTabsContent activeTab={activeTab}>
              <PageList pageList={pages} emptyMessage="No pages yet" />
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
            </AnimatedTabsContent>
          </TabsContent>
          
          <TabsContent value="private" className="mt-0">
            <AnimatedTabsContent activeTab={activeTab}>
              <PageList pageList={privatePages} emptyMessage="No private pages" />
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
            </AnimatedTabsContent>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
