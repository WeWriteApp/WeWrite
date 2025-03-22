"use client";

import { useContext, useEffect } from "react";
import Header from "./components/Header";
import AllPages from "./components/AllPages";
import TopUsers from "./components/TopUsers";
import AddUsername from "./components/AddUsername";
import TypeaheadSearch from "./components/TypeaheadSearch";
import LoginBanner from "./components/LoginBanner";
import RecentActivity from "./components/RecentActivity";
import { AuthContext } from "./providers/AuthProvider";
import { DataContext } from "./providers/DataProvider";
import { useRouter } from "next/navigation";
import Head from "next/head";
import Link from "next/link";
import { Button } from "./components/ui/button";
import { Plus, FileText, Loader } from "lucide-react";
import { ShimmerEffect } from "./components/ui/skeleton";
import { useTheme } from "next-themes";

export default function Home() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const { loading: dataLoading } = useContext(DataContext);
  const router = useRouter();
  const isLoading = dataLoading || authLoading;
  const { theme } = useTheme();

  // Redirect to login page if user is not logged in
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
      
      // If definitely not authenticated, redirect
      if (!authLoading && !user && !isAuthenticated && persistedAuthState !== 'authenticated') {
        console.log("No auth detected, redirecting to login");
        router.push('/auth/login');
      }
    };
    
    checkAuth();
    
    // Set up a timer to check again in case of race conditions
    const timer = setTimeout(checkAuth, 1000);
    return () => clearTimeout(timer);
  }, [user, authLoading, router]);

  // Display a loading state instead of nothing
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin h-8 w-8 text-primary"/>
      </div>
    );
  }

  // Don't render anything while redirecting if no user
  if (!user) {
    // Check if we have indicators of auth in progress
    const isAuthenticated = document.cookie.includes('authenticated=true');
    const persistedAuthState = localStorage.getItem('authState');
    
    if (isAuthenticated || persistedAuthState === 'authenticated') {
      // Show loading if we have some indication auth might be in progress
      return (
        <div className="flex items-center justify-center h-screen">
          <Loader className="animate-spin h-8 w-8 text-primary"/>
        </div>
      );
    }
    
    // Otherwise show nothing while redirecting
    return null;
  }

  return (
    <>
      <Head>
        <title>Home - WeWrite</title>
      </Head>
      <Header />
      <main className="p-6 space-y-6 bg-background" data-component-name="Home">
        <AddUsername />
        
        <div className="w-full mb-6">
          <TypeaheadSearch />
        </div>
        
        <RecentActivity />
        
        <div className="flex items-center justify-between mb-6">
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <Loader className="h-5 w-5 animate-spin text-primary" />
              <span className="text-lg text-muted-foreground">Loading your pages...</span>
            </div>
          ) : (
            <h1 className="text-2xl font-semibold flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Your Pages
            </h1>
          )}
          <Button variant="outline" asChild>
            <Link href="/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New page
            </Link>
          </Button>
        </div>
        
        <AllPages />

        <TopUsers />
      </main>
    </>
  );
}
