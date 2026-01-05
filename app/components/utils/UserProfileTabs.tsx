"use client";
import React, { useState, useRef, useContext } from "react";
import { Icon } from '@/components/ui/Icon';
import dynamic from "next/dynamic";
import { PillLink } from "./PillLink";
import { Button } from "../ui/button";
import { InlineError } from '../ui/InlineError';
import { useWeWriteAnalytics } from "../../hooks/useWeWriteAnalytics";
import { useAuth } from '../../providers/AuthProvider';
import { ProfilePagesContext } from "../../providers/ProfilePageProvider";
import ActivityFeed from "../features/ActivityFeed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import useUserPages from "../../hooks/useUserPages";
import { Input } from "../ui/input";

import UserBioTab from './UserBioTab';

import { useUnifiedSearch, SEARCH_CONTEXTS } from '../../hooks/useUnifiedSearch';
import { useInfiniteScrollWithLoadMore } from '../../hooks/useInfiniteScroll';
import SearchResultsDisplay from '../search/SearchResultsDisplay';
import { useTabNavigation } from '../../hooks/useTabNavigation';

// PERFORMANCE: Lazy-load heavy tab components to reduce initial bundle size
// These tabs are not visible on initial load, so we can defer their loading
const ExternalLinksTab = dynamic(() => import('./ExternalLinksTab'), {
  ssr: false,
  loading: () => (
    <div className="p-4 animate-pulse">
      <div className="h-6 w-32 bg-muted rounded mb-4" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
      </div>
    </div>
  )
});

const UserGraphTab = dynamic(() => import('./UserGraphTab'), {
  ssr: false,
  loading: () => (
    <div className="p-4 animate-pulse">
      <div className="h-6 w-28 bg-muted rounded mb-4" />
      <div className="h-64 bg-muted rounded" />
    </div>
  )
});

const UserMapTab = dynamic(() => import('./UserMapTab'), {
  ssr: false,
  loading: () => (
    <div className="p-4 animate-pulse">
      <div className="h-6 w-24 bg-muted rounded mb-4" />
      <div className="h-64 bg-muted rounded" />
    </div>
  )
});

const TimelineSection = dynamic(() => import('../timeline/TimelineSection'), {
  ssr: false,
  loading: () => (
    <div className="p-4 animate-pulse">
      <div className="h-6 w-28 bg-muted rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded" />)}
      </div>
    </div>
  )
});
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from "../ui/dropdown-menu";

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
              className="max-w-full"
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

// Search component for user pages
const UserPagesSearch = ({ userId, username }: { userId: string; username: string }) => {
  const { currentQuery, results, isLoading, performSearch } = useUnifiedSearch(userId, {
    context: SEARCH_CONTEXTS.MAIN,
    includeContent: true,
    includeUsers: false,
    maxResults: 100
  });

  // Filter results to only show pages by this user
  const userPages = results.pages?.filter(page => page.userId === userId) || [];

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder={`Search ${username}'s pages...`}
        className="w-full"
        onChange={(e) => performSearch(e.target.value)}
      />

      {isLoading && (
        <div className="text-center py-4">
          <Icon name="Loader" size={24} className="mx-auto" />
        </div>
      )}

      <SearchResultsDisplay
        query={currentQuery}
        results={{ pages: userPages, users: [] }}
        isLoading={isLoading}
        groupsEnabled={false}
        userId={userId}
        onSave={() => {}}
      />
    </div>
  );
};

// Valid tabs for user profile
const VALID_PROFILE_TABS = ["bio", "pages", "recent-activity", "timeline", "graph", "map", "external-links"];

interface UserProfileTabsProps {
  profile: {
    uid: string;
    username?: string;
    tier?: string;
    subscriptionStatus?: string;
    subscriptionAmount?: number;
    createdAt?: string;
  };
}

