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
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return null;
  }

  // Don't render anything while redirecting
  if (!user) {
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
