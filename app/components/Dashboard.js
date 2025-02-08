"use client";
import { useContext, useEffect } from "react";
import DashboardLayout from "../DashboardLayout";
import AllPages from "../components/AllPages";
import TopUsers from "../components/TopUsers";
import TypeaheadSearch from "../components/TypeaheadSearch";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import SetupYourAccount from "./SetupYourAccount";

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
    <DashboardLayout>
      <div className="flex flex-col bg-background text-text">
        {/* Search Bar */}
        <div className="w-full">
          <TypeaheadSearch />
        </div>

        {/* Setup Account Box */}
        <SetupYourAccount />

        {/* My Pages Section */}
        <div className="bg-background border border-gray-300 p-5 shadow-md">
          <h2 className="text-lg font-semibold mb-2 text-text">My Pages</h2>
          <AllPages />
        </div>

        {/* Recent Activity (Replaces Activity Section with Top Users) */}
        <div className="bg-background border border-gray-300 p-5 shadow-md">
          <TopUsers />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;