"use client";
import { useEffect, useState, useRef } from "react";
import { useCurrentAccount } from "../../providers/CurrentAccountProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../layout/Header";
// Removed useOptimizedHome - now using UnifiedRecentActivity
import { Activity, Search } from "lucide-react";
import UnifiedRecentActivity from "../activity/UnifiedRecentActivity";
import StickySection from "../utils/StickySection";
import { SectionTitle } from "../ui/section-title";

import { Input } from "../ui/input";
import DailyNotesSection from "../daily-notes/DailyNotesSection";
import EmailVerificationAlert from "../utils/EmailVerificationAlert";
import EmptyState from "../ui/EmptyState";
import { getEnvironmentType } from "../../utils/environmentConfig";




const Home: React.FC = () => {
  console.log('🏠 [HOME_COMPONENT] Rendering - timestamp:', new Date().toISOString());
  const { currentAccount, isAuthenticated, isLoading } = useCurrentAccount();
  console.log('🏠 [HOME_COMPONENT] Auth state:', { isAuthenticated, isLoading, hasCurrentAccount: !!currentAccount });
  const router = useRouter();
  // Removed recentEditsFilterState - now handled by UnifiedRecentActivity component

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

            {/* Recent Edits Section - Now using unified activity system */}
            <StickySection sectionId="recent-edits">
              <UnifiedRecentActivity
                mode="edits"
                limit={20}
                showFilters={true}
                isCarousel={false}
                className="w-full"
              />
            </StickySection>






          </div>
        </main>
    </div>
  );
};

export default Home;