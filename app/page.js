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
import Link from "next/link";
import Button from "./components/Button";
import { Plus } from "lucide-react";

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
      <main className="container p-6">
        <AddUsername />
        
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Your Pages</h1>
          <Link href="/new">
            <Button 
              variant="ghost" 
              size="sm" 
              className="hover:bg-white/10 text-white"
            >
              New page
            </Button>
          </Link>
        </div>
        <div className="w-full mb-6">
          <TypeaheadSearch />
        </div>
        <AllPages />

        <TopUsers />
      </main>
    </>
  );
}
