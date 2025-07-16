"use client";
import { useEffect, useState } from "react";
import { useCurrentAccount } from "../../providers/CurrentAccountProvider";
import { useRouter } from "next/navigation";
import Header from "../layout/Header";
import RandomPages from "../features/RandomPages";
import TrendingPages from "../features/TrendingPages";
import { useOptimizedHome } from "../../hooks/useOptimizedHome";
import { Shuffle, TrendingUp, Clock, Zap, Activity } from "lucide-react";
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

// Recently Viewed Section Component - moved outside to prevent infinite re-renders
const RecentPagesSection = () => {
  console.log('🟠 [RECENT_VIEWED] Component rendering');
  const { data, loading, error } = useOptimizedHome();
  console.log('🟠 [RECENT_VIEWED] useOptimizedHome returned:', {
    hasData: !!data,
    loading,
    error,
    recentPagesCount: data?.recentPages?.length || 0,
    batchUserDataKeys: data?.batchUserData ? Object.keys(data.batchUserData).length : 0
  });
  const [pagesWithSubscriptions, setPagesWithSubscriptions] = useState([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // Use batched subscription data from the home API
  useEffect(() => {
    const recentPages = data?.recentPages || [];
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

    setPagesWithSubscriptions(pagesWithSubs);
  }, [data?.recentPages, data?.batchUserData]);

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

  const recentPages = pagesWithSubscriptions.length > 0 ? pagesWithSubscriptions : (data?.recentPages || []);

  if (recentPages.length === 0) {
    return (
      <StickySection
        sectionId="recently-viewed"
        headerContent={
          <SectionTitle icon={Clock} title="Recently Viewed" />
        }
      >
        <div className="border border-muted rounded-lg p-8 text-center text-muted-foreground">
          No recently viewed pages available
        </div>
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
      <RandomPagesTable pages={pagesWithSubscriptions} loading={subscriptionLoading} denseMode={false} />
    </StickySection>
  );
};


const Home: React.FC = () => {
  const { currentAccount, isAuthenticated, isLoading } = useCurrentAccount();
  const router = useRouter();

  // Handle search functionality - navigate to search page
  const handleSearchFocus = () => {
    // Navigate to search page when user clicks on the search input
    router.push('/search');
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
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