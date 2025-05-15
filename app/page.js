"use client";

import { useContext, useEffect, useState } from "react";
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
import { Plus, FileText, Loader, Clock, Flame, Users, Trophy } from "lucide-react";
import { ShimmerEffect } from "./components/ui/skeleton";
import { Placeholder } from "./components/ui/placeholder";
import { useTheme } from "next-themes";
import LandingPage from "./components/landing/LandingPage";
import { FloatingActionButton } from "./components/ui/floating-action-button";
import SiteFooter from "./components/SiteFooter";
import SectionTitle from "./components/SectionTitle";
import { Hero } from "./components/landing/Hero";
import PWABanner from "./components/PWABanner";
import { usePWA } from "./providers/PWAProvider";

export default function Home() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const { loading: dataLoading } = useContext(DataContext);
  const router = useRouter();
  const isLoading = dataLoading || authLoading;
  const { theme } = useTheme();
  const [showLanding, setShowLanding] = useState(true);

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
        persistedAuth: persistedAuthState === 'authenticated'
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
  }, [user, authLoading, router]);

  // Display a loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin h-8 w-8 text-primary"/>
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
    <>
      <Header />
      <PWABanner />
      <main className="p-6 space-y-6 bg-background" data-component-name="Home">
        <AddUsername />

        <div className="w-full mb-6">
          <SearchButton placeholder="Search all pages..." />
        </div>

        {/* 1. Recent Activity (moved to top) */}
        <div style={{ minHeight: isLoading ? '200px' : 'auto' }}>
          {isLoading ? (
            <Placeholder className="w-full h-8 mb-4" animate={true}>
              <div className="flex items-center space-x-2 p-2">
                <Loader className="h-5 w-5 animate-spin text-primary" />
                <span className="text-lg text-muted-foreground">Loading...</span>
              </div>
            </Placeholder>
          ) : (
            <SectionTitle
              icon={Clock}
              title="Recent Activity"
            />
          )}
          <RecentActivity limit={4} />
        </div>

        {/* 2. My Pages */}
        <div style={{ minHeight: isLoading ? '300px' : 'auto' }}>
          {isLoading ? (
            <Placeholder className="w-full h-8 mb-4" animate={true}>
              <div className="flex items-center space-x-2 p-2">
                <Loader className="h-5 w-5 animate-spin text-primary" />
                <span className="text-lg text-muted-foreground">Loading...</span>
              </div>
            </Placeholder>
          ) : (
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
          )}
          <AllPages />
        </div>

        {/* 3. Groups Section - Only visible when feature flag is enabled */}
        {!isLoading && <HomeGroupsSection />}

        {/* 4. Trending Pages */}
        <div style={{ minHeight: isLoading ? '300px' : 'auto' }}>
          {isLoading ? (
            <Placeholder className="w-full h-8 mb-4" animate={true}>
              <div className="flex items-center space-x-2 p-2">
                <Loader className="h-5 w-5 animate-spin text-primary" />
                <span className="text-lg text-muted-foreground">Loading...</span>
              </div>
            </Placeholder>
          ) : (
            <SectionTitle
              icon={Flame}
              title="Trending Pages"
            />
          )}
          <TrendingPages limit={5} />
        </div>

        {/* 5. Top Users */}
        <div style={{ minHeight: isLoading ? '300px' : 'auto' }}>
          {isLoading ? (
            <Placeholder className="w-full h-8 mb-4" animate={true}>
              <div className="flex items-center space-x-2 p-2">
                <Loader className="h-5 w-5 animate-spin text-primary" />
                <span className="text-lg text-muted-foreground">Loading...</span>
              </div>
            </Placeholder>
          ) : (
            <SectionTitle
              icon={Trophy}
              title="Top Users"
            />
          )}
          <TopUsers />
        </div>

        <FloatingActionButton href="/new" />
      </main>
      <SiteFooter />
    </>
  );
}
