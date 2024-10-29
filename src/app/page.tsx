"use client"

import Layout from "@/components/layout/Layout";
import { AppContext } from "@/providers/AppProvider";
import Image from "next/image";
import { useContext, useEffect } from "react";

export default function Home() {

  const { setLoading } = useContext(AppContext)

  useEffect(() => {
    setLoading(false)
  }, [])
  return (
    <Layout>
      <p>???</p>
    </Layout>
  );
}
