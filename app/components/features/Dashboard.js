"use client";
import { useContext, useEffect } from "react";
import Link from "next/link";
import AllPages from "../components/AllPages";

import HomeGroupsSection from "../components/HomeGroupsSection";
import AddUsername from "../components/AddUsername";
import SearchResults from "../search/SearchResults";
import { AuthContext } from "../../providers/AuthProvider";
import { useRouter } from "next/navigation";
import Header from "./Header";

const Dashboard = () => {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading]);

  if (loading || !user) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="space-y-2">
        <AddUsername />

        <h1 className="text-2xl font-semibold text-foreground">Your Pages</h1>
        <div className="flex items-center md:align-middle md:justify-between md:flex-row flex-col">
          <div className="md:w-1/2 w-full">
            <SearchResults />
          </div>
        </div>
        <div className="mt-1">
          <AllPages />
        </div>

        {/* Commented out Groups section
        <div className="flex items-start pb-4 mb-- md:mb-0 md:align-middle md:justify-between md:flex-row justify-between">
          <h1 className="text-2xl font-semibold text-text">Your Groups</h1>
          <Link
            className="bg-background text-foreground border-theme-medium px-4 py-2 rounded-lg hover:bg-muted transition-colors"
            href="/group/new"
          >
            Create Group
          </Link>
        </div>
        <HomeGroupsSection />
        */}


      </div>
    </>
  );
};

export default Dashboard;