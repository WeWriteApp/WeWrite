"use client";

import { useContext, useEffect, useState, useCallback } from "react";
import Header from "./components/Header";
import AllPages from "./components/AllPages";
import TopUsers from "./components/TopUsers";
import AddUsername from "./components/AddUsername";
import SearchButton from "./components/SearchButton";
import LoginBanner from "./components/LoginBanner";
import RecentActivity from "./components/RecentActivity";
import TrendingPages from "./components/TrendingPages";
// Using HomeGroupsSection instead of MyGroups
import HomeGroupsSection from "./components/HomeGroupsSection";

import { AuthContext } from "./providers/AuthProvider";
import { DataContext } from "./providers/DataProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "./components/ui/button";
import { Plus, FileText, Loader, Clock, Flame, Users, Trophy, RefreshCw } from "lucide-react";
import { ShimmerEffect } from "./components/ui/skeleton";
import { Placeholder } from "./components/ui/placeholder";
import { useTheme } from "next-themes";
import LandingPage from "./components/landing/LandingPage";
import { FloatingActionButton } from "./components/ui/floating-action-button";
import SiteFooter from "./components/SiteFooter";
import SectionTitle from "./components/SectionTitle";
import { Hero } from "./components/landing/Hero";
import PWABanner from "./components/PWABanner";
import { SmartLoader } from "./components/ui/smart-loader";
import { usePWA } from "./providers/PWAProvider";

export default function Home() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const { loading: dataLoading, resetLoading, error, recoveryAttempted } = useContext(DataContext);
  const router = useRouter();
  const isLoading = dataLoading || authLoading;
  const { theme } = useTheme();
  const [showLanding, setShowLanding] = useState(true);
  const [loadingRetryCount, setLoadingRetryCount] = useState(0);
  const [initialLoadStartTime, setInitialLoadStartTime] = useState(null);

  // Track initial load time
  useEffect(() => {
    if (isLoading && !initialLoadStartTime) {
      setInitialLoadStartTime(Date.now());
    } else if (!isLoading && initialLoadStartTime) {
      const loadTime = Date.now() - initialLoadStartTime;
      console.log(`Home page loaded in ${loadTime}ms`);

      // Reset initial load time after successful load
      setInitialLoadStartTime(null);
    }
  }, [isLoading, initialLoadStartTime]);

  // Handle manual retry
  const handleRetry = useCallback(() => {
    console.log("Home page: Manual retry triggered");
    setLoadingRetryCount(prev => prev + 1);
    resetLoading();
  }, [resetLoading]);

  // Check authentication state
  useEffect(() => {
    const checkAuth = async () => {
      // First check cookies for auth state
      const isAuthenticated = document.cookie.includes('authenticated=true');
      const persistedAuthState = localStorage.getItem('authState');

      console.log("Home page auth check:", {
        authLoading,
        user: !!user,
        cookieAuth: isAuthenticated,
        persistedAuth: persistedAuthState === 'authenticated',
        dataLoading,
        recoveryAttempted
      });

      // If auth is still loading, wait
      if (authLoading) return;

      // If we have a cookie or localStorage indicating auth, but no user yet,
      // wait a bit longer as Firebase might still be initializing
      if ((isAuthenticated || persistedAuthState === 'authenticated') && !user) {
        console.log("Auth indicators found but user not loaded yet, waiting...");
        // Don't redirect immediately, give a chance for auth to complete
        return;
      }

      // If user is authenticated, show dashboard
      if (user) {
        setShowLanding(false);
      }
    };

    checkAuth();

    // Set up a timer to check again in case of race conditions
    const timer = setTimeout(checkAuth, 1000);
    return () => clearTimeout(timer);
  }, [user, authLoading, router, dataLoading, recoveryAttempted]);

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

  // Show dashboard for logged-in users
  return (
    <SmartLoader
      isLoading={isLoading}
      message="Loading your dashboard..."
      timeoutMs={10000}
      autoRecover={true}
      onRetry={handleRetry}
      fallbackContent={
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
      }
    >
      <>
        <Header />
        <PWABanner />
        <main className="p-6 space-y-6 bg-background" data-component-name="Home">
          <AddUsername />

          <div className="w-full mb-6">
            <SearchButton placeholder="Search all pages..." />
          </div>

          {/* 1. Recent Activity (moved to top) */}
          <div style={{ minHeight: '200px' }}>
            <SectionTitle
              icon={Clock}
              title="Recent Activity"
            />
            <RecentActivity limit={4} />
          </div>

          {/* 2. My Pages */}
          <div style={{ minHeight: '300px' }}>
            <div className="flex items-center justify-between mb-4">
              <SectionTitle
                icon={FileText}
                title="Your Pages"
              />
              <Button variant="outline" asChild>
                <Link href="/new" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New page
                </Link>
              </Button>
            </div>
            <AllPages />
          </div>

          {/* 3. Groups Section - Only visible when feature flag is enabled */}
          <HomeGroupsSection />

          {/* 4. Trending Pages */}
          <div style={{ minHeight: '300px' }}>
            <SectionTitle
              icon={Flame}
              title="Trending Pages"
            />
            <TrendingPages limit={5} />
          </div>

          {/* 5. Top Users */}
          <div style={{ minHeight: '300px' }}>
            <SectionTitle
              icon={Trophy}
              title="Top Users"
            />
            <TopUsers />
          </div>

          <FloatingActionButton href="/new" />
        </main>
        <SiteFooter />
      </>
    </SmartLoader>
  );
}
