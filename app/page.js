"use client";

import { useContext, useEffect } from "react";
import Header from "./components/Header";
import AllPages from "./components/AllPages";
import TopUsers from "./components/TopUsers";
import AddUsername from "./components/AddUsername";
import TypeaheadSearch from "./components/TypeaheadSearch";
import { AuthContext } from "./providers/AuthProvider";
import { useRouter } from "next/navigation";

export default function Home() {
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
      <main className="p-4">
        <AddUsername />
        
        <h1 className="text-2xl font-semibold text-text">Your Pages</h1>
        <div className="flex items-center pb-2 md:align-middle md:justify-between md:flex-row flex-col">
          <div className="md:w-1/2 w-full">
            <TypeaheadSearch />
          </div>
        </div>
        <AllPages />

        <TopUsers />
      </main>
    </>
  );
}
