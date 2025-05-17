"use client";
import React, { useState, useRef, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { FileText, Users, Info, Plus, Loader } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import GroupAboutTab from "./GroupAboutTab";
import GroupPagesTab from "./GroupPagesTab";
import GroupMembersTab from "./GroupMembersTab";

export default function GroupProfileTabs({ group, isOwner, isMember, canEdit }) {
  const [activeTab, setActiveTab] = useState("about");
  const [direction, setDirection] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const tabsRef = useRef(null);
  const [tabsOriginalTop, setTabsOriginalTop] = useState(0);
  const [tabsHeight, setTabsHeight] = useState(0);
  const [isTabsSticky, setIsTabsSticky] = useState(false);

  // Function to handle tab change
  const handleTabChange = (value) => {
    // Determine the direction of the tab change for animation
    const tabValues = ["about", "pages", "members"];
    const currentIndex = tabValues.indexOf(activeTab);
    const newIndex = tabValues.indexOf(value);

    if (newIndex > currentIndex) {
      setDirection(-1); // Moving right
    } else if (newIndex < currentIndex) {
      setDirection(1); // Moving left
    }

    setActiveTab(value);
    scrollTabIntoView(value);
  };

  // Function to scroll the selected tab into view
  const scrollTabIntoView = (tabValue) => {
    setTimeout(() => {
      const tabElement = document.querySelector(`[data-value="${tabValue}"]`);
      if (!tabElement) return;

      const scrollContainer = document.querySelector('.overflow-x-auto');
      if (!scrollContainer) return;

      const tabRect = tabElement.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      const tabCenter = tabRect.left + tabRect.width / 2;
      const containerCenter = containerRect.left + containerRect.width / 2;
      const scrollOffset = tabCenter - containerCenter;

      scrollContainer.scrollBy({
        left: scrollOffset,
        behavior: 'smooth'
      });
    }, 100);
  };

  // Touch event handlers for swipe navigation
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);

    if (touchStart && touchEnd) {
      const distance = touchEnd - touchStart;
      setIsDragging(true);
      setDragX(distance);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchEnd - touchStart;
    const isLeftSwipe = distance < -50;
    const isRightSwipe = distance > 50;

    const tabValues = ["about", "pages", "members"];
    const currentIndex = tabValues.indexOf(activeTab);

    if (isLeftSwipe && currentIndex < tabValues.length - 1) {
      // Swipe left, go to next tab
      handleTabChange(tabValues[currentIndex + 1]);
    } else if (isRightSwipe && currentIndex > 0) {
      // Swipe right, go to previous tab
      handleTabChange(tabValues[currentIndex - 1]);
    }

    setIsDragging(false);
    setDragX(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Handle scroll to make tabs sticky using a different approach
  // that avoids conflicts with Next.js auto-scroll behavior
  useEffect(() => {
    const handleScroll = () => {
      if (!tabsOriginalTop) return;

      const scrollY = window.scrollY;
      const shouldBeSticky = scrollY > tabsOriginalTop;

      if (shouldBeSticky !== isTabsSticky) {
        setIsTabsSticky(shouldBeSticky);
      }
    };

    // Initial check after a short delay to ensure DOM is ready
    setTimeout(() => {
      const tabsElement = document.getElementById('group-tabs-header');
      if (tabsElement) {
        const tabsRect = tabsElement.getBoundingClientRect();
        setTabsOriginalTop(tabsRect.top + window.scrollY);
        setTabsHeight(tabsRect.height);
      }
    }, 100);

    // Use passive event listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [tabsOriginalTop, isTabsSticky]);

  // Scroll active tab into view when component mounts or active tab changes
  useEffect(() => {
    setTimeout(() => {
      scrollTabIntoView(activeTab);
    }, 300);
  }, [activeTab]);

  return (
    <div className="mt-6">
      {/* Add a spacer div that takes up space when tabs are sticky */}
      {isTabsSticky && (
        <div style={{ height: `${tabsHeight}px` }} className="w-full" />
      )}
      <Tabs
        defaultValue="about"
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <div
          id="group-tabs-header"
          className={`border-b border-border/40 mb-4 bg-background z-10 ${
            isTabsSticky ? 'shadow-sm group-tabs-header-sticky' : ''
          }`}
          style={{
            position: 'relative', // Always use relative positioning to avoid Next.js scroll issues
            width: '100%'
          }}
        >
          <div className="overflow-x-auto scrollbar-hide pb-0.5">
            <TabsList className="flex w-max border-0 bg-transparent p-0 justify-start h-auto min-h-0">
              <TabsTrigger
                value="about"
                data-value="about"
                className="flex items-center gap-1.5 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
              >
                <Info className="h-4 w-4" />
                <span>About</span>
              </TabsTrigger>
              <TabsTrigger
                value="pages"
                data-value="pages"
                className="flex items-center gap-1.5 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
              >
                <FileText className="h-4 w-4" />
                <span>Pages</span>
              </TabsTrigger>
              <TabsTrigger
                value="members"
                data-value="members"
                className="flex items-center gap-1.5 px-4 py-3 whitespace-nowrap border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary font-medium transition-all"
              >
                <Users className="h-4 w-4" />
                <span>Members</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div
          id="tabs-content-container"
          className="mt-4"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <TabsContent
            value="about"
            className={`mt-0 transition-all duration-300 ${
              activeTab === "about"
                ? "block"
                : "hidden"
            }`}
          >
            <GroupAboutTab group={group} canEdit={canEdit} />
          </TabsContent>

          <TabsContent
            value="pages"
            className={`mt-0 transition-all duration-300 ${
              activeTab === "pages"
                ? "block"
                : "hidden"
            }`}
          >
            <GroupPagesTab group={group} isOwner={isOwner} isMember={isMember} />
          </TabsContent>

          <TabsContent
            value="members"
            className={`mt-0 transition-all duration-300 ${
              activeTab === "members"
                ? "block"
                : "hidden"
            }`}
          >
            <GroupMembersTab group={group} isOwner={isOwner} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
