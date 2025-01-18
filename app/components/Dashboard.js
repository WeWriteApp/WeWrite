"use client";
import { useContext, useEffect } from "react";
import DashboardLayout from "../DashboardLayout";
import AllPages from "../components/AllPages";
import TopUsers from "../components/TopUsers";
import AddUsername from "../components/AddUsername";
import TypeaheadSearch from "../components/TypeaheadSearch";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";

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
      <div>
        <AddUsername />
        
        <h1 className="text-2xl font-semibold text-text">Your Pages</h1>
        <div className="flex items-center pb-2 md:align-middle md:justify-between md:flex-row flex-col">
          <div className="md:w-1/2 w-full">
            <TypeaheadSearch />
          </div>
        </div>
        <AllPages />
        <TopUsers />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;