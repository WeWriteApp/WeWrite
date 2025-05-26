"use client";
import React, { useState, useContext, useRef } from "react";
import { PillLink } from "./PillLink";
import { Button } from "./ui/button";
import SupporterBadge from "./SupporterBadge";
import { User, Clock, FileText, Lock, Plus, Loader, Info, Users, BookText, Heart } from "lucide-react";
import { AuthContext } from "../providers/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfilePagesContext } from "../providers/ProfilePageProvider";
import RecentActivity from "./RecentActivity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import usePages from "../hooks/usePages";
import UsernameHistory from "./UsernameHistory";
import FollowingList from "./FollowingList";
import TypeaheadSearch from "./TypeaheadSearch";
import UserBioTab from "./UserBioTab";
import { useFeatureFlag } from "../utils/feature-flags";
import FollowingTabContent from "./FollowingTabContent";



// Component to display a list of pages
function PageList({ pageList, emptyMessage, isCurrentUserList = false }) {
  // Get the profile from the parent component context
  const { profile } = useContext(ProfilePagesContext);
  // Check if user is a supporter
  const isSupporter = profile?.tier ? true : false;
  if (!pageList || pageList.length === 0) {
    return <div className="text-center text-muted-foreground py-8">{emptyMessage}</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 justify-start items-start content-start mt-4">
        {pageList.map((page) => (
          <div key={page.id} className="flex-none max-w-full">
            <PillLink
              href={`/${page.id}`}
              variant="primary"
              isPublic={page.isPublic}
              className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px]"
              // Always show the actual title for private pages when viewing your own list
              isOwned={isCurrentUserList}
            >
              {page.title || "Untitled"}
            </PillLink>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UserProfileTabs({ profile }) {
  const [activeTab, setActiveTab] = useState("bio"); // Changed default tab to "bio"
  const [direction, setDirection] = useState(0); // -1 for right, 1 for left
  const { user } = useContext(AuthContext);
  const isCurrentUser = user && profile && user.uid === profile.uid;
  const [loadingError, setLoadingError] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const tabsRef = useRef(null);

  // Check if groups feature is enabled
  const groupsEnabled = useFeatureFlag('groups', user?.email);

  // Use the usePages hook to get the user's pages
  const {
    pages,
    privatePages,
    loading: isLoading,
    hasMorePages,
    hasMorePrivatePages,
    isMoreLoading,
    isMorePrivateLoading,
    fetchMorePages,
    fetchMorePrivatePages
  } = usePages(profile?.uid, true, user?.uid, true); // Pass isUserPage=true to use higher limit

  // Determine which tabs to show in the requested order
  const visibleTabs = ["bio", "pages", "activity"];

  // Add groups tab only if the feature is enabled
  if (groupsEnabled) {
    visibleTabs.push("groups");
  }

  // Add following tab only for the current user (privacy restriction)
  if (isCurrentUser) {
    visibleTabs.push("following");
    visibleTabs.push("private");
  }

  // Function to scroll the selected tab into view
  const scrollTabIntoView = (tabValue) => {
    // Wait a tiny bit to ensure DOM is ready
    setTimeout(() => {
      // Find the tab element
      const tabElement = document.querySelector(`[data-value="${tabValue}"]`);
      if (!tabElement) return;

      // Find the scrollable container
      const scrollContainer = document.querySelector('.overflow-x-auto');
      if (!scrollContainer) return;

      // Get the positions and dimensions
      const tabRect = tabElement.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      // Calculate the center position for the tab
      const tabCenter = tabRect.left + tabRect.width / 2;
      const containerCenter = containerRect.left + containerRect.width / 2;

      // Calculate how much to scroll to center the tab
      const scrollOffset = tabCenter - containerCenter;

      // Calculate the target scroll position
      const targetScrollLeft = scrollContainer.scrollLeft + scrollOffset;

      // Animate the scroll with custom easing
      const startTime = performance.now();
      const startScrollLeft = scrollContainer.scrollLeft;
      const duration = 300; // 300ms animation

      const animateScroll = (currentTime) => {
        const elapsedTime = currentTime - startTime;
        if (elapsedTime >= duration) {
          scrollContainer.scrollLeft = targetScrollLeft;
          return;
        }

        // Ease-out function: cubic
        const progress = 1 - Math.pow(1 - elapsedTime / duration, 3);
        scrollContainer.scrollLeft = startScrollLeft + (scrollOffset * progress);
        requestAnimationFrame(animateScroll);
      };

      requestAnimationFrame(animateScroll);
    }, 10);
  };

  // Handle tab changes with enhanced slide animation
  const handleTabChange = (newTab) => {
    const currentIndex = visibleTabs.indexOf(activeTab);
    const newIndex = visibleTabs.indexOf(newTab);

    // Set direction for animation
    let animationDirection = 0;
    if (newIndex > currentIndex) {
      animationDirection = 1; // Moving right
    } else if (newIndex < currentIndex) {
      animationDirection = -1; // Moving left
    }
    setDirection(animationDirection);

    // Apply enhanced slide animation
    const contentContainer = document.getElementById('tabs-content-container');
    if (contentContainer && animationDirection !== 0) {
      // Start the slide animation
      contentContainer.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      contentContainer.style.transform = `translateX(${animationDirection * -20}px)`;
      contentContainer.style.opacity = '0.8';

      // Scroll the tab into view
      scrollTabIntoView(newTab);

      setTimeout(() => {
        setActiveTab(newTab);
        // Slide back to center with new content
        contentContainer.style.transform = 'translateX(0)';
        contentContainer.style.opacity = '1';

        // Clean up transition after animation
        setTimeout(() => {
          contentContainer.style.transition = '';
        }, 300);
      }, 150);
    } else {
      setActiveTab(newTab);
      scrollTabIntoView(newTab);
    }
  };

  // Handle touch events for swipe
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
    setDragX(0);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;

    const currentX = e.targetTouches[0].clientX;
    setTouchEnd(currentX);

    // Calculate drag distance
    const dragDistance = currentX - touchStart;
    setDragX(dragDistance);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsDragging(false);
      setDragX(0);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe || isRightSwipe) {
      const currentIndex = visibleTabs.indexOf(activeTab);

      if (isLeftSwipe && currentIndex < visibleTabs.length - 1) {
        // Swipe left to go to next tab
        setDirection(1);
        handleTabChange(visibleTabs[currentIndex + 1]);
      } else if (isRightSwipe && currentIndex > 0) {
        // Swipe right to go to previous tab
        setDirection(-1);
        handleTabChange(visibleTabs[currentIndex - 1]);
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setDragX(0);
  };

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

  // Removed unfollow all function

  // Use useEffect to handle sticky tabs
  React.useEffect(() => {
    // Store the original position of the tabs
    let tabsOriginalTop = 0;
    let tabsHeight = 0;
    let isSticky = false;

    const handleScroll = () => {
      const tabsElement = document.getElementById('profile-tabs-header');
      const contentContainer = document.getElementById('tabs-content-container');
      if (!tabsElement || !contentContainer) return;

      // Get the original position on first scroll if not already set
      if (tabsOriginalTop === 0) {
        const tabsRect = tabsElement.getBoundingClientRect();
        tabsOriginalTop = tabsRect.top + window.scrollY;
        tabsHeight = tabsRect.height;
      }

      // Check if we've scrolled past the original position of the tabs
      const scrollPosition = window.scrollY;

      if (scrollPosition >= tabsOriginalTop && !isSticky) {
        // We've scrolled past the tabs, make them sticky
        tabsElement.classList.add('sticky-tabs');
        contentContainer.style.paddingTop = `${tabsHeight}px`;
        isSticky = true;
      } else if (scrollPosition < tabsOriginalTop && isSticky) {
        // We've scrolled back up, remove sticky
        tabsElement.classList.remove('sticky-tabs');
        contentContainer.style.paddingTop = '0';
        isSticky = false;
      }
    };

    // Initial check after a short delay to ensure DOM is ready
    setTimeout(() => {
      const tabsElement = document.getElementById('profile-tabs-header');
      if (tabsElement) {
        const tabsRect = tabsElement.getBoundingClientRect();
        tabsOriginalTop = tabsRect.top + window.scrollY;
        tabsHeight = tabsRect.height;
      }
    }, 100);

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Use useEffect to scroll the active tab into view when the component mounts or active tab changes
  React.useEffect(() => {
    // Wait a short delay to ensure the DOM is fully rendered
    setTimeout(() => {
      scrollTabIntoView(activeTab);
    }, 300);
  }, [activeTab]);

  return (
    <div className="mt-6">
      <Tabs
        defaultValue="bio"
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <div id="profile-tabs-header" className="relative border-b border-border/40 mb-4 bg-background z-10">
          <div className="overflow-x-auto scrollbar-hide pb-0.5">
            <TabsList className="flex w-max border-0 bg-transparent p-0 justify-start h-auto min-h-0">
              {/* Bio tab (first/default) */}
              <TabsTrigger
                value="bio"
                data-value="bio"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <BookText className="h-4 w-4" />
                <span>Bio</span>
              </TabsTrigger>

              {/* Pages tab */}
              <TabsTrigger
                value="pages"
                data-value="pages"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <FileText className="h-4 w-4" />
                <span>Pages</span>
              </TabsTrigger>

              {/* Activity tab */}
              <TabsTrigger
                value="activity"
                data-value="activity"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <Clock className="h-4 w-4" />
                <span>Activity</span>
              </TabsTrigger>

              {/* Groups tab - only if feature is enabled */}
              {groupsEnabled && (
                <TabsTrigger
                  value="groups"
                  data-value="groups"
                  className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
                >
                  <Users className="h-4 w-4" />
                  <span>Groups</span>
                </TabsTrigger>
              )}

              {/* Following tab - only for current user */}
              {isCurrentUser && (
                <TabsTrigger
                  value="following"
                  data-value="following"
                  className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
                >
                  <Heart className="h-4 w-4" />
                  <span>Following</span>
                </TabsTrigger>
              )}

              {/* Private tab - only for current user */}
              {isCurrentUser && (
                <TabsTrigger
                  value="private"
                  data-value="private"
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

        <div
          id="tabs-content-container"
          className="mt-4"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <TabsContent
            value="activity"
            className={`mt-0 transition-all duration-300 ${
              activeTab === "activity"
                ? "block"
                : "hidden"
            }`}
          >
            <RecentActivity limit={10} showViewAll={false} userId={profile?.uid} />
          </TabsContent>

          <TabsContent
            value="bio"
            className={`mt-0 transition-all duration-300 ${
              activeTab === "bio"
                ? "block"
                : "hidden"
            }`}
          >
            <UserBioTab profile={profile} />
          </TabsContent>

          <TabsContent
            value="pages"
            className={`mt-0 transition-all duration-300 ${
              activeTab === "pages"
                ? "block"
                : "hidden"
            }`}
          >
            <div className="mb-4">
              <TypeaheadSearch
                userId={profile?.uid}
                placeholder={`Search ${profile?.username || 'user'}'s pages...`}
              />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <PageList pageList={pages} emptyMessage="No public pages yet" isCurrentUserList={isCurrentUser} />
                {loadingError && (
                  <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    {loadingError}
                  </div>
                )}
                {hasMorePages && (
                  <div className="flex justify-center mt-6">
                    <Button
                      variant="outline"
                      size="default"
                      onClick={loadMorePages}
                      disabled={isMoreLoading}
                      className="gap-2 rounded-lg px-4 py-2 shadow-sm hover:shadow transition-all duration-200"
                    >
                      {isMoreLoading ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Load more pages
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {isCurrentUser && (
            <TabsContent
              value="following"
              className={`mt-0 transition-all duration-300 ${
                activeTab === "following"
                  ? "block"
                  : "hidden"
              }`}
            >
              <FollowingTabContent userId={profile?.uid} isCurrentUser={isCurrentUser} />
            </TabsContent>
          )}

          {/* Groups tab content - only shown if feature is enabled */}
          {groupsEnabled && (
            <TabsContent
              value="groups"
              className={`mt-0 transition-all duration-300 ${
                activeTab === "groups"
                  ? "block"
                  : "hidden"
              }`}
            >
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">User Groups</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-4">
                  {isCurrentUser
                    ? "Groups that you belong to will appear here."
                    : `Only public groups that ${profile?.username || 'this user'} belongs to will be visible here.`}
                </p>
                {isCurrentUser && (
                  <Link href="/groups">
                    <Button variant="outline" className="gap-2">
                      <Users className="h-4 w-4" />
                      View My Groups
                    </Button>
                  </Link>
                )}
              </div>
            </TabsContent>
          )}

          {isCurrentUser && (
            <TabsContent
              value="private"
              className={`mt-0 transition-all duration-300 ${
                activeTab === "private"
                  ? "block"
                  : "hidden"
              }`}
            >
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <PageList pageList={privatePages} emptyMessage="No private pages yet" isCurrentUserList={true} />
                  {loadingError && (
                    <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                      {loadingError}
                    </div>
                  )}
                  {hasMorePrivatePages && (
                    <div className="flex justify-center mt-6">
                      <Button
                        variant="outline"
                        size="default"
                        onClick={loadMorePrivatePages}
                        disabled={isMorePrivateLoading}
                        className="gap-2 rounded-lg px-4 py-2 shadow-sm hover:shadow transition-all duration-200"
                      >
                        {isMorePrivateLoading ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Load more private pages
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
