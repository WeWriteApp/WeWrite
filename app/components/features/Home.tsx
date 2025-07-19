"use client";
import { useEffect, useState } from "react";
import { useCurrentAccount } from "../../providers/CurrentAccountProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../layout/Header";
import RandomPages from "../features/RandomPages";
import TrendingPages from "../features/TrendingPages";
import { useOptimizedHome } from "../../hooks/useOptimizedHome";
import { Shuffle, TrendingUp, Clock, Zap, Activity, ArrowRight } from "lucide-react";
import RandomPagesTable from "../pages/RandomPagesTable";
import RecentPagesActivity from "./RecentPagesActivity";
import StickySection from "../utils/StickySection";
import { SectionTitle } from "../ui/section-title";
import RandomPagesHeader from "../features/RandomPagesHeader";
import { Input } from "../ui/input";
import { Search } from "lucide-react";
import DailyNotesSection from "../daily-notes/DailyNotesSection";
import TimelineSection from "../timeline/TimelineSection";
import EmailVerificationAlert from "../utils/EmailVerificationAlert";
import EmptyState from "../ui/EmptyState";
import { getEnvironmentType } from "../../utils/environmentConfig";
import UserPagesGraphView from "../pages/UserPagesGraphView";

// Recently Viewed Section Component - moved outside to prevent infinite re-renders
const RecentPagesSection = () => {
  console.log('🚀 [RECENT_VIEWED] Component mounted/rendered - timestamp:', new Date().toISOString());
  const { data, loading, error } = useOptimizedHome();
  console.log('🚀 [RECENT_VIEWED] useOptimizedHome hook result:', { data: !!data, loading, error });
  console.log('🟠 [RECENT_VIEWED] useOptimizedHome returned:', {
    hasData: !!data,
    loading,
    error,
    recentPagesCount: data?.recentlyVisitedPages?.length || 0,
    batchUserDataKeys: data?.batchUserData ? Object.keys(data.batchUserData).length : 0
  });
  const [pagesWithSubscriptions, setPagesWithSubscriptions] = useState([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // Mobile detection state - must be at the top level
  const [isMobile, setIsMobile] = useState(false);

  // Use batched subscription data from the home API
  useEffect(() => {
    const recentPages = data?.recentlyVisitedPages || [];
    const batchUserData = data?.batchUserData || {};

    console.log('🟠 [RECENT_VIEWED] Processing data:', {
      recentPagesCount: recentPages.length,
      batchUserDataKeys: Object.keys(batchUserData).length,
      sampleRecentPages: recentPages.slice(0, 2)
    });

    if (recentPages.length === 0) {
      console.log('🟠 [RECENT_VIEWED] No recent pages found');
      setPagesWithSubscriptions([]);
      return;
    }

    // Process pages immediately if we have data, don't wait for user data
    // The batchUserData might be empty if there are no users with subscriptions

    // Add subscription data to pages using the batched data from the API
    const pagesWithSubs = recentPages.map(page => {
      if (!page.userId) return page;

      const userData = batchUserData[page.userId];
      return {
        ...page,
        tier: userData?.tier,
        subscriptionStatus: userData?.subscriptionStatus,
        subscriptionAmount: userData?.subscriptionAmount,
        username: userData?.username || page.username
      };
    });

    console.log('🟠 [RECENT_VIEWED] Final processed pages:', {
      finalCount: pagesWithSubs.length,
      sampleProcessedPages: pagesWithSubs.slice(0, 2).map(p => ({
        id: p.id,
        title: p.title,
        username: p.username,
        tier: p.tier,
        hasSubscriptionData: !!(p.tier || p.subscriptionStatus)
      }))
    });

    setPagesWithSubscriptions(pagesWithSubs);
  }, [data?.recentlyVisitedPages, data?.batchUserData]);

  // Mobile detection effect - must be after other useEffect hooks
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (loading) {
    return (
      <StickySection
        sectionId="recently-viewed"
        headerContent={
          <SectionTitle icon={Clock} title="Recently Viewed" />
        }
      >
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-lg"></div>
          ))}
        </div>
      </StickySection>
    );
  }

  if (error) {
    return (
      <StickySection
        sectionId="recently-viewed"
        headerContent={
          <SectionTitle icon={Clock} title="Recently Viewed" />
        }
      >
        <div className="border border-destructive/20 rounded-lg p-4 text-center text-destructive">
          Failed to load recently viewed pages
        </div>
      </StickySection>
    );
  }

  const allRecentPages = pagesWithSubscriptions.length > 0 ? pagesWithSubscriptions : (data?.recentlyVisitedPages || []);

  // Mobile: show 4 items, Desktop: show 8 items
  const itemLimit = isMobile ? 4 : 8;
  const recentPages = allRecentPages.slice(0, itemLimit);

  if (recentPages.length === 0) {
    console.log('🟠 [RECENT_VIEWED] Showing empty state - no recent pages available');
    return (
      <StickySection
        sectionId="recently-viewed"
        headerContent={
          <SectionTitle icon={Clock} title="Recently Viewed" />
        }
      >
        <EmptyState
          icon={Clock}
          title="No recently viewed pages"
          description="Pages you visit will appear here for quick access"
        />
      </StickySection>
    );
  }

  return (
    <StickySection
      sectionId="recently-viewed"
      headerContent={
        <SectionTitle icon={Clock} title="Recently Viewed" />
      }
    >
      <div className="space-y-4">
        <RandomPagesTable pages={recentPages} loading={subscriptionLoading} denseMode={false} />

        {/* View More Button - only show if there are more pages than the current limit */}
        {allRecentPages.length > itemLimit && (
          <div className="flex justify-center pt-2">
            <Link
              href="/recents"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg hover:bg-muted/50"
            >
              View More
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </StickySection>
  );
};


const Home: React.FC = () => {
  console.log('🏠 [HOME_COMPONENT] Rendering - timestamp:', new Date().toISOString());
  const { currentAccount, isAuthenticated, isLoading } = useCurrentAccount();
  console.log('🏠 [HOME_COMPONENT] Auth state:', { isAuthenticated, isLoading, hasCurrentAccount: !!currentAccount });
  const router = useRouter();

  // Handle search functionality - navigate to search page
  const handleSearchFocus = () => {
    // Navigate to search page when user clicks on the search input
    router.push('/search');
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, isLoading]);

  // Show loading state while authentication is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Only redirect if we're sure the user is not authenticated
  if (!isLoading && !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* Main content area with proper sidebar spacing */}
      <main className="transition-all duration-300 ease-in-out">
          <div className="container mx-auto px-4 py-6 space-y-8">
            {/* Email Verification Alert */}
            <EmailVerificationAlert className="max-w-2xl mx-auto" />

            {/* Search Section */}
            <div className="max-w-2xl mx-auto">
              <div className="relative cursor-pointer" onClick={handleSearchFocus}>
                <Input
                  type="text"
                  placeholder="Search for pages, users..."
                  className="w-full pl-10 pr-4 rounded-2xl cursor-pointer"
                  readOnly
                  onClick={handleSearchFocus}
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Daily Notes Section */}
            <DailyNotesSection />

            {/* User Pages Graph View */}
            <UserPagesGraphView />

            {/* Timeline Section */}
            <TimelineSection />

            {/* Recent Edits Section - Now using recent pages with diff data */}
            <StickySection
              sectionId="recent-edits"
              headerContent={
                <SectionTitle icon={Activity} title="Recent Edits" />
              }
            >
              <RecentPagesActivity limit={8} renderFilterInHeader={true} />
            </StickySection>

            {/* Random Pages Section */}
            <StickySection
              sectionId="random-pages"
              headerContent={<RandomPagesHeader />}
            >
              <RandomPages limit={8} priority="high" />
            </StickySection>

            {/* Trending Pages Section */}
            <StickySection
              sectionId="trending-pages"
              headerContent={
                <SectionTitle icon={TrendingUp} title="Trending Pages" />
              }
            >
              <TrendingPages limit={6} showSparklines={true} priority="high" />
            </StickySection>

            {/* Recently Viewed Section */}
            <RecentPagesSection />
          </div>
        </main>
    </div>
  );
};

export default Home;