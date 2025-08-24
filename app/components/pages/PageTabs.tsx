"use client";
import React, { useState, useContext, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { DataContext } from "../../providers/DataProvider";
import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from "next/navigation";
import { PillLink, PillLinkSkeleton } from "../utils/PillLink";
import Link from "next/link";
import { Button } from "../ui/button";
import { Loader, Plus, FileText, Clock, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useSwipeable } from "react-swipeable";

const PageSkeletons = ({ count = 8 }) => {
  return (
    <div className="relative">
      <ul className="flex flex-wrap gap-1">
        {Array(count).fill(0).map((_, index) => (
          <li key={`skeleton-${index}`}>
            <PillLinkSkeleton />
          </li>
        ))}
      </ul>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </div>
  );
};

// Wrapper component for animated tabs content
function AnimatedTabsContent({ children }) {
  const [activeTab, setActiveTab] = useState("all");
  const [direction, setDirection] = useState(0);
  
  // Get tab order
  const tabOrder = ["all", "recent", "favorites"];
  
  // Update active tab when tab selection changes
  useEffect(() => {
    const tabsContent = document.querySelector('[data-state="active"]');
    if (tabsContent) {
      const newActiveTab = tabsContent.getAttribute('value');
      if (newActiveTab !== activeTab) {
        // Determine direction based on tab order
        const oldIndex = tabOrder.indexOf(activeTab);
        const newIndex = tabOrder.indexOf(newActiveTab);
        setDirection(newIndex > oldIndex ? 1 : -1);
        setActiveTab(newActiveTab);
      }
    }
  }, [activeTab]);
  
  // Add swipe handlers
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = tabOrder.indexOf(activeTab);
      if (currentIndex < tabOrder.length - 1) {
        const nextTab = tabOrder[currentIndex + 1];
        const tabTrigger = document.querySelector(`[data-state="inactive"][value="${nextTab}"]`);
        if (tabTrigger) tabTrigger.click();
      }
    },
    onSwipedRight: () => {
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
    </div>
  );
}

const PageTabs = () => {
  const { pages, loading, loadMorePages, isMoreLoading, hasMorePages } = useContext(DataContext);
  const { user } = useAuth();
  const router = useRouter();
  const [recentPages, setRecentPages] = useState([]);
  const [favoritePages, setFavoritePages] = useState([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (pages && pages.length > 0) {
      // Get recent pages (last 10 updated)
      const recent = [...pages].sort((a, b) => {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      }).slice(0, 10);
      setRecentPages(recent);

      // For demo purposes, let's just set some random pages as favorites
      // In a real app, this would come from user preferences
      const favorites = pages.filter((_, index) => index % 3 === 0).slice(0, 8);
      setFavoritePages(favorites);
    }
  }, [pages]);

  if (loading) {
    return <PageSkeletons />;
  }

  if (!user) {
    return null;
  }

  const EmptyState = ({ message }) => (
    <div className="flex justify-center">
      <div className="relative bg-background border-2 border-dashed border-border/40 rounded-[24px] p-8 max-w-md w-full text-center">
        <div className="text-foreground text-xl mb-4">
          {message}
        </div>
        <Link href="/pages/new">
          <Button className="rounded-full">
            <Plus className="h-4 w-4 mr-2" />
            Create a new page
          </Button>
        </Link>
      </div>
    </div>
  );

  const PageList = ({ pageList, emptyMessage }) => {
    if (!pageList || pageList.length === 0) {
      return <EmptyState message={emptyMessage} />;
    }

    return (
      <div className="relative">
        <ul className="flex flex-wrap gap-1">
          {pageList.map((page) => (
            <li key={page.id}>
              <PillLink href={`/pages/${page.id}`} label={page.title} />
            </li>
          ))}
        </ul>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </div>
    );
  };

  return (
    <div className="w-full">
      <Tabs defaultValue="all" urlNavigation="hash" className="w-full">
        <div className="relative">
          <TabsList className="relative overflow-x-auto flex w-full justify-start md:justify-center scrollbar-hide">
            <TabsTrigger value="all" className="relative flex-shrink-0">
              <FileText className="h-4 w-4 mr-2" />
              All Pages
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
            </TabsTrigger>
            <TabsTrigger value="recent" className="relative flex-shrink-0">
              <Clock className="h-4 w-4 mr-2" />
              Recent
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </TabsTrigger>
            <TabsTrigger value="favorites" className="relative flex-shrink-0">
              <Star className="h-4 w-4 mr-2" />
              Favorites
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
                animate={{ opacity: 0 }}
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
        
        <TabsContent value="all" className="space-y-4 mt-4">
          <PageList
            pageList={pages}
            emptyMessage="You don't have any pages yet!"
          />

          {hasMorePages && (
            <div className="flex justify-center mt-4">
              <Button
                variant="secondary"
                onClick={loadMorePages}
                disabled={isMoreLoading}
                className="rounded-full"
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
        </TabsContent>

        <TabsContent value="recent" className="space-y-4 mt-4">
          <PageList
            pageList={recentPages}
            emptyMessage="No recent pages found."
          />
        </TabsContent>

        <TabsContent value="favorites" className="space-y-4 mt-4">
          <PageList
            pageList={favoritePages}
            emptyMessage="You haven't favorited any pages yet."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PageTabs;