export default function UserProfileTabs({ profile }: UserProfileTabsProps) {
  // Use query param based tab navigation (migrates from old hash-based URLs)
  const { activeTab, setActiveTab: setActiveTabFromHook } = useTabNavigation({
    defaultTab: 'bio',
    validTabs: VALID_PROFILE_TABS,
    migrateFromHash: true, // Handle old #tab URLs gracefully
  });

  console.log('🗺️ UserProfileTabs: Current activeTab state:', activeTab);
  const [direction, setDirection] = useState(0); // -1 for right, 1 for left
  const { user } = useAuth();
  const isCurrentUser = user && profile && user.uid === profile.uid;
  const [loadingError, setLoadingError] = useState(null);

  const tabsRef = useRef(null);

  // Sorting state for pages tab with persistence
  const [sortBy, setSortBy] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('profile-pages-sort-by') || "recently-edited";
    }
    return "recently-edited";
  });
  const [sortDirection, setSortDirection] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('profile-pages-sort-direction') || "desc";
    }
    return "desc";
  });

  // Groups feature has been removed - no longer needed
  // const groupsEnabled = useFeatureFlag('groups', user?.email);

  // Analytics tracking
  const { trackSortingInteraction, trackInteractionEvent, events } = useWeWriteAnalytics();

  // 🚨 CRITICAL FIX: Use database-level sorting API instead of broken Firestore queries
  // Now includes automatic change detection - no manual refresh needed
  const {
    pages,
    loading: isLoading,
    error: pagesError,
    fetchWithSort,
    hasMore,
    loadingMore,
    loadMore,
    totalPageCount
  } = useUserPages(profile?.uid, user?.uid, true, sortBy, sortDirection);

  // 🚨 CRITICAL FIX: No local sorting needed - pages come pre-sorted from database
  // The API now handles sorting at the database level for the entire dataset
  const sortedPages = pages;

  // Infinite scroll for pages tab
  const { targetRef: pagesScrollTarget } = useInfiniteScrollWithLoadMore({
    hasMore: hasMore || false,
    onLoadMore: loadMore || (() => {}),
    isLoading: loadingMore, // Pass actual loading state to prevent multiple concurrent loads
  });

  // Helper function to get descriptive sort labels
  const getSortLabel = (sortType, direction) => {
    switch (sortType) {
      case "recently-edited":
        return direction === "desc" ? "Recently Edited" : "Oldest Edited";
      case "recently-created":
        return direction === "desc" ? "Recently Created" : "Oldest Created";
      case "alphabetical":
        return direction === "asc" ? "A to Z" : "Z to A";
      default:
        return "Sort";
    }
  };

  // 🚨 CRITICAL FIX: Helper function to trigger database-level sorting
  const handleSortChange = (newSortBy) => {
    const oldSortBy = sortBy;
    const oldDirection = sortDirection;

    if (sortBy === newSortBy) {
      // Same sort type, toggle direction
      const newDirection = sortDirection === "asc" ? "desc" : "asc";
      setSortDirection(newDirection);
      if (typeof window !== 'undefined') {
        localStorage.setItem('profile-pages-sort-direction', newDirection);
      }

      // 🚨 CRITICAL FIX: Trigger database-level sort with new direction
      const dbSortBy = newSortBy === "recently-edited" ? "lastModified" :
                      newSortBy === "recently-created" ? "createdAt" : "title";
      fetchWithSort(dbSortBy, newDirection);

      // Track direction toggle
      trackSortingInteraction(newSortBy, newDirection, 'profile_pages', {
        previous_direction: oldDirection,
        action_type: 'direction_toggle'
      });
    } else {
      // Different sort type, set to default direction
      setSortBy(newSortBy);
      if (typeof window !== 'undefined') {
        localStorage.setItem('profile-pages-sort-by', newSortBy);
      }

      // Set default direction based on sort type
      let newDirection;
      switch (newSortBy) {
        case "alphabetical":
          newDirection = "asc"; // A-Z is more intuitive as default
          break;
        case "recently-edited":
        case "recently-created":
        default:
          newDirection = "desc"; // Recent first is more intuitive as default
          break;
      }
      setSortDirection(newDirection);
      if (typeof window !== 'undefined') {
        localStorage.setItem('profile-pages-sort-direction', newDirection);
      }

      // 🚨 CRITICAL FIX: Trigger database-level sort with new sort type
      const dbSortBy = newSortBy === "recently-edited" ? "lastModified" :
                      newSortBy === "recently-created" ? "createdAt" : "title";
      fetchWithSort(dbSortBy, newDirection);

      // Track sort type change
      trackSortingInteraction(newSortBy, newDirection, 'profile_pages', {
        previous_sort_type: oldSortBy,
        previous_direction: oldDirection,
        action_type: 'sort_type_change'
      });
    }
  };

  // Determine which tabs to show in the requested order
  const visibleTabs = React.useMemo(() => {
    const tabs = ["bio", "pages", "recent-activity"];

    // Add timeline tab for all users
    tabs.push("timeline");

    // Add graph tab for all users
    tabs.push("graph");

    // Add map tab for all users
    tabs.push("map");

    // Add external links tab for all users
    tabs.push("external-links");

    // Groups tab removed - groups feature has been completely removed
    // Following tab removed - now available in sidebar

    return tabs;
  }, [isCurrentUser]);

  // Tab navigation is now handled by useTabNavigation hook
  // which uses query params (?tab=) instead of hash (#tab)
  // This allows tabs and drawers to coexist: /user/123?tab=graph#checkout

  // Function to scroll the selected tab into view
  const scrollTabIntoView = (tabValue) => {
    // Wait a tiny bit to ensure DOM is ready
    setTimeout(() => {
      // Find the tab element
      const tabElement = document.querySelector(`[data-value="${tabValue}"]`);
      if (!tabElement) return;

      // Find the scrollable container - specifically target the tabs container, not other carousels
      const scrollContainer = document.querySelector('#profile-tabs-header .overflow-x-auto');
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
    console.log('🗺️ UserProfileTabs: handleTabChange called with:', newTab, 'current:', activeTab);

    // Track tab switching
    if (newTab !== activeTab) {
      trackInteractionEvent(events.TAB_CHANGED, {
        from_tab: activeTab,
        to_tab: newTab,
        location: 'user_profile',
        user_id: profile?.uid,
        is_current_user: isCurrentUser
      });
    }

    // Use the hook to update tab (which updates query param)
    setActiveTabFromHook(newTab);
    console.log('🗺️ UserProfileTabs: Updated URL to ?tab=' + newTab);

    scrollTabIntoView(newTab);
  };





  // 🚨 URGENT FIX: Load more temporarily disabled - simple API doesn't support pagination yet
  const loadMorePages = async () => {
    console.log("Load more temporarily disabled in urgent production fix");
  };

  // Removed unfollow all function

  // Sticky tabs are now handled via CSS using position: sticky
  // The tabs stick to the bottom of the header stack (banner + header)
  // See globals.css .sticky-tabs for the CSS implementation

  // Use useEffect to scroll the active tab into view when the component mounts or active tab changes
  React.useEffect(() => {
    // Wait a short delay to ensure the DOM is fully rendered
    setTimeout(() => {
      scrollTabIntoView(activeTab);
    }, 300);
  }, [activeTab]);

  return (
    <Tabs
      defaultValue="bio"
      value={activeTab}
      onValueChange={handleTabChange}
      className="w-full"
    >
        {/* Tabs header - sticky below page header */}
        <div
          id="profile-tabs-header"
          className="sticky top-0 border-b border-border bg-background z-40"
        >
          <div className="overflow-x-auto scrollbar-hide pb-0.5">
            <TabsList className="flex w-max border-0 bg-transparent p-0 justify-start h-auto min-h-0">
              {/* Bio tab (first/default) */}
              <TabsTrigger
                value="bio"
                data-value="bio"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <Icon name="User" size={16} />
                <span>Bio</span>
              </TabsTrigger>

              {/* Pages tab */}
              <TabsTrigger
                value="pages"
                data-value="pages"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <Icon name="FileText" size={16} />
                <span>Pages</span>
              </TabsTrigger>

              {/* Recent Activity tab */}
              <TabsTrigger
                value="recent-activity"
                data-value="recent-activity"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <Icon name="Activity" size={16} />
                <span>Recent Activity</span>
              </TabsTrigger>

              {/* Timeline tab */}
              <TabsTrigger
                value="timeline"
                data-value="timeline"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <Icon name="Calendar" size={16} />
                <span>Timeline</span>
              </TabsTrigger>

              {/* Graph tab */}
              <TabsTrigger
                value="graph"
                data-value="graph"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <Icon name="Network" size={16} />
                <span>Graph</span>
              </TabsTrigger>

              {/* Map tab */}
              <TabsTrigger
                value="map"
                data-value="map"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <Icon name="MapPin" size={16} />
                <span>Map</span>
              </TabsTrigger>

              {/* External Links tab */}
              <TabsTrigger
                value="external-links"
                data-value="external-links"
                className="flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary"
              >
                <Icon name="Link" size={16} />
                <span>External Links</span>
              </TabsTrigger>

              {/* Groups tab removed - groups feature has been completely removed */}
              {/* Following tab removed - now available in sidebar */}

            </TabsList>
          </div>
        </div>

        {/* Tab content container */}
        <div id="tabs-content-container" className="pt-4">
          <TabsContent
            value="recent-activity"
            className={`mt-0 transition-all duration-300 ${
              activeTab === "recent-activity"
                ? "block"
                : "hidden"
            }`}
          >
            <ActivityFeed
              mode="user"
              filterByUserId={profile?.uid}
              filterByUsername={profile?.username}
              limit={20}
            />
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
              <UserPagesSearch
                userId={profile?.uid}
                username={profile?.username || 'user'}
              />
            </div>

            {/* Sort dropdown */}
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-muted-foreground">
                {totalPageCount || 0} page{(totalPageCount || 0) !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-2">
                {/* Automatic change detection enabled - no manual refresh needed */}
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2">
                    {sortDirection === "asc" ? <Icon name="ChevronUp" size={16} /> : <Icon name="ChevronDown" size={16} />}
                    {getSortLabel(sortBy, sortDirection)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => handleSortChange("recently-edited")}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {sortBy === "recently-edited" && sortDirection === "desc" ? <Icon name="ChevronDown" size={16} /> : <Icon name="ChevronUp" size={16} />}
                      {getSortLabel("recently-edited", sortBy === "recently-edited" ? (sortDirection === "desc" ? "asc" : "desc") : "desc")}
                    </span>
                    {sortBy === "recently-edited" && <Icon name="Check" size={16} />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSortChange("recently-created")}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {sortBy === "recently-created" && sortDirection === "desc" ? <Icon name="ChevronDown" size={16} /> : <Icon name="ChevronUp" size={16} />}
                      {getSortLabel("recently-created", sortBy === "recently-created" ? (sortDirection === "desc" ? "asc" : "desc") : "desc")}
                    </span>
                    {sortBy === "recently-created" && <Icon name="Check" size={16} />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSortChange("alphabetical")}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {sortBy === "alphabetical" && sortDirection === "asc" ? <Icon name="ChevronUp" size={16} /> : <Icon name="ChevronDown" size={16} />}
                      {getSortLabel("alphabetical", sortBy === "alphabetical" ? (sortDirection === "asc" ? "desc" : "asc") : "asc")}
                    </span>
                    {sortBy === "alphabetical" && <Icon name="Check" size={16} />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Icon name="Loader" className="text-muted-foreground" />
              </div>
            ) : (
              <>
                <PageList pageList={sortedPages} emptyMessage="No pages yet" isCurrentUserList={isCurrentUser} />
                {loadingError && (
                  <InlineError
                    variant="inline"
                    message={loadingError}
                    className="mt-4"
                  />
                )}

                {/* Infinite scroll loading indicator */}
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Icon name="Loader" className="text-muted-foreground" />
                  </div>
                )}

                {/* Infinite scroll target */}
                <div ref={pagesScrollTarget} className="h-4" />

                {/* Manual load more button as fallback */}
                {hasMore && !loadingMore && loadMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={loadMore}
                      variant="secondary"
                    >
                      Load More Pages
                    </Button>
                  </div>
                )}

                {/* End of list indicator */}
                {!hasMore && !loadingMore && sortedPages && sortedPages.length > 0 && (
                  <div className="flex justify-center py-6">
                    <div className="text-center text-muted-foreground">
                      <div className="w-12 h-px bg-border mx-auto mb-2"></div>
                      <p className="text-sm">You've reached the end</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Timeline tab content */}
          <TabsContent
            value="timeline"
            className={`mt-0 transition-all duration-300 ${
              activeTab === "timeline"
                ? "block"
                : "hidden"
            }`}
          >
            <TimelineSection />
          </TabsContent>

          {/* Graph tab content */}
          <TabsContent
            value="graph"
            className={`mt-0 transition-all duration-300 ${
              activeTab === "graph"
                ? "block"
                : "hidden"
            }`}
          >
            <UserGraphTab
              userId={profile?.uid}
              username={profile?.username || 'this user'}
              isOwnContent={isCurrentUser}
            />
          </TabsContent>

          {/* Map tab content */}
          <TabsContent
            value="map"
            className="mt-0 transition-all duration-300"
          >
            {activeTab === "map" && (
              <>
                <UserMapTab
                  userId={profile?.uid}
                  username={profile?.username || 'this user'}
                  isOwnContent={isCurrentUser}
                />
              </>
            )}
          </TabsContent>

          {/* External Links tab content */}
          <TabsContent
            value="external-links"
            className={`mt-0 transition-all duration-300 ${
              activeTab === "external-links"
                ? "block"
                : "hidden"
            }`}
          >
            <ExternalLinksTab
              userId={profile?.uid}
              username={profile?.username || 'this user'}
              currentUserId={user?.uid}
            />
          </TabsContent>

          {/* Following tab content removed - now available in sidebar */}
          {/* Groups tab content removed - groups feature has been completely removed */}

        </div>
    </Tabs>
  );
}
