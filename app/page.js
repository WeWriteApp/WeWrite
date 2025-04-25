"use client";

import { useContext, useEffect, useState } from "react";
import Header from "./components/Header";
import AllPages from "./components/AllPages";
import TopUsers from "./components/TopUsers";
import AddUsername from "./components/AddUsername";
import TypeaheadSearch from "./components/TypeaheadSearch";
import LoginBanner from "./components/LoginBanner";
import RecentActivity from "./components/RecentActivity";
import TrendingPages from "./components/TrendingPages";
import MyGroups from "./components/MyGroups";
import { AuthContext } from "./providers/AuthProvider";
import { DataContext } from "./providers/DataProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "./components/ui/button";
import { Plus, FileText, Loader } from "lucide-react";
import { ShimmerEffect } from "./components/ui/skeleton";
import { Placeholder } from "./components/ui/placeholder";
import { useTheme } from "next-themes";
import LandingPage from "./components/landing/SimpleLandingPageBasic";
import { FloatingActionButton } from "./components/ui/floating-action-button";
import SiteFooter from "./components/SiteFooter";

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
    return <LandingPage />;
  }

  // Show dashboard for logged-in users
  return (
    <>
      <Header />
      <main className="p-6 space-y-6 bg-background" data-component-name="Home">
        <AddUsername />

        <div className="w-full mb-6">
          <TypeaheadSearch placeholder="Search all pages..." />
        </div>

        {/* 1. Recent Activity (moved to top) */}
        <div style={{ minHeight: isLoading ? '200px' : 'auto' }}>
          <RecentActivity limit={4} />
        </div>

        {/* 2. My Pages */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            {isLoading ? (
              <Placeholder className="w-40 h-8" animate={true}>
                <div className="flex items-center space-x-2 p-2">
                  <Loader className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-lg text-muted-foreground">Loading...</span>
                </div>
              </Placeholder>
            ) : (
              <h1 className="text-2xl font-semibold flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Your Pages
              </h1>
            )}
          </div>
          <Button variant="outline" asChild>
            <Link href="/direct-create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New page
            </Link>
          </Button>
        </div>

        <div style={{ minHeight: isLoading ? '300px' : 'auto' }}>
          <AllPages />
        </div>

        {/* 3. Trending Pages */}
        <div style={{ minHeight: isLoading ? '300px' : 'auto' }}>
          <TrendingPages limit={5} />
        </div>

        {/* 4. Top Users */}
        <div style={{ minHeight: isLoading ? '300px' : 'auto' }}>
          <TopUsers />
        </div>

        <FloatingActionButton href="/direct-create" />
      </main>
      <SiteFooter />
    </>
  );
}
