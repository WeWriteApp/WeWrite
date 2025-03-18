"use client";

import { useContext, useEffect } from "react";
import Header from "./components/Header";
import AllPages from "./components/AllPages";
import TopUsers from "./components/TopUsers";
import AddUsername from "./components/AddUsername";
import TypeaheadSearch from "./components/TypeaheadSearch";
import { AuthContext } from "./providers/AuthProvider";
import { DataContext } from "./providers/DataProvider";
import { useRouter } from "next/navigation";
import Head from "next/head";
import Link from "next/link";
import Button from "./components/Button";
import { Plus } from "lucide-react";
import { ShimmerEffect } from "./components/ui/skeleton";
import { Loader } from "lucide-react";

export default function Home() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const { loading: dataLoading } = useContext(DataContext);
  const router = useRouter();
  const isLoading = dataLoading || authLoading;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading]);

  if (authLoading || !user) {
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
        
        <div className="w-full mb-6">
          <TypeaheadSearch />
        </div>
        
        <div className="flex items-center justify-between mb-6">
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <Loader className="h-5 w-5 animate-spin text-primary" />
              <span className="text-lg text-muted-foreground">Loading your pages...</span>
            </div>
          ) : (
            <h1 className="text-2xl font-semibold">Your Pages</h1>
          )}
          <Link href="/new">
            <Button type="primary" variant="default">
              New page
            </Button>
          </Link>
        </div>
        
        <AllPages />

        <TopUsers />
      </main>
    </>
  );
}
