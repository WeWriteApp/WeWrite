"use client";
import { useEffect, useState } from "react";
import { useCurrentAccount } from "../../providers/CurrentAccountProvider";
import { useRouter } from "next/navigation";
import Header from "../layout/Header";
import RandomPages from "../features/RandomPages";
import TrendingPages from "../features/TrendingPages";
import { useOptimizedDashboard } from "../../hooks/useOptimizedDashboard";
import { Shuffle, TrendingUp, Clock, Zap, Activity } from "lucide-react";
import RandomPagesTable from "../pages/RandomPagesTable";
import RecentActivity from "./RecentActivity";
import RecentActivityHeader from "./RecentActivityHeader";
import StickySection from "../utils/StickySection";
import { SectionTitle } from "../ui/section-title";
import RandomPagesHeader from "../features/RandomPagesHeader";
import { Input } from "../ui/input";
import { Search } from "lucide-react";
import DailyNotesSection from "../daily-notes/DailyNotesSection";
import EmailVerificationAlert from "../utils/EmailVerificationAlert";


const Dashboard: React.FC = () => {
  console.log(`🟡 Dashboard: Component rendering`);
  const { currentAccount, isAuthenticated, isLoading } = useCurrentAccount();
  const router = useRouter();

  // Handle search functionality - navigate to search page
  const handleSearchFocus = () => {
    // Navigate to search page when user clicks on the search input
    router.push('/search');
  };

  console.log('🟡 Dashboard: Authentication state:', { isAuthenticated, isLoading, currentAccount: !!currentAccount });

  useEffect(() => {
    if (!isAuthenticated) {
      console.log('🟡 Dashboard: Not authenticated, redirecting to login');
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    console.log('🟡 Dashboard: Returning null due to not authenticated');
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

            {/* Recent Activity Section */}
            <StickySection
              sectionId="recent-activity"
              headerContent={<RecentActivityHeader />}
            >
              {console.log('🟡 Dashboard: About to render RecentActivity component')}
              <RecentActivity limit={8} renderFilterInHeader={true} />
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

            {/* Recent Pages Section */}
            <RecentPagesSection />
          </div>
        </main>
    </div>
  );
};

// Recent Pages Section Component
const RecentPagesSection = () => {
  const { data, loading, error } = useOptimizedDashboard();
  const [pagesWithSubscriptions, setPagesWithSubscriptions] = useState([]);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // Use batched subscription data from the dashboard API
  useEffect(() => {
    const recentPages = data?.recentPages || [];
    const batchUserData = data?.batchUserData || {};

    if (recentPages.length === 0) {
      setPagesWithSubscriptions([]);
      return;
    }

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
    console.log('RecentPagesSection: Using batched user data for', Object.keys(batchUserData).length, 'users');
  }, [data?.recentPages, data?.batchUserData]);

  if (loading) {
    return (
      <StickySection
        sectionId="recent-pages"
        headerContent={
          <SectionTitle icon={Clock} title="Recent Pages" />
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
        sectionId="recent-pages"
        headerContent={
          <SectionTitle icon={Clock} title="Recent Pages" />
        }
      >
        <div className="border border-destructive/20 rounded-lg p-4 text-center text-destructive">
          Failed to load recent pages
        </div>
      </StickySection>
    );
  }

  const recentPages = pagesWithSubscriptions.length > 0 ? pagesWithSubscriptions : (data?.recentPages || []);

  if (recentPages.length === 0) {
    return (
      <StickySection
        sectionId="recent-pages"
        headerContent={
          <SectionTitle icon={Clock} title="Recent Pages" />
        }
      >
        <div className="border border-muted rounded-lg p-8 text-center text-muted-foreground">
          No recent pages available
        </div>
      </StickySection>
    );
  }

  return (
    <StickySection
      sectionId="recent-pages"
      headerContent={
        <SectionTitle icon={Clock} title="Recent Pages" />
      }
    >
      <RandomPagesTable pages={recentPages} loading={subscriptionLoading} denseMode={false} />
    </StickySection>
  );
};

export default Dashboard;