"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../layout/Header";
// Removed useOptimizedHome - now using UnifiedRecentActivity
import { Activity } from "lucide-react";
import SimpleRecentEdits from "./SimpleRecentEdits";
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
          <div className="container mx-auto px-4 py-4 space-y-6">
            {/* Email Verification Alert */}
            <EmailVerificationAlert className="max-w-2xl mx-auto" />

            {/* Daily Notes Section */}
            <DailyNotesSection />

            {/* Recent Edits Section - Simple implementation */}
            <SimpleRecentEdits />






          </div>
        </main>
    </div>
  );
};

export default Home;