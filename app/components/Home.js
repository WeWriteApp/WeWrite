"use client";

/**
 * Home Component
 *
 * This is the main logged-in home page component.
 * It shows Recent Activity, Trending Pages, and Top Users sections.
 */

import { useContext, useEffect } from "react";
import DashboardLayout from "../DashboardLayout";
import TopUsers from "./TopUsers";
import AddUsername from "./AddUsername";
import TypeaheadSearch from "./TypeaheadSearch";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import Header from "./Header";
import RecentActivity from "./RecentActivity";
import TrendingPages from "./TrendingPages";
import Toolbar from "./Toolbar";
import { Clock, Flame, Users } from "lucide-react";

const Home = () => {
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
    <DashboardLayout>
      <Header />
      <div className="container mx-auto px-4 py-6 space-y-8">
        <AddUsername />

        {/* Search bar */}
        <div className="w-full max-w-xl mx-auto">
          <TypeaheadSearch />
        </div>

        {/* Recent Activity Section */}
        <div className="bg-card rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <p className="text-sm text-muted-foreground">See what's happening across the platform</p>
            </div>
          </div>
          <RecentActivity limit={8} showViewAll={true} />
        </div>

        {/* Trending Pages Section */}
        <div className="bg-card rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold">Trending Pages</h2>
              <p className="text-sm text-muted-foreground">Popular pages in the last 24 hours</p>
            </div>
          </div>
          <TrendingPages limit={5} />
        </div>

        {/* Top Users Section */}
        <div className="bg-card rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold">Top Users</h2>
              <p className="text-sm text-muted-foreground">Most active users on the platform</p>
            </div>
          </div>
          <TopUsers />
        </div>
      </div>

      {/* Bottom Toolbar */}
      {console.log("About to render Toolbar in Home component")}
      <Toolbar />
    </DashboardLayout>
  );
};

export default Home;
