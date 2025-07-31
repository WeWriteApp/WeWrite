"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../layout/Header";
// Removed useOptimizedHome - now using UnifiedRecentActivity
import { Activity } from "lucide-react";
import GlobalRecentEdits from "./GlobalRecentEdits";
import DailyNotesSection from "../daily-notes/DailyNotesSection";
import EmailVerificationAlert from "../utils/EmailVerificationAlert";
import EmptyState from "../ui/EmptyState";
import { getEnvironmentType } from "../../utils/environmentConfig";




const Home: React.FC = () => {
  console.log('🏠 [HOME_COMPONENT] Rendering - timestamp:', new Date().toISOString());
  const { user, isAuthenticated, isLoading } = useAuth();
  console.log('🏠 [HOME_COMPONENT] Auth state:', { isAuthenticated, isLoading, hasCurrentAccount: !!user });
  const router = useRouter();
  // Removed recentEditsFilterState - now handled by UnifiedRecentActivity component

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, isLoading]);

  // Show progressive loading state while authentication is being determined - show page structure immediately
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />

        {/* Show page structure immediately */}
        <div className="container max-w-4xl mx-auto px-4 py-6">
          {/* Daily notes section skeleton */}
          <div className="mb-8">
            <div className="h-6 w-32 bg-muted rounded animate-pulse mb-4" />
            <div className="h-20 bg-muted rounded-xl animate-pulse" />
          </div>

          {/* Recent activity section skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
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
          <div className="container mx-auto px-4 py-4 space-y-6">
            {/* Email Verification Alert */}
            <EmailVerificationAlert className="max-w-2xl mx-auto" />

            {/* Daily Notes Section */}
            <DailyNotesSection />

            {/* Recent Edits Section - Global implementation */}
            <GlobalRecentEdits />






          </div>
        </main>
    </div>
  );
};

export default Home;