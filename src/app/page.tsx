"use client"

import Layout from "@/components/layout/Layout";
import { AppContext } from "@/providers/AppProvider";
import { AuthContext } from "@/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useContext, useEffect } from "react";

export default function Home() {

  const { loading, setLoading } = useContext(AppContext)
  const { user } = useContext(AuthContext)
  const router = useRouter();

  // useEffect(() => {
  //   setLoading(false)
  // }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading]);

  if (loading || !user) {
    return null;
  }
  return (
    <Layout>
      <p>This means you logged in</p>
    </Layout>
  );
}
