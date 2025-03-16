"use client";

import { useContext, useEffect } from "react";
import Header from "./components/Header";
import AllPages from "./components/AllPages";
import TopUsers from "./components/TopUsers";
import AddUsername from "./components/AddUsername";
import TypeaheadSearch from "./components/TypeaheadSearch";
import { AuthContext } from "./providers/AuthProvider";
import { useRouter } from "next/navigation";
import Head from "next/head";

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
      <Head>
        <title>Home - WeWrite</title>
      </Head>
      <Header />
      <main className="container p-6 mt-20">
        <AddUsername />
        
        <h1 className="text-2xl font-semibold mb-6">Your Pages</h1>
        <div className="w-full mb-6">
          <TypeaheadSearch />
        </div>
        <AllPages />

        <TopUsers />
      </main>
    </>
  );
}
