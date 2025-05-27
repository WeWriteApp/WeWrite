"use client";

import { useContext, useEffect, useState, useCallback, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import Header from "./components/Header";
import AddUsername from "./components/AddUsername";
import SearchButton from "./components/SearchButton";
import { DashboardSkeleton, ActivitySkeleton, TrendingPagesSkeleton, TopUsersSkeleton, GroupsSkeleton, RandomPagesSkeleton } from "./components/ui/skeleton-loaders";
import LazySection from "./components/ui/lazy-section";

// Lazy load non-critical components
const TrendingPagesOptimized = dynamic(() => import("./components/TrendingPagesOptimized"), {
  loading: () => <TrendingPagesSkeleton limit={5} />,
  ssr: false
});

const TopUsersOptimized = dynamic(() => import("./components/TopUsersOptimized"), {
  loading: () => <TopUsersSkeleton limit={10} />,
  ssr: false
});

const HomeGroupsSection = dynamic(() => import("./components/HomeGroupsSection"), {
  loading: () => <GroupsSkeleton limit={3} />,
  ssr: false
});

const RandomPagesOptimized = dynamic(() => import("./components/RandomPagesOptimized"), {
  loading: () => <RandomPagesSkeleton limit={10} />,
  ssr: false
});

const DailyNotesSection = dynamic(() => import("./components/daily-notes/DailyNotesSection"), {
  loading: () => <div className="h-32 bg-muted/50 rounded-2xl animate-pulse mx-6 mb-8" />,
  ssr: false
});

import { AuthContext } from "./providers/AuthProvider";
import { DataContext } from "./providers/DataProvider";
import { useRouter } from "next/navigation";
import { useFeatureFlag } from "./utils/feature-flags";
import Link from "next/link";
import { Button } from "./components/ui/button";
import { Plus, FileText, Loader, Clock, Flame, Users, Trophy, RefreshCw, Shuffle } from "lucide-react";
import { useTheme } from "next-themes";
import LandingPage from "./components/landing/LandingPage";
import { FloatingActionButton } from "./components/ui/floating-action-button";
import SiteFooter from "./components/SiteFooter";
import { SectionTitle } from "./components/ui/section-title";
import StickySection from "./components/StickySection";
import PWABanner from "./components/PWABanner";
import ActivitySectionHeader from "./components/ActivitySectionHeader";
import RandomPagesHeader from "./components/RandomPagesHeader";
import RecentActivity from "./components/RecentActivity";
import { SmartLoader } from "./components/ui/smart-loader";
import { usePWA } from "./providers/PWAProvider";
import React from "react";
import performanceMonitor from "./utils/performance-monitor";

// Memoized Home component for better performance
const Home = React.memo(function Home() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const { loading: dataLoading, resetLoading, error, recoveryAttempted } = useContext(DataContext);
  const router = useRouter();
  const { theme } = useTheme();
  const [showLanding, setShowLanding] = useState(true);
  const [loadingRetryCount, setLoadingRetryCount] = useState(0);
  const [initialLoadStartTime, setInitialLoadStartTime] = useState(null);

  // Feature flag for daily notes
  const dailyNotesEnabled = useFeatureFlag('daily_notes', user?.email);

  // Memoized loading state to prevent unnecessary re-renders
  const isLoading = useMemo(() => dataLoading || authLoading, [dataLoading, authLoading]);

  // Track initial load time with performance monitoring
  useEffect(() => {
    if (isLoading && !initialLoadStartTime) {
      const startTime = Date.now();
      setInitialLoadStartTime(startTime);
      performanceMonitor.startTiming('homepage_initial_load');
    } else if (!isLoading && initialLoadStartTime) {
      const loadTime = Date.now() - initialLoadStartTime;
      console.log(`Home page loaded in ${loadTime}ms`);
      performanceMonitor.endTiming('homepage_initial_load');

      // Reset initial load time after successful load
      setInitialLoadStartTime(null);
    }
  }, [isLoading, initialLoadStartTime]);

  // Memoized retry handler to prevent unnecessary re-renders
  const handleRetry = useCallback(() => {
    console.log("Home page: Manual retry triggered");
    setLoadingRetryCount(prev => prev + 1);
    resetLoading();
  }, [resetLoading]);

  // Memoized authentication check to prevent infinite loops
  const authCheck = useCallback(() => {
    console.log("Home page auth check:", {
      authLoading,
      user: !!user,
      dataLoading,
      recoveryAttempted
    });

    // If auth is still loading, wait
    if (authLoading) return;

    // If user is authenticated, show dashboard
    if (user) {
      setShowLanding(false);
    }
  }, [authLoading, user, dataLoading, recoveryAttempted]);

  useEffect(() => {
    authCheck();
  }, [authCheck]);

  // Display a loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin h-8 w-8 text-primary"/>
        <span className="sr-only">Loading authentication state...</span>
      </div>
    );
  }

  // Show landing page for logged-out users
  if (!user) {
    return (
      <>
        <LandingPage />
        <SiteFooter />
      </>
    );
  }

  // Memoized fallback content to prevent re-renders
  const fallbackContent = useMemo(() => (
    <div className="space-y-4">
      <p>We're having trouble loading your dashboard. This could be due to:</p>
      <ul className="list-disc list-inside text-left mt-2 mb-2">
        <li>Slow network connection</li>
        <li>Server issues</li>
        <li>Authentication problems</li>
      </ul>
      {error && (
        <div className="text-red-500 text-sm mt-2">
          Error details: {error}
        </div>
      )}
    </div>
  ), [error]);

  // Show optimized dashboard for logged-in users
  return (
    <SmartLoader
      isLoading={isLoading}
      message="Loading your dashboard..."
      timeoutMs={20000} // Increased timeout for stability
      autoRecover={false} // Disabled for stability
      onRetry={handleRetry}
      fallbackContent={fallbackContent}
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <Header />
        <PWABanner />
        <main className="p-6 bg-background overflow-hidden" data-component-name="Home">
          {/* Critical above-the-fold content - load immediately */}
          <AddUsername />

          <div className="w-full mb-6">
            <SearchButton placeholder="Search all pages..." />
          </div>

          {/* Daily Notes Section - Feature flagged */}
          {dailyNotesEnabled && (
            <DailyNotesSection />
          )}

          {/* 1. Recent Activity - High priority, loads first */}
          <StickySection
            sectionId="activity"
            headerContent={
              <ActivitySectionHeader />
            }
          >
            <LazySection
              name="activity"
              priority="high"
              minHeight={200}
              fallback={<ActivitySkeleton limit={4} />}
            >
              <RecentActivity
                limit={4}
                renderFilterInHeader={true}
                showViewAll={true}
              />
            </LazySection>
          </StickySection>

          {/* 2. Groups Section - Medium priority */}
          <StickySection
            sectionId="groups"
            headerContent={
              <SectionTitle
                icon={Users}
                title="Your Groups"
                rightContent={
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Desktop: Button with text and icon */}
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = '/group/new';
                      }}
                      className="hidden sm:flex items-center gap-2 rounded-2xl h-8 px-3"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="hidden md:inline">New Group</span>
                    </Button>

                    {/* Mobile: Icon-only button */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = '/group/new';
                      }}
                      className="sm:hidden h-8 w-8 rounded-2xl"
                      aria-label="Create new group"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
            }
          >
            <LazySection
              name="groups"
              priority="medium"
              minHeight={200}
              fallback={<GroupsSkeleton limit={3} />}
            >
              <HomeGroupsSection />
            </LazySection>
          </StickySection>

          {/* 3. Trending Pages - Low priority, lazy loaded */}
          <StickySection
            sectionId="trending"
            headerContent={
              <SectionTitle
                icon={Flame}
                title="Trending Pages"
              />
            }
          >
            <LazySection
              name="trending"
              priority="low"
              minHeight={300}
              fallback={<TrendingPagesSkeleton limit={5} />}
            >
              <TrendingPagesOptimized limit={5} priority="low" />
            </LazySection>
          </StickySection>

          {/* 4. Random Pages - Low priority, lazy loaded */}
          <StickySection
            sectionId="random_pages"
            headerContent={
              <RandomPagesHeader />
            }
          >
            <LazySection
              name="random_pages"
              priority="low"
              minHeight={300}
              fallback={<RandomPagesSkeleton limit={10} />}
            >
              <RandomPagesOptimized limit={10} priority="low" />
            </LazySection>
          </StickySection>

          {/* 5. Top Users - Lowest priority, lazy loaded */}
          <StickySection
            sectionId="top_users"
            headerContent={
              <SectionTitle
                icon={Trophy}
                title="Top Users"
              />
            }
          >
            <LazySection
              name="top_users"
              priority="low"
              minHeight={300}
              fallback={<TopUsersSkeleton limit={10} />}
            >
              <TopUsersOptimized limit={10} priority="low" />
            </LazySection>
          </StickySection>

          <FloatingActionButton href="/new" />
        </main>
        <SiteFooter />
      </Suspense>
    </SmartLoader>
  );
});

export default Home;
