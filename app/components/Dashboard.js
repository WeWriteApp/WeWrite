"use client";
import { useContext, useEffect } from "react";
import DashboardLayout from "../DashboardLayout";
import Link from "next/link";
import AllPages from "../components/AllPages";
import TopUsers from "../components/TopUsers";
import YourGroups from "../components/YourGroups";
import AddUsername from "../components/AddUsername";
import TypeaheadSearch from "../components/TypeaheadSearch";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import Header from "./Header";

const Dashboard = () => {
  const { user,loading } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user,loading]);

  if (loading || !user) {
    return null;
  }
  return (
    <DashboardLayout>
      <Header />
      <div>
        <AddUsername />
        
        <h1 className="text-2xl font-semibold text-text">Your Pages</h1>
        <div className="flex items-center pb-2 md:align-middle md:justify-between md:flex-row flex-col">
          <div className="md:w-1/2 w-full">
            <TypeaheadSearch />
          </div>
        </div>
        <AllPages />

        {/* Commented out Groups section
        <div className="flex items-start pb-4 mb-- md:mb-0 md:align-middle md:justify-between md:flex-row justify-between">
          <h1 className="text-2xl font-semibold text-text">Your Groups</h1>
          <Link
            className="bg-background text-button-text border border-gray-500 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            href="/groups/new"
          >
            Create Group
          </Link>
        </div>
        <YourGroups />
        */}

        <TopUsers />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;